create table if not exists public.billing_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.billing_admins enable row level security;
revoke all on public.billing_admins from public, anon, authenticated;

create or replace function public.is_billing_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as admin_user
    where admin_user.id = (select auth.uid())
      and lower(admin_user.email) in ('yashbharati81@gmail.com', 'impulsepreps@gmail.com')
      and admin_user.email_confirmed_at is not null
      and exists (
        select 1
        from auth.identities as admin_identity
        where admin_identity.user_id = admin_user.id
          and admin_identity.provider = 'google'
      )
  )
$$;

revoke execute on function public.is_billing_admin() from public, anon;
grant execute on function public.is_billing_admin() to authenticated;

create table if not exists public.premium_plans (
  plan_code text primary key check (plan_code in ('free', 'pro')),
  name text not null,
  description text not null default '',
  features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array'),
  limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
  enabled boolean not null default true,
  sort_order smallint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.premium_plan_prices (
  plan_code text not null references public.premium_plans (plan_code) on delete cascade,
  duration_months smallint not null check (duration_months in (0, 3, 6, 12)),
  price_inr integer not null check (price_inr >= 0),
  updated_at timestamptz not null default now(),
  primary key (plan_code, duration_months),
  check ((plan_code = 'free' and duration_months = 0 and price_inr = 0)
    or (plan_code <> 'free' and duration_months in (3, 6, 12)))
);

create table if not exists public.test_series_prices (
  series_id text primary key check (char_length(series_id) between 1 and 200),
  price_inr integer not null check (price_inr >= 0),
  enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  inviter_discount_percent smallint not null default 50 check (inviter_discount_percent between 0 and 100),
  invitee_discount_percent smallint not null default 10 check (invitee_discount_percent between 0 and 100),
  max_combined_discount_percent smallint not null default 60 check (max_combined_discount_percent between 0 and 100),
  reward_expiry_days smallint not null default 90 check (reward_expiry_days between 1 and 365),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  plan_code text not null references public.premium_plans (plan_code),
  duration_months smallint not null check (duration_months in (3, 6, 12)),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'cancelled', 'refunded')),
  list_price_inr integer not null check (list_price_inr >= 0),
  discount_inr integer not null default 0 check (discount_inr >= 0),
  paid_inr integer not null default 0 check (paid_inr >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  provider text,
  provider_order_id text,
  provider_payment_id text,
  referral_code text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_inr <= list_price_inr),
  check (paid_inr <= list_price_inr)
);

create index if not exists subscriptions_user_created_idx
  on public.subscriptions (user_id, created_at desc);
create index if not exists subscriptions_status_created_idx
  on public.subscriptions (status, created_at desc);
create unique index if not exists subscriptions_provider_payment_unique
  on public.subscriptions (provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete restrict,
  provider text not null,
  provider_order_id text,
  provider_payment_id text,
  status text not null check (status in ('pending', 'succeeded', 'failed', 'refunded')),
  amount_inr integer not null check (amount_inr >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  discount_inr integer not null default 0 check (discount_inr >= 0),
  referral_code text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists payment_transactions_status_created_idx
  on public.payment_transactions (status, created_at desc);
create unique index if not exists payment_transactions_provider_payment_unique
  on public.payment_transactions (provider, provider_payment_id)
  where provider_payment_id is not null;

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,20}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users (id) on delete restrict,
  referred_user_id uuid not null unique references auth.users (id) on delete restrict,
  referral_code text not null references public.referral_codes (code),
  status text not null default 'pending' check (status in ('pending', 'qualified', 'reversed')),
  qualifying_subscription_id uuid references public.subscriptions (id) on delete set null,
  inviter_discount_percent smallint not null check (inviter_discount_percent between 0 and 100),
  invitee_discount_percent smallint not null check (invitee_discount_percent between 0 and 100),
  created_at timestamptz not null default now(),
  qualified_at timestamptz,
  check (referrer_user_id <> referred_user_id)
);

create index if not exists referral_attributions_referrer_idx
  on public.referral_attributions (referrer_user_id, created_at desc);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  attribution_id uuid not null references public.referral_attributions (id) on delete restrict,
  discount_percent smallint not null check (discount_percent between 0 and 100),
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired', 'revoked')),
  subscription_id uuid references public.subscriptions (id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  redeemed_at timestamptz
);

create index if not exists referral_rewards_user_status_idx
  on public.referral_rewards (user_id, status, expires_at);

create table if not exists public.billing_config_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users (id) on delete set null,
  config_type text not null,
  config_key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_at timestamptz not null default now()
);

create index if not exists billing_config_audit_changed_idx
  on public.billing_config_audit (changed_at desc);

create or replace function public.audit_billing_config_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_type text := tg_table_name;
  config_key text;
  before_value jsonb;
  after_value jsonb := to_jsonb(new);
begin
  if tg_op = 'UPDATE' then
    before_value := to_jsonb(old);
  end if;

  if tg_table_name = 'premium_plan_prices' then
    config_key := new.plan_code || ':' || new.duration_months::text;
  elsif tg_table_name = 'test_series_prices' then
    config_key := new.series_id;
  elsif tg_table_name = 'premium_plans' then
    config_key := new.plan_code;
  else
    config_key := 'referral-settings';
  end if;

  insert into public.billing_config_audit (
    actor_user_id, config_type, config_key, old_value, new_value
  )
  values (auth.uid(), config_type, config_key, before_value, after_value);
  return new;
end
$$;

drop trigger if exists audit_premium_plans on public.premium_plans;
create trigger audit_premium_plans
  after insert or update on public.premium_plans
  for each row execute function public.audit_billing_config_change();
drop trigger if exists audit_premium_plan_prices on public.premium_plan_prices;
create trigger audit_premium_plan_prices
  after insert or update on public.premium_plan_prices
  for each row execute function public.audit_billing_config_change();
drop trigger if exists audit_test_series_prices on public.test_series_prices;
create trigger audit_test_series_prices
  after insert or update on public.test_series_prices
  for each row execute function public.audit_billing_config_change();
drop trigger if exists audit_referral_settings on public.referral_settings;
create trigger audit_referral_settings
  after insert or update on public.referral_settings
  for each row execute function public.audit_billing_config_change();

create or replace function public.get_billing_admin_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  summary jsonb;
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;

  select jsonb_build_object(
    'active_subscriptions',
      (select count(*) from public.subscriptions where status = 'active' and ends_at > now()),
    'subscription_records',
      (select count(*) from public.subscriptions),
    'successful_payments',
      (select count(*) from public.payment_transactions where status = 'succeeded'),
    'gross_collected_inr',
      coalesce((select sum(amount_inr) from public.payment_transactions where status = 'succeeded'), 0),
    'recent_subscriptions',
      coalesce((
        select jsonb_agg(to_jsonb(recent))
        from (
          select s.id, s.user_id, u.email as user_email,
            coalesce(p.display_name, '') as user_display_name,
            s.plan_code, s.duration_months, s.status, s.list_price_inr,
            s.discount_inr, s.paid_inr, s.referral_code, s.created_at, s.starts_at, s.ends_at
          from public.subscriptions as s
          left join auth.users as u on u.id = s.user_id
          left join public.profiles as p on p.id = s.user_id
          order by s.created_at desc
          limit 50
        ) as recent
      ), '[]'::jsonb),
    'recent_payments',
      coalesce((
        select jsonb_agg(to_jsonb(recent))
        from (
          select t.id, t.subscription_id, t.user_id, u.email as user_email,
            coalesce(p.display_name, '') as user_display_name,
            t.provider, t.status, t.amount_inr, t.discount_inr, t.referral_code,
            t.created_at, t.settled_at
          from public.payment_transactions as t
          left join auth.users as u on u.id = t.user_id
          left join public.profiles as p on p.id = t.user_id
          order by t.created_at desc
          limit 50
        ) as recent
      ), '[]'::jsonb),
    'referral_attributions',
      (select count(*) from public.referral_attributions),
    'qualified_referrals',
      (select count(*) from public.referral_attributions where status = 'qualified'),
    'available_referral_rewards',
      (select count(*) from public.referral_rewards where status = 'available' and expires_at > now()),
    'recent_config_changes',
      coalesce((
        select jsonb_agg(to_jsonb(recent))
        from (
          select id, actor_user_id, config_type, config_key, old_value, new_value, changed_at
          from public.billing_config_audit
          order by changed_at desc
          limit 30
        ) as recent
      ), '[]'::jsonb)
  ) into summary;

  return summary;
end
$$;

revoke execute on function public.get_billing_admin_summary() from public, anon;
grant execute on function public.get_billing_admin_summary() to authenticated;

alter table public.premium_plans enable row level security;
alter table public.premium_plan_prices enable row level security;
alter table public.test_series_prices enable row level security;
alter table public.referral_settings enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.billing_config_audit enable row level security;

revoke all on public.premium_plans, public.premium_plan_prices, public.test_series_prices,
  public.referral_settings, public.subscriptions, public.payment_transactions,
  public.referral_codes, public.referral_attributions, public.referral_rewards,
  public.billing_config_audit
  from public, anon, authenticated;

grant select on public.premium_plans, public.premium_plan_prices,
  public.test_series_prices, public.referral_settings to anon, authenticated;
grant select, insert, update, delete on public.premium_plans,
  public.premium_plan_prices, public.test_series_prices, public.referral_settings
  to authenticated;
grant select on public.subscriptions, public.payment_transactions,
  public.referral_codes, public.referral_attributions, public.referral_rewards,
  public.billing_config_audit
  to authenticated;
grant select on public.premium_plans, public.premium_plan_prices,
  public.test_series_prices, public.referral_settings to service_role;
grant all on public.premium_plans, public.premium_plan_prices,
  public.test_series_prices, public.referral_settings, public.subscriptions,
  public.payment_transactions, public.referral_codes, public.referral_attributions,
  public.referral_rewards, public.billing_config_audit to service_role;

drop policy if exists "Anyone can read enabled premium plans" on public.premium_plans;
create policy "Anyone can read enabled premium plans"
  on public.premium_plans for select to anon, authenticated
  using (enabled);
drop policy if exists "Anyone can read premium plan prices" on public.premium_plan_prices;
create policy "Anyone can read premium plan prices"
  on public.premium_plan_prices for select to anon, authenticated using (true);
drop policy if exists "Anyone can read enabled test series prices" on public.test_series_prices;
create policy "Anyone can read enabled test series prices"
  on public.test_series_prices for select to anon, authenticated using (enabled);
drop policy if exists "Anyone can read referral settings" on public.referral_settings;
create policy "Anyone can read referral settings"
  on public.referral_settings for select to anon, authenticated using (true);

drop policy if exists "Billing admins manage premium plans" on public.premium_plans;
create policy "Billing admins manage premium plans"
  on public.premium_plans for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));
drop policy if exists "Billing admins manage plan prices" on public.premium_plan_prices;
create policy "Billing admins manage plan prices"
  on public.premium_plan_prices for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));
drop policy if exists "Billing admins manage test series prices" on public.test_series_prices;
create policy "Billing admins manage test series prices"
  on public.test_series_prices for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));
drop policy if exists "Billing admins manage referral settings" on public.referral_settings;
create policy "Billing admins manage referral settings"
  on public.referral_settings for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));

drop policy if exists "Billing admins read subscriptions" on public.subscriptions;
create policy "Billing admins read subscriptions"
  on public.subscriptions for select to authenticated
  using ((select public.is_billing_admin()));
drop policy if exists "Billing admins read payment transactions" on public.payment_transactions;
create policy "Billing admins read payment transactions"
  on public.payment_transactions for select to authenticated
  using ((select public.is_billing_admin()));
drop policy if exists "Billing admins read referral codes" on public.referral_codes;
create policy "Billing admins read referral codes"
  on public.referral_codes for select to authenticated
  using ((select public.is_billing_admin()));
drop policy if exists "Billing admins read referral attributions" on public.referral_attributions;
create policy "Billing admins read referral attributions"
  on public.referral_attributions for select to authenticated
  using ((select public.is_billing_admin()));
drop policy if exists "Billing admins read referral rewards" on public.referral_rewards;
create policy "Billing admins read referral rewards"
  on public.referral_rewards for select to authenticated
  using ((select public.is_billing_admin()));
drop policy if exists "Billing admins read billing audit" on public.billing_config_audit;
create policy "Billing admins read billing audit"
  on public.billing_config_audit for select to authenticated
  using ((select public.is_billing_admin()));

insert into public.premium_plans (plan_code, name, description, features, limits, sort_order)
values
  (
    'free', 'Basic', 'Unlimited PYQ practice with daily limits for papers, custom tests, and friends.',
    '[]'::jsonb,
    '{"friends":3,"previous_paper_daily":2,"custom_test_daily":5}'::jsonb,
    0
  ),
  (
    'pro', 'Pro', 'Complete access with no usage restrictions.',
    '[]'::jsonb,
    '{"friends":null,"previous_paper_daily":null,"custom_test_daily":null}'::jsonb,
    1
  )
on conflict (plan_code) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  limits = excluded.limits,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.premium_plan_prices (plan_code, duration_months, price_inr)
values
  ('free', 0, 0),
  ('pro', 12, 799)
on conflict (plan_code, duration_months) do update set
  price_inr = case
    when excluded.plan_code = 'free' then excluded.price_inr
    else public.premium_plan_prices.price_inr
  end,
  updated_at = now();

insert into public.referral_settings (singleton)
values (true)
on conflict (singleton) do nothing;
