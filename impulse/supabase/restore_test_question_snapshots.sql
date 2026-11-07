begin;

do $$
begin
  if to_regclass('public.question_versions') is null then
    raise exception 'question_versions is missing; referenced test snapshots cannot be restored';
  end if;
  if not exists (
    select 1 from public.admin_content where key = 'tests.json'
  ) then
    raise exception 'tests.json is missing from admin_content';
  end if;
end
$$;

create or replace function public.restore_test_question_version_snapshot(p_question jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_reference jsonb := p_question->'questionRef';
  v_content jsonb;
  v_type text;
  v_options jsonb := '[]'::jsonb;
  v_answer text;
begin
  if v_reference is null then
    return p_question;
  end if;

  select content into v_content
  from public.question_versions
  where question_id = v_reference->>'questionId'
    and version = (v_reference->>'version')::integer;
  if not found or v_content->>'id' is distinct from v_reference->>'questionId' then
    raise exception 'Question version %:% is missing; snapshots were not restored',
      v_reference->>'questionId',
      v_reference->>'version';
  end if;

  v_type := upper(coalesce(v_content->>'type', v_content->>'question_type', ''));
  if v_type = 'NUMERIC' then
    v_type := 'NUM';
  end if;
  v_answer := coalesce(
    v_content->'correct_answer' #>> '{}',
    v_content->'answer' #>> '{}',
    ''
  );
  if v_type = 'MCQ' then
    select jsonb_agg(
      jsonb_build_object(
        'key', option.key,
        'text', coalesce(
          v_content->'options'->option.key->>'text',
          v_content->'options'->>option.key,
          ''
        ),
        'imageUrl', coalesce(
          v_content->'option_images'->>option.key,
          v_content->'options'->option.key->>'image',
          ''
        )
      )
      order by option.ordinality
    )
    into v_options
    from unnest(array['A', 'B', 'C', 'D']) with ordinality as option(key, ordinality);
  end if;

  return (p_question - 'questionRef') || jsonb_build_object(
    'id', v_reference->>'questionId',
    'text', coalesce(v_content->>'question_text', v_content->>'question', v_content->>'text', ''),
    'imageUrl', coalesce(v_content->>'image', v_content->>'question_image', ''),
    'type', v_type,
    'options', coalesce(v_options, '[]'::jsonb),
    'answer', v_answer,
    'solution', coalesce(v_content->>'solution', v_content->>'explanation', ''),
    'explanation', coalesce(v_content->>'explanation', v_content->>'solution', '')
  );
end
$$;

revoke all on function public.restore_test_question_version_snapshot(jsonb)
  from public, anon, authenticated;

create or replace function public.restore_test_document_question_snapshots(p_tests jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_tests jsonb := '[]'::jsonb;
  v_test jsonb;
  v_sections jsonb;
  v_section jsonb;
  v_questions jsonb;
begin
  if jsonb_typeof(p_tests) is distinct from 'array' then
    raise exception 'tests.json must be a JSON array';
  end if;

  for v_test in
    select item.value
    from jsonb_array_elements(p_tests) with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    if jsonb_typeof(v_test->'sections') = 'array' then
      v_sections := '[]'::jsonb;
      for v_section in
        select item.value
        from jsonb_array_elements(v_test->'sections') with ordinality as item(value, ordinality)
        order by item.ordinality
      loop
        if jsonb_typeof(v_section->'questions') = 'array' then
          select coalesce(
            jsonb_agg(
              public.restore_test_question_version_snapshot(question.value)
              order by question.ordinality
            ),
            '[]'::jsonb
          )
          into v_questions
          from jsonb_array_elements(v_section->'questions')
            with ordinality as question(value, ordinality);
          v_section := jsonb_set(v_section, '{questions}', v_questions, true);
        end if;
        v_sections := v_sections || jsonb_build_array(v_section);
      end loop;
      v_test := jsonb_set(v_test, '{sections}', v_sections, true);
    end if;
    v_tests := v_tests || jsonb_build_array(v_test);
  end loop;
  return v_tests;
end
$$;

revoke all on function public.restore_test_document_question_snapshots(jsonb)
  from public, anon, authenticated;

update public.admin_content
set content = public.restore_test_document_question_snapshots(content),
    updated_at = now()
where key = 'tests.json';

create or replace function public.restore_test_result_question_snapshot(p_item jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_reference jsonb := p_item->'questionVersion';
  v_content jsonb;
begin
  if v_reference is null then
    return p_item;
  end if;

  select content into v_content
  from public.question_versions
  where question_id = v_reference->>'questionId'
    and version = (v_reference->>'version')::integer;
  if not found or v_content->>'id' is distinct from v_reference->>'questionId' then
    raise exception 'Question version %:% is missing; result snapshots were not restored',
      v_reference->>'questionId',
      v_reference->>'version';
  end if;

  return (p_item - 'questionVersion') || jsonb_build_object(
    'questionText', coalesce(v_content->>'question_text', v_content->>'question', v_content->>'text', ''),
    'explanation', coalesce(v_content->>'explanation', v_content->>'solution', '')
  );
end
$$;

revoke all on function public.restore_test_result_question_snapshot(jsonb)
  from public, anon, authenticated;

create or replace function public.restore_custom_test_result_snapshots(p_results jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_questions jsonb;
begin
  if jsonb_typeof(p_results) is distinct from 'array' then
    return p_results;
  end if;

  for v_result in
    select item.value
    from jsonb_array_elements(p_results) with ordinality as item(value, ordinality)
    order by item.ordinality
  loop
    if jsonb_typeof(v_result->'questionResults') = 'array' then
      select coalesce(
        jsonb_agg(
          public.restore_test_result_question_snapshot(item.value)
          order by item.ordinality
        ),
        '[]'::jsonb
      )
      into v_questions
      from jsonb_array_elements(v_result->'questionResults')
        with ordinality as item(value, ordinality);
      v_result := jsonb_set(v_result, '{questionResults}', v_questions, true);
    end if;
    v_results := v_results || jsonb_build_array(v_result);
  end loop;
  return v_results;
end
$$;

revoke all on function public.restore_custom_test_result_snapshots(jsonb)
  from public, anon, authenticated;

update public.user_data
set value = public.restore_custom_test_result_snapshots(value),
    updated_at = now()
where storage_key = 'impulse_custom_test_results'
  and value is distinct from public.restore_custom_test_result_snapshots(value);

do $$
begin
  if exists (
    select 1
    from public.admin_content
    where key = 'tests.json'
      and content::text like '%"questionRef"%'
  ) then
    raise exception 'Test question snapshot rollback verification failed';
  end if;

  if exists (
    select 1
    from public.user_data
    where storage_key = 'impulse_custom_test_results'
      and value::text like '%"questionVersion"%'
  ) then
    raise exception 'Custom-test result snapshot rollback verification failed';
  end if;
end
$$;

drop function public.restore_custom_test_result_snapshots(jsonb);
drop function public.restore_test_result_question_snapshot(jsonb);
drop function public.restore_test_document_question_snapshots(jsonb);
drop function public.restore_test_question_version_snapshot(jsonb);

commit;
