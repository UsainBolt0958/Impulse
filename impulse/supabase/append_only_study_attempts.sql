create table if not exists public.study_attempts (
  user_id uuid not null references auth.users (id) on delete cascade,
  attempt_id text not null check (char_length(attempt_id) between 1 and 500),
  attempt jsonb not null check (jsonb_typeof(attempt) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, attempt_id)
);

alter table public.study_attempts enable row level security;
revoke all on public.study_attempts from public, anon, authenticated;
grant select, insert on public.study_attempts to authenticated;

drop policy if exists "Users can read their own study attempts"
  on public.study_attempts;
create policy "Users can read their own study attempts"
  on public.study_attempts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can append their own study attempts"
  on public.study_attempts;
create policy "Users can append their own study attempts"
  on public.study_attempts for insert to authenticated
  with check ((select auth.uid()) = user_id);

create or replace function public.append_study_attempts(p_attempts jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted integer;
begin
  if v_user_id is null then
    raise exception 'Sign in before saving study attempts.';
  end if;

  if jsonb_typeof(p_attempts) is distinct from 'array' then
    raise exception 'Study attempts must be a JSON array.';
  end if;

  if jsonb_array_length(p_attempts) > 500 then
    raise exception 'Study attempts must be an array containing at most 500 records.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_attempts) as item(value)
    where jsonb_typeof(item.value) is distinct from 'object'
      or char_length(coalesce(
        nullif(item.value->>'attemptId', ''),
        nullif(item.value->>'attempt_id', ''),
        md5(item.value::text)
      )) > 500
  ) then
    raise exception 'A study attempt is invalid.';
  end if;

  with inserted as (
    insert into public.study_attempts (user_id, attempt_id, attempt)
    select
      v_user_id,
      coalesce(
        nullif(item.value->>'attemptId', ''),
        nullif(item.value->>'attempt_id', ''),
        md5(item.value::text)
      ),
      item.value
    from jsonb_array_elements(p_attempts) as item(value)
    on conflict (user_id, attempt_id) do nothing
    returning 1
  )
  select count(*)::integer into v_inserted
  from inserted;

  return v_inserted;
end;
$$;

revoke all on function public.append_study_attempts(jsonb) from public, anon;
grant execute on function public.append_study_attempts(jsonb) to authenticated;
