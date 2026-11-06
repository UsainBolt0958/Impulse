create table if not exists public.question_versions (
  question_id text not null,
  version integer not null check (version > 0),
  position integer not null check (position >= 0),
  is_current boolean not null default false,
  content jsonb not null,
  exam text generated always as (nullif(content->>'exam', '')) stored,
  subject text generated always as (nullif(content->>'subject', '')) stored,
  chapter text generated always as (nullif(content->>'chapter', '')) stored,
  difficulty text generated always as (nullif(content->>'difficulty', '')) stored,
  year text generated always as (nullif(content->>'year', '')) stored,
  question_type text generated always as (
    coalesce(nullif(content->>'question_type', ''), nullif(content->>'type', ''))
  ) stored,
  created_at timestamptz not null default now(),
  primary key (question_id, version)
);

create unique index if not exists question_versions_one_current
  on public.question_versions (question_id)
  where is_current;
create index if not exists question_versions_exam
  on public.question_versions (exam)
  where is_current;
create index if not exists question_versions_subject
  on public.question_versions (subject)
  where is_current;
create index if not exists question_versions_chapter
  on public.question_versions (chapter)
  where is_current;
create index if not exists question_versions_difficulty
  on public.question_versions (difficulty)
  where is_current;
create index if not exists question_versions_year
  on public.question_versions (year)
  where is_current;
create index if not exists question_versions_exam_subject_chapter
  on public.question_versions (exam, subject, chapter)
  where is_current;
create index if not exists question_versions_exam_subject_year
  on public.question_versions (exam, subject, year)
  where is_current;
create index if not exists question_versions_exam_subject_difficulty
  on public.question_versions (exam, subject, difficulty)
  where is_current;
create unique index if not exists question_versions_current_position
  on public.question_versions (position)
  where is_current;

alter table public.question_versions enable row level security;
revoke all on public.question_versions from public, anon, authenticated;
grant all on public.question_versions to service_role;

do $$
declare
  v_state jsonb;
begin
  select content into v_state
  from public.admin_content
  where key = 'admin-state.json';

  if not found then
    raise exception 'admin-state.json is missing from admin_content; save hosted admin content before running this migration';
  end if;

  if jsonb_typeof(v_state->'questions') is distinct from 'array' then
    raise exception 'admin-state.json questions must be a JSON array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_state->'questions') as question(value)
    where nullif(btrim(question.value->>'id'), '') is null
  ) then
    raise exception 'Every question must have a non-empty id before normalized storage can be enabled';
  end if;

  if (
    select count(*) <> count(distinct question.value->>'id')
    from jsonb_array_elements(v_state->'questions') as question(value)
  ) then
    raise exception 'Question ids must be unique before normalized storage can be enabled';
  end if;

  if jsonb_array_length(v_state->'questions') = 0
    and exists (select 1 from public.question_versions where is_current) then
    update public.admin_content
    set content = jsonb_set(content, '{questions}', '[]'::jsonb, true),
        updated_at = now()
    where key = 'admin-state.json';
    return;
  end if;

  insert into public.question_versions (
    question_id,
    version,
    position,
    is_current,
    content
  )
  select
    question.value->>'id',
    1,
    (question.ordinality - 1)::integer,
    true,
    question.value
  from jsonb_array_elements(v_state->'questions') with ordinality as question(value, ordinality)
  on conflict do nothing;

  if exists (
    select 1
    from jsonb_array_elements(v_state->'questions') with ordinality as question(value, ordinality)
    left join public.question_versions current_question
      on current_question.question_id = question.value->>'id'
      and current_question.is_current
    where current_question.question_id is null
      or current_question.content <> question.value
      or current_question.position <> (question.ordinality - 1)::integer
  ) then
    raise exception 'Question backfill verification failed; admin content was not compacted';
  end if;

  update public.question_versions
  set is_current = false
  where is_current
    and question_id not in (
      select question.value->>'id'
      from jsonb_array_elements(v_state->'questions') as question(value)
    );

  update public.admin_content
  set content = jsonb_set(content, '{questions}', '[]'::jsonb, true),
      updated_at = now()
  where key = 'admin-state.json';
end
$$;

create or replace function public.save_admin_state_and_question_versions(p_content jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question jsonb;
  v_question_id text;
  v_position integer;
  v_version integer;
  v_previous_content jsonb;
  v_ids text[] := array[]::text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service_role is required';
  end if;

  if jsonb_typeof(p_content) is distinct from 'object'
    or jsonb_typeof(p_content->'questions') is distinct from 'array' then
    raise exception 'Admin content must be an object with a questions array';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_content->'questions') as question(value)
    where nullif(btrim(question.value->>'id'), '') is null
  ) then
    raise exception 'Every question must have a non-empty id';
  end if;

  if (
    select count(*) <> count(distinct question.value->>'id')
    from jsonb_array_elements(p_content->'questions') as question(value)
  ) then
    raise exception 'Question ids must be unique';
  end if;

  insert into public.admin_content (key, content, updated_at)
  values (
    'admin-state.json',
    (p_content - 'questions') || jsonb_build_object('questions', '[]'::jsonb),
    now()
  )
  on conflict (key) do update
  set content = excluded.content,
      updated_at = excluded.updated_at;

  select coalesce(array_agg(question.value->>'id'), array[]::text[])
  into v_ids
  from jsonb_array_elements(p_content->'questions') as question(value);

  update public.question_versions
  set is_current = false
  where is_current
    and not (question_id = any(v_ids));

  for v_question, v_position in
    select question.value, (question.ordinality - 1)::integer
    from jsonb_array_elements(p_content->'questions') with ordinality as question(value, ordinality)
  loop
    v_question_id := v_question->>'id';
    v_previous_content := null;

    select content into v_previous_content
    from public.question_versions
    where question_id = v_question_id and is_current
    for update;

    if v_previous_content is not null and v_previous_content = v_question then
      update public.question_versions
      set position = v_position
      where question_id = v_question_id and is_current;
    else
      update public.question_versions
      set is_current = false
      where question_id = v_question_id and is_current;

      select coalesce(max(version), 0) + 1 into v_version
      from public.question_versions
      where question_id = v_question_id;

      insert into public.question_versions (
        question_id,
        version,
        position,
        is_current,
        content
      )
      values (v_question_id, v_version, v_position, true, v_question);
    end if;
  end loop;
end
$$;

revoke all on function public.save_admin_state_and_question_versions(jsonb) from public, anon, authenticated;
grant execute on function public.save_admin_state_and_question_versions(jsonb) to service_role;
