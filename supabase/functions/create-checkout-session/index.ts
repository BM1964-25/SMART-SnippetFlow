import Stripe from "stripe";

const stripe = new Stripe(requiredEnv("STRIPE_SECRET_KEY"), {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

type CheckoutRequest = {
  email?: string;
  successUrl?: string;
  cancelUrl?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return json(request, { error: "Method not allowed" }, 405);
  }

  let payload: CheckoutRequest = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const priceId = requiredEnv("STRIPE_PRICE_ID");
  const mode = checkoutMode();
  const successUrl = payload.successUrl ?? checkoutUrlFromEnv("CHECKOUT_SUCCESS_URL");
  const cancelUrl = payload.cancelUrl ?? checkoutUrlFromEnv("CHECKOUT_CANCEL_URL");
  const metadata = {
    product_key: Deno.env.get("LICENSE_PRODUCT_KEY") ?? "smart_snippetflow_desktop",
    license_type: Deno.env.get("LICENSE_TYPE") ?? "single_seat",
    seat_limit: Deno.env.get("LICENSE_SEAT_LIMIT") ?? "1",
    device_limit: Deno.env.get("LICENSE_DEVICE_LIMIT") ?? "1",
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      customer_email: normalizeEmail(payload.email),
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      automatic_tax: { enabled: Deno.env.get("STRIPE_AUTOMATIC_TAX") === "true" },
      client_reference_id: crypto.randomUUID(),
      metadata,
      payment_intent_data: mode === "payment" ? { metadata } : undefined,
      subscription_data: mode === "subscription" ? { metadata } : undefined,
    });

    return json(request, { url: session.url });
  } catch (error) {
    return json(request, { error: errorMessage(error) }, 500);
  }
});

function checkoutMode(): "payment" | "subscription" {
  const value = Deno.env.get("STRIPE_CHECKOUT_MODE") ?? "subscription";
  return value === "payment" ? "payment" : "subscription";
}

function normalizeEmail(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.includes("@") ? trimmed : undefined;
}

function checkoutUrlFromEnv(name: string) {
  const value = requiredEnv(name);

  if (value.includes("your-domain.example")) {
    throw new Error(`${name} still contains the placeholder domain.`);
  }

  return value;
}

function corsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowedOrigins = (Deno.env.get("CHECKOUT_ALLOWED_ORIGINS") ?? "http://127.0.0.1:5173,http://localhost:5173")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? "*";

  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
    "access-control-allow-methods": "POST, OPTIONS",
    "vary": "origin",
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "content-type": "application/json",
    },
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
