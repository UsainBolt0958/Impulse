create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_key text not null check (char_length(storage_key) <= 200),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, storage_key)
);

alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.user_data to authenticated;
revoke all on public.profiles from anon;
revoke all on public.user_data from anon;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users can read their own data" on public.user_data;
create policy "Users can read their own data"
  on public.user_data for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own data" on public.user_data;
create policy "Users can insert their own data"
  on public.user_data for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own data" on public.user_data;
create policy "Users can update their own data"
  on public.user_data for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own data" on public.user_data;
create policy "Users can delete their own data"
  on public.user_data for delete to authenticated
  using ((select auth.uid()) = user_id);
