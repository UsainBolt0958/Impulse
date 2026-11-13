alter table public.premium_plans
  drop constraint if exists premium_plans_plan_code_check;
alter table public.premium_plans
  add constraint premium_plans_plan_code_check
  check (plan_code in ('free', 'lite', 'gold', 'ultimate', 'pro'));

update public.premium_plans
set name = 'Basic',
    description = 'Unlimited PYQ practice with daily limits for papers, custom tests, and friends.',
    features = '[]'::jsonb,
    limits = '{"friends":3,"previous_paper_daily":2,"custom_test_daily":5}'::jsonb,
    enabled = true,
    sort_order = 0,
    updated_at = now()
where plan_code = 'free';

update public.premium_plans
set enabled = false,
    updated_at = now()
where plan_code in ('lite', 'gold', 'ultimate');

delete from public.premium_plan_prices
where plan_code in ('lite', 'gold', 'ultimate');

insert into public.premium_plans (plan_code, name, description, features, limits, enabled, sort_order)
values (
  'pro',
  'Pro',
  'Complete access with no usage restrictions.',
  '[]'::jsonb,
  '{"friends":null,"previous_paper_daily":null,"custom_test_daily":null}'::jsonb,
  true,
  1
)
on conflict (plan_code) do update set
  name = excluded.name,
  description = excluded.description,
  features = excluded.features,
  limits = excluded.limits,
  enabled = true,
  sort_order = excluded.sort_order,
  updated_at = now();

insert into public.premium_plan_prices (plan_code, duration_months, price_inr)
values ('free', 0, 0), ('pro', 12, 799)
on conflict (plan_code, duration_months) do nothing;

create table if not exists public.basic_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  usage_date date not null,
  feature text not null check (feature in ('previous_paper', 'custom_test')),
  resource_id text not null check (char_length(resource_id) between 1 and 200),
  created_at timestamptz not null default now(),
  primary key (user_id, usage_date, feature, resource_id)
);

alter table public.basic_daily_usage enable row level security;
revoke all on public.basic_daily_usage from public, anon, authenticated;
grant all on public.basic_daily_usage to service_role;

create or replace function public.consume_basic_daily_quota(
  p_user_id uuid,
  p_feature text,
  p_resource_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit integer;
  today_ist date := (now() at time zone 'Asia/Kolkata')::date;
  clean_resource_id text := btrim(coalesce(p_resource_id, ''));
  used_count integer;
  inserted_resource_id text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'This quota check is only available to the API server.';
  end if;
  if p_user_id is null
    or p_feature is null
    or p_feature not in ('previous_paper', 'custom_test') then
    raise exception 'A valid user and quota feature are required.';
  end if;
  if char_length(clean_resource_id) not between 1 and 200 then
    raise exception 'A valid quota resource is required.';
  end if;

  delete from public.basic_daily_usage
  where user_id = p_user_id
    and usage_date < today_ist;

  if exists (
    select 1
    from public.pro_applications as application
    where application.user_id = p_user_id
      and application.status = 'approved'
      and application.expires_at > now()
  ) then
    return jsonb_build_object('allowed', true, 'plan', 'pro', 'remaining', null);
  end if;

  daily_limit := case p_feature
    when 'previous_paper' then 2
    when 'custom_test' then 5
  end;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'basic-quota:' || p_user_id::text || ':' || today_ist::text || ':' || p_feature,
      0
    )
  );

  insert into public.basic_daily_usage (user_id, usage_date, feature, resource_id)
  values (p_user_id, today_ist, p_feature, clean_resource_id)
  on conflict do nothing
  returning resource_id into inserted_resource_id;

  if not found then
    return jsonb_build_object('allowed', true, 'plan', 'basic', 'already_counted', true);
  end if;

  select count(*)::integer into used_count
  from public.basic_daily_usage
  where user_id = p_user_id
    and usage_date = today_ist
    and feature = p_feature;

  if used_count > daily_limit then
    delete from public.basic_daily_usage
    where user_id = p_user_id
      and usage_date = today_ist
      and feature = p_feature
      and resource_id = inserted_resource_id;
    return jsonb_build_object(
      'allowed', false,
      'plan', 'basic',
      'limit', daily_limit,
      'remaining', 0,
      'resets_at', (today_ist + 1)::text || 'T00:00:00+05:30'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'plan', 'basic',
    'limit', daily_limit,
    'remaining', daily_limit - used_count
  );
end
$$;

create table if not exists public.pro_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  user_email text not null,
  full_name text not null check (char_length(full_name) between 2 and 100),
  phone_number text not null check (phone_number ~ '^[6-9][0-9]{9}$'),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended', 'removed', 'expired')),
  submitted_at timestamptz not null default now(),
  expires_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create index if not exists pro_applications_user_submitted_idx
  on public.pro_applications (user_id, submitted_at desc);
create index if not exists pro_applications_status_submitted_idx
  on public.pro_applications (status, submitted_at desc);
create unique index if not exists pro_applications_one_current_per_user_idx
  on public.pro_applications (user_id)
  where status in ('pending', 'approved', 'suspended');

create table if not exists public.pro_application_events (
  id bigint generated always as identity primary key,
  application_id uuid not null references public.pro_applications (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  old_status text,
  new_status text not null,
  created_at timestamptz not null default now()
);

create or replace function public.enforce_basic_friend_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_id uuid;
  friend_count integer;
begin
  if new.status <> 'accepted'
    or (tg_op = 'UPDATE' and old.status = 'accepted') then
    return new;
  end if;

  for member_id in
    select participant_id
    from unnest(array[new.user_low, new.user_high]) as participants(participant_id)
    order by participant_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended('friend-limit:' || member_id::text, 0)
    );
  end loop;

  for member_id in
    select participant_id
    from unnest(array[new.user_low, new.user_high]) as participants(participant_id)
    order by participant_id
  loop
    if not exists (
      select 1
      from public.pro_applications as application
      where application.user_id = member_id
        and application.status = 'approved'
        and application.expires_at > now()
    ) then
      select count(*)::integer into friend_count
      from public.friendships as friendship
      where friendship.status = 'accepted'
        and (friendship.user_low = member_id or friendship.user_high = member_id);

      if friend_count >= 3 then
        raise exception 'The Basic plan allows up to 3 friends. Apply for Pro to add more.';
      end if;
    end if;
  end loop;

  return new;
end
$$;

drop trigger if exists enforce_basic_friend_limit on public.friendships;
create trigger enforce_basic_friend_limit
  before insert or update of status on public.friendships
  for each row execute function public.enforce_basic_friend_limit();

alter table public.pro_applications enable row level security;
alter table public.pro_application_events enable row level security;
revoke all on public.pro_applications, public.pro_application_events
  from public, anon, authenticated;
grant all on public.pro_applications, public.pro_application_events to service_role;

create or replace function public.submit_pro_application(
  p_full_name text,
  p_phone_number text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant_id uuid := auth.uid();
  applicant_email text;
  clean_name text := btrim(coalesce(p_full_name, ''));
  clean_phone text := regexp_replace(coalesce(p_phone_number, ''), '\D', '', 'g');
  application_record public.pro_applications;
begin
  if applicant_id is null then
    raise exception 'Sign in with Google before applying for Pro.';
  end if;

  if char_length(clean_name) not between 2 and 100 then
    raise exception 'Enter your name (2 to 100 characters).';
  end if;
  if clean_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian mobile number.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pro-application:' || applicant_id::text, 0)
  );

  select u.email into applicant_email
  from auth.users as u
  where u.id = applicant_id
    and u.email_confirmed_at is not null
    and exists (
      select 1 from auth.identities as i
      where i.user_id = u.id and i.provider = 'google'
    );
  if applicant_email is null then
    raise exception 'A confirmed Google account is required to apply for Pro.';
  end if;

  update public.pro_applications
  set status = 'expired',
        reviewed_at = now()
  where user_id = applicant_id
    and status in ('approved', 'suspended')
    and expires_at <= now();

  if exists (
    select 1 from public.pro_applications as current_application
    where current_application.user_id = applicant_id
      and current_application.status in ('pending', 'approved', 'suspended')
  ) then
    raise exception 'You already have a pending application or an active Pro membership.';
  end if;

  insert into public.pro_applications (user_id, user_email, full_name, phone_number)
  values (applicant_id, applicant_email, clean_name, clean_phone)
  returning * into application_record;

  insert into public.pro_application_events (application_id, actor_user_id, new_status)
  values (application_record.id, applicant_id, application_record.status);

  return jsonb_build_object(
    'status', case
      when application_record.status in ('approved', 'suspended')
        and application_record.expires_at <= now() then 'expired'
      else application_record.status
    end,
    'submitted_at', application_record.submitted_at,
    'expires_at', application_record.expires_at
  );
end
$$;

create or replace function public.get_my_pro_application_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  applicant_id uuid := auth.uid();
  application_record public.pro_applications;
begin
  if applicant_id is null then
    raise exception 'Sign in to check your Pro application.';
  end if;

  select * into application_record
  from public.pro_applications
  where user_id = applicant_id
  order by submitted_at desc
  limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'status', case
      when application_record.status in ('approved', 'suspended')
        and application_record.expires_at <= now() then 'expired'
      else application_record.status
    end,
    'submitted_at', application_record.submitted_at,
    'expires_at', application_record.expires_at
  );
end
$$;

create or replace function public.get_pro_applications_admin()
returns table (
  id uuid,
  user_id uuid,
  user_email text,
  full_name text,
  phone_number text,
  status text,
  submitted_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;

  return query
  select application.id, application.user_id, application.user_email,
    application.full_name, application.phone_number,
    case
      when application.status in ('approved', 'suspended')
        and application.expires_at <= now() then 'expired'
      else application.status
    end,
    application.submitted_at, application.expires_at
  from public.pro_applications as application
  order by application.submitted_at desc;
end
$$;

create or replace function public.admin_update_pro_application(
  p_application_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  application_record public.pro_applications;
  previous_status text;
  next_status text;
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;

  select * into application_record
  from public.pro_applications
  where id = p_application_id
  for update;
  if not found then raise exception 'Pro application not found.'; end if;
  previous_status := application_record.status;

  if p_action = 'approve' and application_record.status = 'pending' then
    next_status := 'approved';
  elsif p_action = 'reject' and application_record.status = 'pending' then
    next_status := 'rejected';
  elsif p_action = 'suspend' and application_record.status = 'approved' then
    next_status := 'suspended';
  elsif p_action = 'restore'
    and application_record.status = 'suspended'
    and application_record.expires_at > now() then
    next_status := 'approved';
  elsif p_action = 'remove' and application_record.status in ('approved', 'suspended') then
    next_status := 'removed';
  else
    raise exception 'This Pro application cannot be changed with the requested action.';
  end if;

  update public.pro_applications
  set status = next_status,
      expires_at = case
        when p_action = 'approve' then now() + interval '1 year'
        else expires_at
      end,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_application_id
  returning * into application_record;

  insert into public.pro_application_events (
    application_id, actor_user_id, old_status, new_status
  )
  values (
    application_record.id, auth.uid(), previous_status,
    application_record.status
  );

  return jsonb_build_object(
    'id', application_record.id,
    'status', application_record.status,
    'expires_at', application_record.expires_at
  );
end
$$;

revoke execute on function public.submit_pro_application(text, text)
  from public, anon;
grant execute on function public.submit_pro_application(text, text)
  to authenticated;
revoke execute on function public.get_my_pro_application_status()
  from public, anon;
grant execute on function public.get_my_pro_application_status()
  to authenticated;
revoke execute on function public.get_pro_applications_admin()
  from public, anon;
grant execute on function public.get_pro_applications_admin()
  to authenticated;
revoke execute on function public.admin_update_pro_application(uuid, text)
  from public, anon;
grant execute on function public.admin_update_pro_application(uuid, text)
  to authenticated;
revoke execute on function public.consume_basic_daily_quota(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.consume_basic_daily_quota(uuid, text, text)
  to service_role;

do $$
begin
  if to_regprocedure('public.create_upi_payment_order(text,uuid,text,text,smallint,text,integer)') is not null then
    execute 'revoke execute on function public.create_upi_payment_order(text, uuid, text, text, smallint, text, integer) from public, anon, authenticated, service_role';
  end if;
  if to_regprocedure('public.reconcile_upi_payment(text,text,integer,text)') is not null then
    execute 'revoke execute on function public.reconcile_upi_payment(text, text, integer, text) from public, anon, authenticated, service_role';
  end if;
end
$$;
