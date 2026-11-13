alter table public.profiles
  add column if not exists username text;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$');
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by = user_low or requested_by = user_high)
);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon;
revoke insert, update, delete on public.friendships from authenticated;
grant select on public.friendships to authenticated;

drop policy if exists "Users can read their own friend connections" on public.friendships;
create policy "Users can read their own friend connections"
  on public.friendships for select to authenticated
  using ((select auth.uid()) = user_low or (select auth.uid()) = user_high);

create or replace function public.search_profiles(search_query text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles as p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.username is not null
    and char_length(trim(search_query)) between 3 and 24
    and left(p.username, char_length(trim(search_query))) = lower(trim(search_query))
  order by p.username
  limit 20
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
    select 1
    from public.profiles as p
    where p.id = target_user_id and p.username is not null
  ) then
    raise exception 'This user was not found.';
  end if;

  lower_user_id := least(current_user_id, target_user_id);
  higher_user_id := greatest(current_user_id, target_user_id);

  select f.status, f.requested_by
  into existing_status, existing_requester
  from public.friendships as f
  where f.user_low = lower_user_id and f.user_high = higher_user_id
  for update;

  if found then
    if existing_status = 'accepted' then
      raise exception 'You are already friends.';
    end if;
    if existing_requester = current_user_id then
      raise exception 'Your friend request is already pending.';
    end if;

    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
    return 'accepted';
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

  select f.status, f.requested_by
  into existing_status, existing_requester
  from public.friendships as f
  where f.user_low = lower_user_id and f.user_high = higher_user_id
  for update;

  if not found or existing_status <> 'pending' or existing_requester = current_user_id then
    raise exception 'This friend request is no longer available.';
  end if;

  if accept_request then
    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
  else
    delete from public.friendships
    where user_low = lower_user_id and user_high = higher_user_id;
  end if;
end
$$;

create or replace function public.get_my_friend_connections()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  status text,
  requested_by uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when f.user_low = auth.uid() then f.user_high else f.user_low end,
    p.username,
    p.display_name,
    p.avatar_url,
    f.status,
    f.requested_by,
    f.created_at
  from public.friendships as f
  join public.profiles as p
    on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() is not null
    and (f.user_low = auth.uid() or f.user_high = auth.uid())
  order by f.created_at desc
$$;

revoke execute on function public.search_profiles(text) from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.get_my_friend_connections() from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.get_my_friend_connections() to authenticated;
