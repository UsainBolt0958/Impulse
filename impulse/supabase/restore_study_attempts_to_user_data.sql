do $$
begin
  if exists (
    select 1
    from public.user_data
    where storage_key = 'impulse_solved'
      and jsonb_typeof(value) is distinct from 'array'
  ) then
    raise exception 'A legacy impulse_solved value is not an array; no data was restored';
  end if;
end
$$;

with all_attempts as (
  select
    legacy.user_id,
    item.value as attempt,
    0 as source_order,
    item.ordinality as item_order,
    coalesce(
      nullif(item.value->>'attemptId', ''),
      nullif(item.value->>'attempt_id', ''),
      md5(item.value::text)
    ) as attempt_id
  from public.user_data as legacy
  cross join lateral jsonb_array_elements(legacy.value)
    with ordinality as item(value, ordinality)
  where legacy.storage_key = 'impulse_solved'

  union all

  select
    saved.user_id,
    saved.attempt,
    1 as source_order,
    row_number() over (
      partition by saved.user_id
      order by saved.created_at, saved.attempt_id
    ) as item_order,
    saved.attempt_id
  from public.study_attempts as saved
),
deduplicated as (
  select distinct on (user_id, attempt_id)
    user_id,
    attempt,
    source_order,
    item_order
  from all_attempts
  order by user_id, attempt_id, source_order, item_order
),
restored as (
  select
    user_id,
    jsonb_agg(attempt order by source_order, item_order) as value
  from deduplicated
  group by user_id
)
insert into public.user_data (user_id, storage_key, value, updated_at)
select user_id, 'impulse_solved', value, now()
from restored
on conflict (user_id, storage_key) do update
set value = excluded.value,
    updated_at = excluded.updated_at;
