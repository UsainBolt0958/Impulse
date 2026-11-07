begin;

create or replace function public.compact_duplicate_solution_aliases_recursive(
  p_value jsonb,
  p_in_question boolean
)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_key text;
  v_item jsonb;
begin
  if jsonb_typeof(p_value) = 'array' then
    select coalesce(
      jsonb_agg(
        public.compact_duplicate_solution_aliases_recursive(value, p_in_question)
        order by ordinal
      ),
      '[]'::jsonb
    )
    into v_result
    from jsonb_array_elements(p_value) with ordinality as item(value, ordinal);
    return v_result;
  end if;

  if jsonb_typeof(p_value) = 'object' then
    v_result := '{}'::jsonb;
    for v_key, v_item in select key, value from jsonb_each(p_value)
    loop
      if p_in_question
        and v_key = 'explanation'
        and jsonb_typeof(p_value->'solution') = 'string'
        and v_item = p_value->'solution' then
        continue;
      end if;
      v_result := v_result || jsonb_build_object(
        v_key,
        public.compact_duplicate_solution_aliases_recursive(
          v_item,
          p_in_question or v_key = 'questions'
        )
      );
    end loop;
    return v_result;
  end if;

  return p_value;
end
$$;

revoke all on function public.compact_duplicate_solution_aliases_recursive(jsonb, boolean)
  from public, anon, authenticated;

create or replace function public.compact_duplicate_solution_aliases(p_value jsonb)
returns jsonb
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
  select public.compact_duplicate_solution_aliases_recursive(p_value, false);
$$;

revoke all on function public.compact_duplicate_solution_aliases(jsonb) from public, anon, authenticated;
grant execute on function public.compact_duplicate_solution_aliases(jsonb) to service_role;

do $$
declare
  v_tests jsonb;
begin
  select content
  into v_tests
  from public.admin_content
  where key = 'tests.json'
  for update;

  if not found then
    raise exception 'tests.json is missing from admin_content; save hosted tests before running this migration';
  end if;

  if jsonb_typeof(v_tests) is distinct from 'array' then
    raise exception 'tests.json must be a JSON array; duplicate solution aliases were not compacted';
  end if;
end
$$;

with compacted as materialized (
  select
    key,
    public.compact_duplicate_solution_aliases(content) as content
  from public.admin_content
  where key = 'tests.json'
    and jsonb_typeof(content) = 'array'
)
update public.admin_content as document
set content = compacted.content,
    updated_at = now()
from compacted
where document.key = compacted.key
  and document.content is distinct from compacted.content;

do $$
begin
  if exists (
    select 1
    from public.admin_content
    where key = 'tests.json'
      and content is distinct from public.compact_duplicate_solution_aliases(content)
  ) then
    raise exception 'tests.json compaction verification failed; duplicate solution aliases remain';
  end if;
end
$$;

commit;
