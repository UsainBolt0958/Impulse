begin;

do $$
begin
  if to_regclass('public.question_versions') is null then
    raise exception 'question_versions is missing; run normalized_question_storage.sql first';
  end if;

  perform 1
  from public.admin_content
  where key = 'tests.json'
  for update;

  if not found then
    raise exception 'tests.json is missing from admin_content; save hosted tests before running this migration';
  end if;

  if exists (
    select 1
    from public.admin_content
    where key = 'tests.json'
      and jsonb_typeof(content) is distinct from 'array'
  ) then
    raise exception 'tests.json must be a JSON array';
  end if;
end
$$;

create or replace function public.question_version_matches_test_question(
  p_question jsonb,
  p_content jsonb
)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    p_question->>'id' = p_content->>'id'
    and (case
      when upper(coalesce(p_question->>'type', '')) = 'NUMERIC' then 'NUM'
      else upper(coalesce(p_question->>'type', ''))
    end) = (case
      when upper(coalesce(p_content->>'type', p_content->>'question_type', '')) = 'NUMERIC' then 'NUM'
      else upper(coalesce(p_content->>'type', p_content->>'question_type', ''))
    end)
    and coalesce(p_question->>'text', '') = coalesce(
      p_content->>'question_text',
      p_content->>'question',
      p_content->>'text',
      ''
    )
    and coalesce(p_question->>'imageUrl', '') = coalesce(
      p_content->>'image',
      p_content->>'question_image',
      ''
    )
    and coalesce(p_question->>'solution', p_question->>'explanation', '') = coalesce(
      p_content->>'solution',
      p_content->>'explanation',
      ''
    )
    and coalesce(p_question->>'explanation', p_question->>'solution', '') = coalesce(
      p_content->>'explanation',
      p_content->>'solution',
      ''
    )
    and (case
      when upper(coalesce(p_question->>'type', '')) = 'MCQ'
        then upper(coalesce(p_question->>'answer', '')) = upper(coalesce(
          p_content->'correct_answer' #>> '{}',
          p_content->'answer' #>> '{}',
          ''
        ))
      else coalesce(p_question->>'answer', '') = coalesce(
        p_content->'correct_answer' #>> '{}',
        p_content->'answer' #>> '{}',
        ''
      )
    end)
    and (case
      when upper(coalesce(p_question->>'type', '')) <> 'MCQ' then true
      when jsonb_typeof(p_question->'options') is distinct from 'array' then false
      when jsonb_array_length(p_question->'options') <> 4 then false
      else
        p_question->'options'->0->>'key' = 'A'
        and p_question->'options'->1->>'key' = 'B'
        and p_question->'options'->2->>'key' = 'C'
        and p_question->'options'->3->>'key' = 'D'
        and coalesce(p_question->'options'->0->>'text', '') = coalesce(
          p_content->'options'->'A'->>'text',
          p_content->'options'->>'A',
          ''
        )
        and coalesce(p_question->'options'->1->>'text', '') = coalesce(
          p_content->'options'->'B'->>'text',
          p_content->'options'->>'B',
          ''
        )
        and coalesce(p_question->'options'->2->>'text', '') = coalesce(
          p_content->'options'->'C'->>'text',
          p_content->'options'->>'C',
          ''
        )
        and coalesce(p_question->'options'->3->>'text', '') = coalesce(
          p_content->'options'->'D'->>'text',
          p_content->'options'->>'D',
          ''
        )
        and coalesce(p_question->'options'->0->>'imageUrl', '') = coalesce(
          p_content->'option_images'->>'A',
          p_content->'options'->'A'->>'image',
          ''
        )
        and coalesce(p_question->'options'->1->>'imageUrl', '') = coalesce(
          p_content->'option_images'->>'B',
          p_content->'options'->'B'->>'image',
          ''
        )
        and coalesce(p_question->'options'->2->>'imageUrl', '') = coalesce(
          p_content->'option_images'->>'C',
          p_content->'options'->'C'->>'image',
          ''
        )
        and coalesce(p_question->'options'->3->>'imageUrl', '') = coalesce(
          p_content->'option_images'->>'D',
          p_content->'options'->'D'->>'image',
          ''
        )
    end);
$$;

revoke all on function public.question_version_matches_test_question(jsonb, jsonb)
  from public, anon, authenticated;

create or replace function public.compact_test_question_version_reference(p_question jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_version record;
begin
  if p_question ? 'questionRef' or nullif(p_question->>'id', '') is null then
    return p_question;
  end if;

  for v_version in
    select question.version, question.content
    from public.question_versions as question
    where question.question_id = p_question->>'id'
    order by question.version desc
  loop
    if public.question_version_matches_test_question(p_question, v_version.content) then
      return (p_question - array[
        'text',
        'imageUrl',
        'type',
        'options',
        'answer',
        'solution',
        'explanation'
      ]) || jsonb_build_object(
        'questionRef',
        jsonb_build_object(
          'questionId', p_question->>'id',
          'version', v_version.version
        )
      );
    end if;
  end loop;

  return p_question;
end
$$;

revoke all on function public.compact_test_question_version_reference(jsonb)
  from public, anon, authenticated;

create or replace function public.compact_test_document_question_references(p_tests jsonb)
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
    return p_tests;
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
              public.compact_test_question_version_reference(question.value)
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

revoke all on function public.compact_test_document_question_references(jsonb)
  from public, anon, authenticated;

update public.admin_content
set content = public.compact_test_document_question_references(content),
    updated_at = now()
where key = 'tests.json'
  and content is distinct from public.compact_test_document_question_references(content);

do $$
begin
  if exists (
    select 1
    from public.admin_content
    where key = 'tests.json'
      and content is distinct from public.compact_test_document_question_references(content)
  ) then
    raise exception 'Dynamic test question reference migration verification failed';
  end if;
end
$$;

create or replace function public.compact_test_result_question_reference(p_item jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_question_id text;
  v_question_text text;
  v_explanation text;
  v_correct_answer text;
  v_version record;
begin
  if p_item ? 'questionVersion' then
    return p_item;
  end if;

  v_question_id := coalesce(p_item->>'questionId', p_item->'question'->>'id');
  v_question_text := coalesce(
    p_item->>'questionText',
    p_item->'question'->>'question_text',
    p_item->'question'->>'question',
    p_item->'question'->>'text'
  );
  v_explanation := coalesce(
    p_item->>'explanation',
    p_item->'question'->>'explanation',
    p_item->'question'->>'solution'
  );
  v_correct_answer := coalesce(p_item->'correctAnswer' #>> '{}', '');

  if nullif(v_question_id, '') is null
    or nullif(v_correct_answer, '') is null
    or v_question_text is null
    or v_explanation is null then
    return p_item;
  end if;

  for v_version in
    select question.version, question.content
    from public.question_versions as question
    where question.question_id = v_question_id
    order by question.version desc
  loop
    if v_version.content->>'id' = v_question_id
      and v_question_text = coalesce(
        v_version.content->>'question_text',
        v_version.content->>'question',
        v_version.content->>'text',
        ''
      )
      and v_explanation = coalesce(
        v_version.content->>'explanation',
        v_version.content->>'solution',
        ''
      )
      and (case
        when upper(coalesce(v_version.content->>'type', v_version.content->>'question_type', '')) = 'MCQ'
          then upper(v_correct_answer) = upper(coalesce(
            v_version.content->'correct_answer' #>> '{}',
            v_version.content->'answer' #>> '{}',
            ''
          ))
        else v_correct_answer = coalesce(
          v_version.content->'correct_answer' #>> '{}',
          v_version.content->'answer' #>> '{}',
          ''
        )
      end) then
      return (p_item - array['question', 'questionText', 'explanation'])
        || jsonb_build_object(
          'questionVersion',
          jsonb_build_object(
            'questionId', v_question_id,
            'version', v_version.version
          )
        );
    end if;
  end loop;

  return p_item;
end
$$;

revoke all on function public.compact_test_result_question_reference(jsonb)
  from public, anon, authenticated;

create or replace function public.compact_custom_test_results(p_results jsonb)
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
          public.compact_test_result_question_reference(item.value)
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

revoke all on function public.compact_custom_test_results(jsonb)
  from public, anon, authenticated;

update public.user_data
set value = public.compact_custom_test_results(value),
    updated_at = now()
where storage_key = 'impulse_custom_test_results'
  and jsonb_typeof(value) = 'array'
  and value is distinct from public.compact_custom_test_results(value);

do $$
begin
  if exists (
    select 1
    from public.user_data
    where storage_key = 'impulse_custom_test_results'
      and value is distinct from public.compact_custom_test_results(value)
  ) then
    raise exception 'Custom-test review reference migration verification failed';
  end if;
end
$$;

drop function public.compact_custom_test_results(jsonb);
drop function public.compact_test_result_question_reference(jsonb);
drop function public.compact_test_document_question_references(jsonb);
drop function public.compact_test_question_version_reference(jsonb);
drop function public.question_version_matches_test_question(jsonb, jsonb);

commit;
