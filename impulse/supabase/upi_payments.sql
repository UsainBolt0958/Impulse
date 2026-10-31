create table if not exists public.upi_payment_orders (
  order_id text primary key check (char_length(order_id) between 10 and 64),
  user_id uuid not null references auth.users (id) on delete restrict,
  product_type text not null check (product_type in ('subscription', 'test_series')),
  plan_code text references public.premium_plans (plan_code),
  duration_months smallint,
  series_id text,
  amount_inr integer not null check (amount_inr > 0),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed', 'expired')),
  payment_url text,
  provider_utr text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  paid_at timestamptz,
  check (
    (product_type = 'subscription'
      and plan_code in ('lite', 'gold', 'ultimate')
      and duration_months in (3, 6, 12)
      and series_id is null)
    or (product_type = 'test_series'
      and plan_code is null
      and duration_months is null
      and series_id is not null)
  )
);

create index if not exists upi_payment_orders_user_created_idx
  on public.upi_payment_orders (user_id, created_at desc);
create index if not exists upi_payment_orders_pending_expiry_idx
  on public.upi_payment_orders (expires_at)
  where status = 'pending';

create table if not exists public.test_series_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  series_id text not null check (char_length(series_id) between 1 and 200),
  order_id text not null unique references public.upi_payment_orders (order_id),
  amount_inr integer not null check (amount_inr > 0),
  status text not null default 'active' check (status in ('active', 'refunded', 'revoked')),
  purchased_at timestamptz not null default now(),
  unique (user_id, series_id)
);

create index if not exists test_series_purchases_user_idx
  on public.test_series_purchases (user_id, series_id, status);

alter table public.payment_transactions
  add column if not exists provider_utr text;

create unique index if not exists subscriptions_provider_order_unique
  on public.subscriptions (provider, provider_order_id)
  where provider_order_id is not null;
create unique index if not exists payment_transactions_provider_order_unique
  on public.payment_transactions (provider, provider_order_id)
  where provider_order_id is not null;

alter table public.upi_payment_orders enable row level security;
alter table public.test_series_purchases enable row level security;

revoke all on public.upi_payment_orders, public.test_series_purchases
  from public, anon, authenticated;
grant select on public.upi_payment_orders, public.test_series_purchases to authenticated;
grant all on public.upi_payment_orders, public.test_series_purchases to service_role;
grant select on public.upi_payment_orders, public.test_series_purchases to service_role;
grant update (provider_utr) on public.payment_transactions to service_role;

drop policy if exists "Users read their own UPI payment orders" on public.upi_payment_orders;
create policy "Users read their own UPI payment orders"
  on public.upi_payment_orders for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_billing_admin()));

drop policy if exists "Users read their own test-series purchases" on public.test_series_purchases;
create policy "Users read their own test-series purchases"
  on public.test_series_purchases for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_billing_admin()));

create or replace function public.create_upi_payment_order(
  p_order_id text,
  p_user_id uuid,
  p_product_type text,
  p_plan_code text,
  p_duration_months smallint,
  p_series_id text,
  p_amount_inr integer
)
returns public.upi_payment_orders
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_order public.upi_payment_orders;
  configured_price integer;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if p_product_type = 'subscription' then
    select price.price_inr into configured_price
    from public.premium_plans as plan
    join public.premium_plan_prices as price on price.plan_code = plan.plan_code
    where plan.plan_code = p_plan_code
      and plan.enabled
      and price.duration_months = p_duration_months;
  elsif p_product_type = 'test_series' then
    perform pg_advisory_xact_lock(
      hashtextextended('series-purchase:' || p_user_id::text || ':' || p_series_id, 0)
    );
    select price.price_inr into configured_price
    from public.test_series_prices as price
    where price.series_id = p_series_id
      and price.enabled;
    if exists (
      select 1
      from public.test_series_purchases as purchase
      where purchase.user_id = p_user_id
        and purchase.series_id = p_series_id
    ) then
      raise exception 'This user already has a purchase record for the test series.';
    end if;
    if exists (
      select 1
      from public.upi_payment_orders as existing_order
      where existing_order.user_id = p_user_id
        and existing_order.series_id = p_series_id
        and existing_order.status = 'pending'
        and existing_order.expires_at > now()
    ) then
      raise exception 'A payment for this test series is already pending.';
    end if;
  else
    raise exception 'Unsupported product type.';
  end if;

  if configured_price is null or configured_price <= 0 or configured_price <> p_amount_inr then
    raise exception 'Price is unavailable or has changed.';
  end if;

  insert into public.upi_payment_orders (
    order_id, user_id, product_type, plan_code, duration_months,
    series_id, amount_inr
  ) values (
    p_order_id, p_user_id, p_product_type, p_plan_code, p_duration_months,
    p_series_id, p_amount_inr
  )
  returning * into created_order;

  insert into public.payment_transactions (
    user_id, provider, provider_order_id, status, amount_inr, currency
  ) values (
    p_user_id, 'upigateway', p_order_id, 'pending', p_amount_inr, 'INR'
  );

  return created_order;
end
$$;

create or replace function public.reconcile_upi_payment(
  p_order_id text,
  p_provider_status text,
  p_amount_inr integer default null,
  p_provider_utr text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_order public.upi_payment_orders;
  subscription_record public.subscriptions;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  select * into payment_order
  from public.upi_payment_orders
  where order_id = p_order_id
  for update;

  if not found then
    raise exception 'Payment order not found.';
  end if;

  if payment_order.status = 'succeeded' then
    return jsonb_build_object(
      'order_id', payment_order.order_id,
      'status', payment_order.status,
      'product_type', payment_order.product_type,
      'series_id', payment_order.series_id
    );
  end if;

  if payment_order.status <> 'pending' and p_provider_status <> 'SUCCESS' then
    return jsonb_build_object(
      'order_id', payment_order.order_id,
      'status', payment_order.status,
      'product_type', payment_order.product_type,
      'series_id', payment_order.series_id
    );
  end if;

  if p_provider_status = 'PENDING' then
    if payment_order.expires_at <= now() then
      update public.upi_payment_orders
      set status = 'expired'
      where order_id = p_order_id;
      update public.payment_transactions
      set status = 'failed'
      where provider = 'upigateway' and provider_order_id = p_order_id;
      payment_order.status := 'expired';
    end if;
  elsif p_provider_status = 'FAILURE' then
    update public.upi_payment_orders
    set status = 'failed'
    where order_id = p_order_id;
    update public.payment_transactions
    set status = 'failed'
    where provider = 'upigateway' and provider_order_id = p_order_id;
    payment_order.status := 'failed';
  elsif p_provider_status = 'SUCCESS' then
    if p_amount_inr is null or p_amount_inr <> payment_order.amount_inr then
      raise exception 'Verified gateway amount does not match the order.';
    end if;
    if coalesce(trim(p_provider_utr), '') = '' then
      raise exception 'A verified bank reference is required.';
    end if;

    update public.upi_payment_orders
    set status = 'succeeded',
        provider_utr = p_provider_utr,
        paid_at = now()
    where order_id = p_order_id;

    if payment_order.product_type = 'subscription' then
      insert into public.subscriptions (
        user_id, plan_code, duration_months, status, list_price_inr,
        discount_inr, paid_inr, currency, provider, provider_order_id,
        provider_payment_id, starts_at, ends_at
      ) values (
        payment_order.user_id, payment_order.plan_code, payment_order.duration_months,
        'active', payment_order.amount_inr, 0, payment_order.amount_inr, 'INR',
        'upigateway', payment_order.order_id, p_provider_utr, now(),
        now() + make_interval(months => payment_order.duration_months)
      )
      on conflict (provider, provider_order_id) where provider_order_id is not null
      do nothing
      returning * into subscription_record;
    else
      insert into public.test_series_purchases (
        user_id, series_id, order_id, amount_inr, status
      ) values (
        payment_order.user_id, payment_order.series_id, payment_order.order_id,
        payment_order.amount_inr, 'active'
      )
      on conflict (order_id) do nothing;
    end if;

    update public.payment_transactions
    set status = 'succeeded',
        amount_inr = payment_order.amount_inr,
        provider_utr = p_provider_utr,
        provider_payment_id = p_provider_utr,
        subscription_id = subscription_record.id,
        settled_at = now()
    where provider = 'upigateway' and provider_order_id = p_order_id;
    payment_order.status := 'succeeded';
  else
    raise exception 'Unsupported verified gateway status.';
  end if;

  return jsonb_build_object(
    'order_id', payment_order.order_id,
    'status', payment_order.status,
    'product_type', payment_order.product_type,
    'series_id', payment_order.series_id
  );
end
$$;

revoke execute on function public.create_upi_payment_order(text, uuid, text, text, smallint, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_upi_payment_order(text, uuid, text, text, smallint, text, integer)
  to service_role;
revoke execute on function public.reconcile_upi_payment(text, text, integer, text)
  from public, anon, authenticated;
grant execute on function public.reconcile_upi_payment(text, text, integer, text)
  to service_role;
