update public.admin_content as admin_state
set content = jsonb_set(
      admin_state.content,
      '{questions}',
      coalesce(
        (
          select jsonb_agg(question.content order by question.position)
          from public.question_versions as question
          where question.is_current
        ),
        '[]'::jsonb
      ),
      true
    ),
    updated_at = now()
where admin_state.key = 'admin-state.json';

do $$
begin
  if not exists (
    select 1
    from public.admin_content
    where key = 'admin-state.json'
  ) then
    raise exception 'admin-state.json is missing; legacy question storage was not restored';
  end if;
end
$$;
