create table if not exists public.custom_test_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null check (char_length(session_id) between 1 and 100),
  metadata jsonb not null check (jsonb_typeof(metadata) = 'object'),
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  status text not null default 'active' check (status in ('active', 'completed')),
  updated_at timestamptz not null default now(),
  primary key (user_id),
  unique (user_id, session_id)
);

create table if not exists public.custom_test_session_questions (
  user_id uuid not null,
  session_id text not null,
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  created_at timestamptz not null default now(),
  primary key (user_id, session_id),
  foreign key (user_id, session_id)
    references public.custom_test_sessions (user_id, session_id)
    on delete cascade
);

alter table public.custom_test_sessions enable row level security;
alter table public.custom_test_session_questions enable row level security;

revoke all on public.custom_test_sessions from anon;
revoke all on public.custom_test_session_questions from anon;
grant select, insert, update, delete on public.custom_test_sessions to authenticated;
grant select, insert, update, delete on public.custom_test_session_questions to authenticated;

drop policy if exists "Users can manage their custom test sessions"
  on public.custom_test_sessions;
create policy "Users can manage their custom test sessions"
  on public.custom_test_sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can manage their custom test question snapshots"
  on public.custom_test_session_questions;
create policy "Users can manage their custom test question snapshots"
  on public.custom_test_session_questions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.save_custom_test_session(
  p_session_id text,
  p_metadata jsonb,
  p_progress jsonb,
  p_questions jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in before saving a custom test session.';
  end if;
  if p_session_id is null or char_length(p_session_id) not between 1 and 100 then
    raise exception 'The custom test session id is invalid.';
  end if;
  if jsonb_typeof(p_metadata) is distinct from 'object'
    or jsonb_typeof(p_progress) is distinct from 'object'
    or jsonb_typeof(p_questions) is distinct from 'array' then
    raise exception 'The custom test session snapshot is invalid.';
  end if;
  if jsonb_array_length(p_questions) = 0 then
    raise exception 'The custom test session snapshot is invalid.';
  end if;

  delete from public.custom_test_session_questions
  where user_id = v_user_id;

  insert into public.custom_test_sessions (
    user_id, session_id, metadata, progress, status, updated_at
  ) values (
    v_user_id, p_session_id, p_metadata, p_progress, 'active', now()
  )
  on conflict (user_id) do update set
    session_id = excluded.session_id,
    metadata = excluded.metadata,
    progress = excluded.progress,
    status = 'active',
    updated_at = excluded.updated_at;

  insert into public.custom_test_session_questions (user_id, session_id, questions)
  values (v_user_id, p_session_id, p_questions);
end;
$$;

create or replace function public.complete_custom_test_session(p_session_id text)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in before completing a custom test session.';
  end if;

  update public.custom_test_sessions
  set status = 'completed',
      metadata = '{}'::jsonb,
      progress = '{}'::jsonb,
      updated_at = now()
  where user_id = v_user_id
    and session_id = p_session_id;

  delete from public.custom_test_session_questions
  where user_id = v_user_id
    and session_id = p_session_id;
end;
$$;

revoke all on function public.save_custom_test_session(text, jsonb, jsonb, jsonb) from public;
revoke all on function public.complete_custom_test_session(text) from public;
grant execute on function public.save_custom_test_session(text, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.complete_custom_test_session(text) to authenticated;
