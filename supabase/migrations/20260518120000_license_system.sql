create extension if not exists pgcrypto;

create table if not exists public.license_customers (
  id uuid primary key default gen_random_uuid(),
  email text,
  name text,
  stripe_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  license_key text not null unique,
  customer_id uuid references public.license_customers(id) on delete set null,
  product_key text not null default 'smart_snippetflow_desktop',
  license_type text not null default 'single_seat',
  status text not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'expired', 'refunded', 'disabled')),
  seat_limit integer not null default 1 check (seat_limit > 0),
  device_limit integer not null default 1 check (device_limit > 0),
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text unique,
  stripe_payment_intent_id text,
  stripe_price_id text,
  current_period_end timestamptz,
  purchased_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists licenses_customer_id_idx on public.licenses(customer_id);
create index if not exists licenses_license_key_idx on public.licenses(license_key);
create index if not exists licenses_stripe_customer_id_idx on public.licenses(stripe_customer_id);

create table if not exists public.license_activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references public.licenses(id) on delete cascade,
  device_fingerprint_hash text not null,
  device_label text,
  platform text,
  app_version text,
  activated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  deactivated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create unique index if not exists license_activations_active_device_idx
  on public.license_activations(license_id, device_fingerprint_hash)
  where deactivated_at is null;

create index if not exists license_activations_license_id_idx on public.license_activations(license_id);

create table if not exists public.stripe_events (
  id text primary key,
  event_type text not null,
  api_version text,
  livemode boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create table if not exists public.license_audit_log (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references public.licenses(id) on delete set null,
  event_type text not null,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists license_customers_set_updated_at on public.license_customers;
create trigger license_customers_set_updated_at
before update on public.license_customers
for each row execute function public.set_updated_at();

drop trigger if exists licenses_set_updated_at on public.licenses;
create trigger licenses_set_updated_at
before update on public.licenses
for each row execute function public.set_updated_at();

create or replace function public.generate_license_key()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(
      'SSF-' ||
      substr(encode(gen_random_bytes(12), 'hex'), 1, 4) || '-' ||
      substr(encode(gen_random_bytes(12), 'hex'), 1, 4) || '-' ||
      substr(encode(gen_random_bytes(12), 'hex'), 1, 4) || '-' ||
      substr(encode(gen_random_bytes(12), 'hex'), 1, 4)
    );

    exit when not exists (
      select 1 from public.licenses where license_key = candidate
    );
  end loop;

  return candidate;
end;
$$;

alter table public.license_customers enable row level security;
alter table public.licenses enable row level security;
alter table public.license_activations enable row level security;
alter table public.stripe_events enable row level security;
alter table public.license_audit_log enable row level security;

create or replace function public.is_license_usable(p_license public.licenses)
returns boolean
language sql
stable
as $$
  select
    p_license.status in ('trialing', 'active', 'past_due', 'canceled')
    and (
      p_license.current_period_end is null
      or p_license.current_period_end > now()
      or p_license.status = 'past_due'
    );
$$;

create or replace function public.activate_license(
  p_license_key text,
  p_device_fingerprint_hash text,
  p_device_label text default null,
  p_platform text default null,
  p_app_version text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses;
  v_activation public.license_activations;
  v_active_count integer;
begin
  if nullif(trim(p_license_key), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_license_key');
  end if;

  if nullif(trim(p_device_fingerprint_hash), '') is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_device_fingerprint');
  end if;

  select *
  into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license_not_found');
  end if;

  if not public.is_license_usable(v_license) then
    return jsonb_build_object('ok', false, 'reason', 'license_not_usable', 'status', v_license.status);
  end if;

  select *
  into v_activation
  from public.license_activations
  where license_id = v_license.id
    and device_fingerprint_hash = p_device_fingerprint_hash
    and deactivated_at is null;

  if found then
    update public.license_activations
    set
      last_seen_at = now(),
      device_label = coalesce(p_device_label, device_label),
      platform = coalesce(p_platform, platform),
      app_version = coalesce(p_app_version, app_version),
      metadata = coalesce(p_metadata, '{}'::jsonb)
    where id = v_activation.id
    returning * into v_activation;
  else
    select count(*)
    into v_active_count
    from public.license_activations
    where license_id = v_license.id
      and deactivated_at is null;

    if v_active_count >= v_license.device_limit then
      return jsonb_build_object(
        'ok', false,
        'reason', 'device_limit_reached',
        'status', v_license.status,
        'deviceLimit', v_license.device_limit,
        'activeDevices', v_active_count
      );
    end if;

    insert into public.license_activations (
      license_id,
      device_fingerprint_hash,
      device_label,
      platform,
      app_version,
      metadata
    )
    values (
      v_license.id,
      p_device_fingerprint_hash,
      p_device_label,
      p_platform,
      p_app_version,
      coalesce(p_metadata, '{}'::jsonb)
    )
    returning * into v_activation;
  end if;

  return jsonb_build_object(
    'ok', true,
    'licenseId', v_license.id,
    'activationId', v_activation.id,
    'status', v_license.status,
    'licenseType', v_license.license_type,
    'productKey', v_license.product_key,
    'seatLimit', v_license.seat_limit,
    'deviceLimit', v_license.device_limit,
    'currentPeriodEnd', v_license.current_period_end
  );
end;
$$;

create or replace function public.refresh_license_activation(
  p_license_key text,
  p_activation_id uuid,
  p_device_fingerprint_hash text,
  p_app_version text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license public.licenses;
  v_activation public.license_activations;
begin
  select *
  into v_license
  from public.licenses
  where license_key = upper(trim(p_license_key));

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license_not_found');
  end if;

  select *
  into v_activation
  from public.license_activations
  where id = p_activation_id
    and license_id = v_license.id
    and device_fingerprint_hash = p_device_fingerprint_hash
    and deactivated_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'activation_not_found');
  end if;

  update public.license_activations
  set last_seen_at = now(), app_version = coalesce(p_app_version, app_version)
  where id = v_activation.id;

  return jsonb_build_object(
    'ok', public.is_license_usable(v_license),
    'licenseId', v_license.id,
    'activationId', v_activation.id,
    'status', v_license.status,
    'currentPeriodEnd', v_license.current_period_end
  );
end;
$$;

create or replace function public.deactivate_license_activation(
  p_license_key text,
  p_activation_id uuid,
  p_device_fingerprint_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_license_id uuid;
begin
  select id
  into v_license_id
  from public.licenses
  where license_key = upper(trim(p_license_key));

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'license_not_found');
  end if;

  update public.license_activations
  set deactivated_at = now(), last_seen_at = now()
  where id = p_activation_id
    and license_id = v_license_id
    and device_fingerprint_hash = p_device_fingerprint_hash
    and deactivated_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on public.license_customers from anon, authenticated;
revoke all on public.licenses from anon, authenticated;
revoke all on public.license_activations from anon, authenticated;
revoke all on public.stripe_events from anon, authenticated;
revoke all on public.license_audit_log from anon, authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.generate_license_key() from public;
revoke execute on function public.is_license_usable(public.licenses) from public;
revoke execute on function public.activate_license(text, text, text, text, text, jsonb) from public;
revoke execute on function public.refresh_license_activation(text, uuid, text, text) from public;
revoke execute on function public.deactivate_license_activation(text, uuid, text) from public;

grant execute on function public.activate_license(text, text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.refresh_license_activation(text, uuid, text, text) to anon, authenticated;
grant execute on function public.deactivate_license_activation(text, uuid, text) to anon, authenticated;
