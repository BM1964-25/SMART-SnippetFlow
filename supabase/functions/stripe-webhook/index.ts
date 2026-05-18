import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: {
    persistSession: false,
  },
});

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing stripe-signature header" }, 400);
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, requiredEnv("STRIPE_WEBHOOK_SECRET"), undefined, cryptoProvider);
  } catch (error) {
    return json({ error: `Webhook signature verification failed: ${errorMessage(error)}` }, 400);
  }

  const eventInsert = await supabase.from("stripe_events").insert({
    id: event.id,
    event_type: event.type,
    api_version: event.api_version,
    livemode: event.livemode,
    payload: event as unknown as Record<string, unknown>,
  });

  if (eventInsert.error) {
    if (eventInsert.error.code === "23505") {
      const existingEvent = await supabase.from("stripe_events").select("processed_at").eq("id", event.id).maybeSingle();

      if (existingEvent.error) {
        return json({ error: existingEvent.error.message }, 500);
      }

      if (existingEvent.data?.processed_at) {
        return json({ received: true, duplicate: true });
      }
    }
    else {
      return json({ error: eventInsert.error.message }, 500);
    }
  }

  try {
    await handleEvent(event);
    await markEventProcessed(event.id);
  } catch (error) {
    await supabase.from("stripe_events").update({ processing_error: errorMessage(error) }).eq("id", event.id);
    await supabase.from("license_audit_log").insert({
      event_type: `stripe.${event.type}.failed`,
      message: errorMessage(error),
      metadata: { eventId: event.id },
    });

    return json({ error: errorMessage(error) }, 500);
  }

  return json({ received: true });
});

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id);
      return;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChanged(event.data.object as Stripe.Subscription, event.type, event.id);
      return;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      await handleInvoiceChanged(event.data.object as Stripe.Invoice, event.type, event.id);
      return;
    case "charge.refunded":
      await handleChargeRefunded(event.data.object as Stripe.Charge, event.id);
      return;
    default:
      await supabase.from("license_audit_log").insert({
        event_type: `stripe.${event.type}.ignored`,
        metadata: { eventId: event.id },
      });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
  const customerId = stringId(session.customer);
  const customerEmail = session.customer_details?.email ?? session.customer_email ?? null;
  const customerName = session.customer_details?.name ?? null;
  const subscriptionId = stringId(session.subscription);
  const paymentIntentId = stringId(session.payment_intent);
  const lineItem = await firstLineItem(session.id);
  const priceId = lineItem?.price?.id ?? null;
  const metadata = normalizeMetadata(session.metadata);
  const licenseType = metadata.license_type ?? "single_seat";
  const productKey = metadata.product_key ?? "smart_snippetflow_desktop";
  const seatLimit = parsePositiveInt(metadata.seat_limit, 1);
  const deviceLimit = parsePositiveInt(metadata.device_limit, 1);

  const customer = await upsertCustomer(customerId, customerEmail, customerName);
  const existing = await findLicenseBySessionOrSubscription(session.id, subscriptionId);

  if (existing) {
    await supabase
      .from("licenses")
      .update({
        customer_id: customer?.id ?? existing.customer_id,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_payment_intent_id: paymentIntentId,
        stripe_price_id: priceId,
        status: "active",
        purchased_at: existing.purchased_at ?? new Date().toISOString(),
        metadata,
      })
      .eq("id", existing.id);

    await audit(existing.id, "license.checkout.updated", `Checkout ${session.id} refreshed an existing license.`, { eventId });
    return;
  }

  const generatedKey = await generateLicenseKey();
  const insert = await supabase
    .from("licenses")
    .insert({
      license_key: generatedKey,
      customer_id: customer?.id ?? null,
      product_key: productKey,
      license_type: licenseType,
      status: "active",
      seat_limit: seatLimit,
      device_limit: deviceLimit,
      stripe_customer_id: customerId,
      stripe_checkout_session_id: session.id,
      stripe_subscription_id: subscriptionId,
      stripe_payment_intent_id: paymentIntentId,
      stripe_price_id: priceId,
      purchased_at: new Date().toISOString(),
      metadata,
    })
    .select("id")
    .single();

  if (insert.error) {
    throw insert.error;
  }

  await audit(insert.data.id, "license.created", `License created from Checkout ${session.id}.`, {
    eventId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
  });
}

async function handleSubscriptionChanged(subscription: Stripe.Subscription, eventType: string, eventId: string) {
  const stripeSubscriptionId = subscription.id;
  const status = mapSubscriptionStatus(subscription.status, subscription.cancel_at_period_end);
  const currentPeriodEnd = timestampToIso(subscription.current_period_end);
  const canceledAt = timestampToIso(subscription.canceled_at);
  const priceId = subscription.items.data[0]?.price.id ?? null;

  const update = await supabase
    .from("licenses")
    .update({
      status,
      current_period_end: currentPeriodEnd,
      canceled_at: canceledAt,
      stripe_price_id: priceId,
      metadata: {
        stripeSubscriptionStatus: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    })
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .select("id")
    .maybeSingle();

  if (update.error) {
    throw update.error;
  }

  await audit(update.data?.id ?? null, `license.subscription.${eventType}`, `Subscription ${stripeSubscriptionId} changed.`, {
    eventId,
    stripeSubscriptionId,
    status,
  });
}

async function handleInvoiceChanged(invoice: Stripe.Invoice, eventType: string, eventId: string) {
  const subscriptionId = stringId(invoice.subscription);
  if (!subscriptionId) {
    return;
  }

  const status = eventType === "invoice.payment_succeeded" ? "active" : "past_due";
  const update = await supabase
    .from("licenses")
    .update({ status })
    .eq("stripe_subscription_id", subscriptionId)
    .select("id")
    .maybeSingle();

  if (update.error) {
    throw update.error;
  }

  await audit(update.data?.id ?? null, `license.invoice.${eventType}`, `Invoice ${invoice.id} changed license status.`, {
    eventId,
    stripeSubscriptionId: subscriptionId,
    status,
  });
}

async function handleChargeRefunded(charge: Stripe.Charge, eventId: string) {
  const paymentIntentId = stringId(charge.payment_intent);
  if (!paymentIntentId) {
    return;
  }

  const update = await supabase
    .from("licenses")
    .update({ status: "refunded" })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .select("id")
    .maybeSingle();

  if (update.error) {
    throw update.error;
  }

  await audit(update.data?.id ?? null, "license.refunded", `Charge ${charge.id} was refunded.`, {
    eventId,
    stripePaymentIntentId: paymentIntentId,
  });
}

async function upsertCustomer(stripeCustomerId: string | null, email: string | null, name: string | null) {
  if (!stripeCustomerId && !email) {
    return null;
  }

  if (stripeCustomerId) {
    const result = await supabase
      .from("license_customers")
      .upsert(
        {
          stripe_customer_id: stripeCustomerId,
          email,
          name,
        },
        { onConflict: "stripe_customer_id" },
      )
      .select("id")
      .single();

    if (result.error) {
      throw result.error;
    }

    return result.data;
  }

  const result = await supabase
    .from("license_customers")
    .insert({ email, name })
    .select("id")
    .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function firstLineItem(sessionId: string) {
  const lineItems = await stripe.checkout.sessions.listLineItems(sessionId, {
    limit: 1,
    expand: ["data.price"],
  });

  return lineItems.data[0] ?? null;
}

async function findLicenseBySessionOrSubscription(sessionId: string, subscriptionId: string | null) {
  const query = subscriptionId
    ? `stripe_checkout_session_id.eq.${sessionId},stripe_subscription_id.eq.${subscriptionId}`
    : `stripe_checkout_session_id.eq.${sessionId}`;

  const result = await supabase.from("licenses").select("*").or(query).maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

async function generateLicenseKey() {
  const result = await supabase.rpc("generate_license_key");

  if (result.error) {
    throw result.error;
  }

  return result.data as string;
}

async function audit(licenseId: string | null, eventType: string, message: string, metadata: Record<string, unknown>) {
  const result = await supabase.from("license_audit_log").insert({
    license_id: licenseId,
    event_type: eventType,
    message,
    metadata,
  });

  if (result.error) {
    throw result.error;
  }
}

async function markEventProcessed(eventId: string) {
  const result = await supabase
    .from("stripe_events")
    .update({
      processed_at: new Date().toISOString(),
      processing_error: null,
    })
    .eq("id", eventId);

  if (result.error) {
    throw result.error;
  }
}

function mapSubscriptionStatus(status: Stripe.Subscription.Status, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd && status === "active") {
    return "canceled";
  }

  switch (status) {
    case "active":
    case "trialing":
      return status;
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "expired";
    default:
      return "disabled";
  }
}

function timestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function normalizeMetadata(metadata: Stripe.Metadata | null) {
  return Object.fromEntries(Object.entries(metadata ?? {}).filter(([, value]) => value !== ""));
}

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function stringId(value: string | { id: string } | null | undefined) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
