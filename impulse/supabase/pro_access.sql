create table if not exists public.pro_offer_settings (
  singleton boolean primary key default true check (singleton),
  regular_price_inr integer check (regular_price_inr is null or regular_price_inr >= 0),
  discounted_price_inr integer check (
    discounted_price_inr is null
    or (discounted_price_inr >= 0 and (regular_price_inr is null or discounted_price_inr <= regular_price_inr))
  ),
  card_style text not null default 'gradient' check (card_style in ('solid', 'gradient', 'animated')),
  color_one text not null default '#302770' check (color_one ~ '^#[0-9A-Fa-f]{6}$'),
  color_two text not null default '#7C3AED' check (color_two ~ '^#[0-9A-Fa-f]{6}$'),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.pro_offer_settings (singleton)
values (true)
on conflict (singleton) do nothing;

create table if not exists public.pro_access_batches (
  id uuid primary key default gen_random_uuid(),
  seed_key text,
  batch_name text not null unique check (char_length(batch_name) between 2 and 80),
  expires_on date not null,
  regular_price_inr integer not null check (regular_price_inr >= 0),
  discounted_price_inr integer check (
    discounted_price_inr is null
    or (discounted_price_inr >= 0 and discounted_price_inr <= regular_price_inr)
  ),
  enabled boolean not null default true,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pro_access_batches add column if not exists seed_key text;
create unique index if not exists pro_access_batches_seed_key_idx
  on public.pro_access_batches (seed_key);

insert into public.pro_access_batches (seed_key, batch_name, expires_on, regular_price_inr)
values
  ('batch-2027', 'Batch 2027', date '2027-07-31', 799),
  ('batch-2028', 'Batch 2028', date '2028-07-31', 1499)
on conflict (seed_key) do nothing;

create table if not exists public.pro_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  batch_id uuid references public.pro_access_batches (id) on delete set null,
  quoted_regular_price_inr integer,
  quoted_discounted_price_inr integer,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users (id) on delete set null
);

alter table public.pro_access_requests
  add column if not exists batch_id uuid references public.pro_access_batches (id) on delete set null;
alter table public.pro_access_requests
  add column if not exists quoted_regular_price_inr integer;
alter table public.pro_access_requests
  add column if not exists quoted_discounted_price_inr integer;

create index if not exists pro_access_requests_user_created_idx
  on public.pro_access_requests (user_id, created_at desc);
create index if not exists pro_access_requests_pending_idx
  on public.pro_access_requests (created_at desc)
  where status = 'pending';
create unique index if not exists pro_access_requests_one_pending_per_user_idx
  on public.pro_access_requests (user_id)
  where status = 'pending';

create table if not exists public.pro_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  batch_id uuid references public.pro_access_batches (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'suspended', 'revoked')),
  grant_source text not null default 'request' check (grant_source in ('request', 'manual')),
  last_request_id uuid references public.pro_access_requests (id) on delete set null,
  suspended_until timestamptz,
  expires_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'suspended' and suspended_until is not null) or status <> 'suspended')
);

alter table public.pro_access
  add column if not exists batch_id uuid references public.pro_access_batches (id) on delete set null;
alter table public.pro_access add column if not exists expires_at timestamptz;
update public.pro_access
set expires_at = created_at + interval '12 months'
where expires_at is null and status in ('active', 'suspended');

create table if not exists public.pro_daily_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('custom_test', 'previous_paper')),
  usage_date date not null,
  usage_count smallint not null check (usage_count >= 0),
  primary key (user_id, feature, usage_date)
);

alter table public.pro_offer_settings enable row level security;
alter table public.pro_access_batches enable row level security;
alter table public.pro_access_requests enable row level security;
alter table public.pro_access enable row level security;
alter table public.pro_daily_usage enable row level security;

revoke all on public.pro_offer_settings, public.pro_access_batches, public.pro_access_requests,
  public.pro_access, public.pro_daily_usage from public, anon, authenticated;
grant select on public.pro_offer_settings to anon, authenticated;
grant insert, update on public.pro_offer_settings to authenticated;
grant select on public.pro_access_batches to anon, authenticated;
grant insert, update on public.pro_access_batches to authenticated;
grant select on public.pro_access_requests to authenticated;
grant all on public.pro_offer_settings, public.pro_access_batches, public.pro_access_requests,
  public.pro_access, public.pro_daily_usage to service_role;

drop policy if exists "Anyone can read Pro offer settings" on public.pro_offer_settings;
create policy "Anyone can read Pro offer settings"
  on public.pro_offer_settings for select to anon, authenticated using (true);
drop policy if exists "Billing admins manage Pro offer settings" on public.pro_offer_settings;
create policy "Billing admins manage Pro offer settings"
  on public.pro_offer_settings for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));
drop policy if exists "Anyone can read available Pro batches" on public.pro_access_batches;
create policy "Anyone can read available Pro batches"
  on public.pro_access_batches for select to anon, authenticated
  using (enabled and expires_on >= (now() at time zone 'Asia/Kolkata')::date);
drop policy if exists "Billing admins manage Pro batches" on public.pro_access_batches;
create policy "Billing admins manage Pro batches"
  on public.pro_access_batches for all to authenticated
  using ((select public.is_billing_admin()))
  with check ((select public.is_billing_admin()));
drop policy if exists "Users read their own Pro access requests" on public.pro_access_requests;
create policy "Users read their own Pro access requests"
  on public.pro_access_requests for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_billing_admin()));

create or replace function public.pro_access_is_active(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pro_access as access
    where access.user_id = p_user_id
      and (access.expires_at is null or access.expires_at > now())
      and (
        access.status = 'active'
        or (access.status = 'suspended' and access.suspended_until <= now())
      )
  );
$$;

create or replace function public.has_pro_access(p_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and p_user_id <> auth.uid() then
    raise exception 'You can only check your own Pro access.';
  end if;

  return public.pro_access_is_active(p_user_id);
end
$$;

create or replace function public.get_my_pro_access_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'has_access', coalesce(public.has_pro_access(auth.uid()), false),
    'status', access.status,
    'expires_at', access.expires_at,
    'batch_name', batch.batch_name
  )
  from (select 1) as singleton
  left join public.pro_access as access on access.user_id = auth.uid()
  left join public.pro_access_batches as batch on batch.id = access.batch_id;
$$;

drop function if exists public.submit_pro_access_request(text, text, text);

create or replace function public.submit_pro_access_request(
  p_full_name text,
  p_phone text,
  p_batch_id uuid,
  p_description text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  request_id uuid;
  selected_batch public.pro_access_batches;
begin
  if current_user_id is null then
    raise exception 'Sign in before requesting Pro access.';
  end if;
  if public.has_pro_access(current_user_id) then
    raise exception 'This account already has Pro access.';
  end if;
  if char_length(trim(coalesce(p_full_name, ''))) not between 2 and 120 then
    raise exception 'Enter your full name (2–120 characters).';
  end if;
  if coalesce(p_phone, '') !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a valid 10-digit Indian phone number.';
  end if;
  if char_length(coalesce(p_description, '')) > 1000 then
    raise exception 'Keep the description to 1,000 characters or fewer.';
  end if;
  select * into selected_batch
  from public.pro_access_batches
  where id = p_batch_id and enabled;
  if not found then
    raise exception 'Choose an available Pro batch.';
  end if;
  if selected_batch.expires_on < (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'This Pro batch has expired. Choose another batch.';
  end if;
  if exists (
    select 1 from public.pro_access_requests
    where user_id = current_user_id and status = 'pending'
  ) then
    raise exception 'Your Pro request is already waiting for review.';
  end if;

  insert into public.pro_access_requests (
    user_id, batch_id, quoted_regular_price_inr, quoted_discounted_price_inr,
    full_name, phone, description
  )
  values (
    current_user_id, selected_batch.id, selected_batch.regular_price_inr,
    selected_batch.discounted_price_inr, trim(p_full_name), p_phone,
    trim(coalesce(p_description, ''))
  )
  returning id into request_id;

  return request_id;
end
$$;

create or replace function public.get_pro_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  overview jsonb;
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;

  select jsonb_build_object(
    'settings', (select to_jsonb(settings) from public.pro_offer_settings as settings where singleton),
    'batches', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.expires_on, item.batch_name)
      from (
        select batch.id, batch.batch_name, batch.expires_on, batch.regular_price_inr,
          batch.discounted_price_inr, batch.enabled, batch.updated_at
        from public.pro_access_batches as batch
      ) as item
    ), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.created_at)
      from (
        select request.id, request.user_id, request.full_name, request.phone,
          request.batch_id, request.quoted_regular_price_inr,
          request.quoted_discounted_price_inr, request.description,
          request.status, request.created_at, batch.batch_name, batch.expires_on,
          coalesce(nullif(profile.display_name, ''), auth_user.email, request.user_id::text) as account_name
        from public.pro_access_requests as request
        left join public.pro_access_batches as batch on batch.id = request.batch_id
        left join public.profiles as profile on profile.id = request.user_id
        left join auth.users as auth_user on auth_user.id = request.user_id
        where request.status = 'pending'
      ) as item
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(to_jsonb(item) order by item.updated_at desc)
      from (
        select access.user_id, access.batch_id, batch.batch_name,
          access.status, access.suspended_until, access.expires_at,
          access.grant_source, access.updated_at,
          coalesce(nullif(profile.display_name, ''), auth_user.email, access.user_id::text) as account_name,
          auth_user.email,
          request.full_name, request.phone
        from public.pro_access as access
        left join public.pro_access_batches as batch on batch.id = access.batch_id
        left join public.profiles as profile on profile.id = access.user_id
        left join auth.users as auth_user on auth_user.id = access.user_id
        left join public.pro_access_requests as request on request.id = access.last_request_id
        where access.status in ('active', 'suspended')
      ) as item
    ), '[]'::jsonb)
  ) into overview;

  return overview;
end
$$;

drop function if exists public.decide_pro_access_request(uuid, boolean);

create or replace function public.decide_pro_access_request(
  p_request_id uuid,
  p_approve boolean,
  p_batch_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_record public.pro_access_requests;
  selected_batch public.pro_access_batches;
  selected_batch_id uuid;
  selected_expires_at timestamptz;
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;

  select * into request_record
  from public.pro_access_requests
  where id = p_request_id
  for update;
  if not found or request_record.status <> 'pending' then
    raise exception 'This Pro request is no longer waiting for review.';
  end if;

  if p_approve then
    selected_batch_id := coalesce(request_record.batch_id, p_batch_id);
    if selected_batch_id is null then
      raise exception 'Choose a batch before approving this request.';
    end if;
    if request_record.batch_id is not null
      and p_batch_id is not null
      and request_record.batch_id <> p_batch_id
    then
      raise exception 'The selected batch does not match the request.';
    end if;

    select * into selected_batch
    from public.pro_access_batches
    where id = selected_batch_id;
    if not found then
      raise exception 'The requested Pro batch no longer exists.';
    end if;
    if selected_batch.expires_on < (now() at time zone 'Asia/Kolkata')::date then
      raise exception 'This Pro batch has expired and cannot be approved.';
    end if;
    selected_expires_at :=
      ((selected_batch.expires_on + 1)::timestamp at time zone 'Asia/Kolkata')
      - interval '1 microsecond';
  end if;

  update public.pro_access_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      decided_at = now(),
      decided_by = auth.uid(),
      batch_id = case when p_approve then selected_batch.id else batch_id end,
      quoted_regular_price_inr = case
        when p_approve then coalesce(quoted_regular_price_inr, selected_batch.regular_price_inr)
        else quoted_regular_price_inr
      end,
      quoted_discounted_price_inr = case
        when p_approve then coalesce(quoted_discounted_price_inr, selected_batch.discounted_price_inr)
        else quoted_discounted_price_inr
      end
  where id = p_request_id;

  if p_approve then
    insert into public.pro_access (
      user_id, batch_id, status, grant_source, last_request_id,
      suspended_until, expires_at, updated_by
    ) values (
      request_record.user_id, selected_batch.id, 'active', 'request', request_record.id,
      null, selected_expires_at, auth.uid()
    )
    on conflict (user_id) do update set
      batch_id = excluded.batch_id,
      status = 'active',
      grant_source = 'request',
      last_request_id = excluded.last_request_id,
      suspended_until = null,
      expires_at = excluded.expires_at,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;
end
$$;

create or replace function public.manage_pro_access(
  p_user_id uuid,
  p_action text,
  p_duration_days integer default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_billing_admin() then
    raise exception 'Billing administrator access is required.';
  end if;
  if p_action = 'suspend' then
    if p_duration_days is null or p_duration_days not between 1 and 3650 then
      raise exception 'Choose a suspension duration between 1 and 3,650 days.';
    end if;
    update public.pro_access
    set status = 'suspended',
        suspended_until = now() + make_interval(days => p_duration_days),
        updated_by = auth.uid(),
        updated_at = now()
    where user_id = p_user_id and status in ('active', 'suspended');
  elsif p_action = 'remove' then
    update public.pro_access
    set status = 'revoked', suspended_until = null,
        updated_by = auth.uid(), updated_at = now()
    where user_id = p_user_id and status in ('active', 'suspended');
  elsif p_action = 'restore' then
    update public.pro_access
    set status = 'active', suspended_until = null,
        updated_by = auth.uid(), updated_at = now()
    where user_id = p_user_id and status = 'suspended'
      and (expires_at is null or expires_at > now());
  else
    raise exception 'Unsupported Pro access action.';
  end if;

  if not found then
    raise exception 'The Pro account is no longer available for this action.';
  end if;
end
$$;

create or replace function public.consume_daily_feature(p_user_id uuid, p_feature text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  daily_limit smallint;
  current_usage smallint;
  today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;
  if p_feature = 'custom_test' then
    daily_limit := 5;
  elsif p_feature = 'previous_paper' then
    daily_limit := 3;
  else
    raise exception 'Unsupported daily feature.';
  end if;

  if public.has_pro_access(p_user_id) then
    return jsonb_build_object('allowed', true, 'unlimited', true);
  end if;

  insert into public.pro_daily_usage (user_id, feature, usage_date, usage_count)
  values (p_user_id, p_feature, today, 1)
  on conflict (user_id, feature, usage_date) do update
  set usage_count = public.pro_daily_usage.usage_count + 1
  where public.pro_daily_usage.usage_count < daily_limit
  returning usage_count into current_usage;

  if current_usage is null then
    select usage_count into current_usage
    from public.pro_daily_usage
    where user_id = p_user_id and feature = p_feature and usage_date = today;
    return jsonb_build_object(
      'allowed', false,
      'unlimited', false,
      'used', current_usage,
      'limit', daily_limit
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'unlimited', false,
    'used', current_usage,
    'limit', daily_limit
  );
end
$$;

create or replace function public.send_friend_request(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  lower_user_id uuid;
  higher_user_id uuid;
  existing_status text;
  existing_requester uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to add friends.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot send a friend request to yourself.';
  end if;
  if not exists (
    select 1 from public.profiles as profile
    where profile.id = target_user_id and profile.username is not null
  ) then
    raise exception 'This user was not found.';
  end if;

  lower_user_id := least(current_user_id, target_user_id);
  higher_user_id := greatest(current_user_id, target_user_id);
  perform pg_advisory_xact_lock(hashtextextended('friend-limit:' || lower_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('friend-limit:' || higher_user_id::text, 0));
  select friendship.status, friendship.requested_by
  into existing_status, existing_requester
  from public.friendships as friendship
  where friendship.user_low = lower_user_id and friendship.user_high = higher_user_id
  for update;

  if found then
    if existing_status = 'accepted' then
      raise exception 'You are already friends.';
    end if;
    if existing_requester = current_user_id then
      raise exception 'Your friend request is already pending.';
    end if;
    if not public.pro_access_is_active(current_user_id) and (
      select count(*) from public.friendships as friendship
      where (friendship.user_low = current_user_id or friendship.user_high = current_user_id)
        and (
          friendship.status = 'accepted'
          or (friendship.status = 'pending' and friendship.requested_by = current_user_id)
        )
    ) >= 3 then
      raise exception 'Basic accounts can have up to 3 friends. Upgrade to Pro for unlimited friends.';
    end if;
    if not public.pro_access_is_active(target_user_id) and (
      select count(*) from public.friendships as friendship
      where (friendship.user_low = target_user_id or friendship.user_high = target_user_id)
        and (
          friendship.status = 'accepted'
          or (friendship.status = 'pending' and friendship.requested_by = target_user_id)
        )
    ) >= 3 then
      raise exception 'The other account has reached its Basic friend limit.';
    end if;
    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
    return 'accepted';
  end if;

  if not public.pro_access_is_active(current_user_id) and (
    select count(*) from public.friendships as friendship
    where (friendship.user_low = current_user_id or friendship.user_high = current_user_id)
      and (
        friendship.status = 'accepted'
        or (friendship.status = 'pending' and friendship.requested_by = current_user_id)
      )
  ) >= 3 then
    raise exception 'Basic accounts can have up to 3 friends. Upgrade to Pro for unlimited friends.';
  end if;

  insert into public.friendships (user_low, user_high, requested_by)
  values (lower_user_id, higher_user_id, current_user_id);
  return 'pending';
end
$$;

create or replace function public.respond_to_friend_request(target_user_id uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  lower_user_id uuid;
  higher_user_id uuid;
  existing_status text;
  existing_requester uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to respond to friend requests.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'This friend request is invalid.';
  end if;

  lower_user_id := least(current_user_id, target_user_id);
  higher_user_id := greatest(current_user_id, target_user_id);
  perform pg_advisory_xact_lock(hashtextextended('friend-limit:' || lower_user_id::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('friend-limit:' || higher_user_id::text, 0));
  select friendship.status, friendship.requested_by
  into existing_status, existing_requester
  from public.friendships as friendship
  where friendship.user_low = lower_user_id and friendship.user_high = higher_user_id
  for update;

  if not found or existing_status <> 'pending' or existing_requester = current_user_id then
    raise exception 'This friend request is no longer available.';
  end if;

  if accept_request then
    if not public.pro_access_is_active(current_user_id) and (
      select count(*) from public.friendships as friendship
      where (friendship.user_low = current_user_id or friendship.user_high = current_user_id)
        and (
          friendship.status = 'accepted'
          or (friendship.status = 'pending' and friendship.requested_by = current_user_id)
        )
    ) >= 3 then
      raise exception 'Basic accounts can have up to 3 friends. Upgrade to Pro for unlimited friends.';
    end if;
    if not public.pro_access_is_active(existing_requester) and (
      select count(*) from public.friendships as friendship
      where (friendship.user_low = existing_requester or friendship.user_high = existing_requester)
        and (
          friendship.status = 'accepted'
          or (friendship.status = 'pending' and friendship.requested_by = existing_requester)
        )
    ) >= 3 then
      raise exception 'The other account has reached its Basic friend limit.';
    end if;
    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
  else
    delete from public.friendships
    where user_low = lower_user_id and user_high = higher_user_id;
  end if;
end
$$;

revoke execute on function public.has_pro_access(uuid) from public, anon;
grant execute on function public.has_pro_access(uuid) to authenticated, service_role;
revoke execute on function public.pro_access_is_active(uuid) from public, anon, authenticated;
revoke execute on function public.get_my_pro_access_status() from public, anon;
grant execute on function public.get_my_pro_access_status() to authenticated;
revoke execute on function public.submit_pro_access_request(text, text, uuid, text) from public, anon;
grant execute on function public.submit_pro_access_request(text, text, uuid, text) to authenticated;
revoke execute on function public.get_pro_admin_overview() from public, anon;
grant execute on function public.get_pro_admin_overview() to authenticated;
revoke execute on function public.decide_pro_access_request(uuid, boolean, uuid) from public, anon;
grant execute on function public.decide_pro_access_request(uuid, boolean, uuid) to authenticated;
revoke execute on function public.manage_pro_access(uuid, text, integer) from public, anon;
grant execute on function public.manage_pro_access(uuid, text, integer) to authenticated;
revoke execute on function public.consume_daily_feature(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_daily_feature(uuid, text) to service_role;
revoke execute on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
