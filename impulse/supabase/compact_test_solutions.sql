create or replace function public.compact_duplicate_solution_aliases(p_value jsonb)
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
      jsonb_agg(public.compact_duplicate_solution_aliases(value) order by ordinal),
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
      if v_key = 'explanation'
        and jsonb_typeof(p_value->'solution') = 'string'
        and v_item = p_value->'solution' then
        continue;
      end if;
      v_result := v_result || jsonb_build_object(
        v_key,
        public.compact_duplicate_solution_aliases(v_item)
      );
    end loop;
    return v_result;
  end if;

  return p_value;
end
$$;

revoke all on function public.compact_duplicate_solution_aliases(jsonb) from public, anon, authenticated;
grant execute on function public.compact_duplicate_solution_aliases(jsonb) to service_role;

update public.admin_content
set content = public.compact_duplicate_solution_aliases(content),
    updated_at = now()
where key = 'tests.json'
  and jsonb_typeof(content) = 'array';
