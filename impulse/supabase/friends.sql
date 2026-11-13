alter table public.profiles
  add column if not exists username text;

do $$
begin
  alter table public.profiles
    add constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,24}$');
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

create table if not exists public.friendships (
  user_low uuid not null references auth.users (id) on delete cascade,
  user_high uuid not null references auth.users (id) on delete cascade,
  requested_by uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by = user_low or requested_by = user_high)
);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon;
revoke insert, update, delete on public.friendships from authenticated;
grant select on public.friendships to authenticated;

drop policy if exists "Users can read their own friend connections" on public.friendships;
create policy "Users can read their own friend connections"
  on public.friendships for select to authenticated
  using ((select auth.uid()) = user_low or (select auth.uid()) = user_high);

create or replace function public.search_profiles(search_query text)
returns table (id uuid, username text, display_name text, avatar_url text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_url
  from public.profiles as p
  where auth.uid() is not null
    and p.id <> auth.uid()
    and p.username is not null
    and char_length(trim(search_query)) between 3 and 24
    and left(p.username, char_length(trim(search_query))) = lower(trim(search_query))
  order by p.username
  limit 20
$$;

create or replace function public.send_friend_request(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  lower_user_id uuid;
  higher_user_id uuid;
  existing_status text;
  existing_requester uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to add friends.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot send a friend request to yourself.';
  end if;
  if not exists (
    select 1
    from public.profiles as p
    where p.id = target_user_id and p.username is not null
  ) then
    raise exception 'This user was not found.';
  end if;

  lower_user_id := least(current_user_id, target_user_id);
  higher_user_id := greatest(current_user_id, target_user_id);

  select f.status, f.requested_by
  into existing_status, existing_requester
  from public.friendships as f
  where f.user_low = lower_user_id and f.user_high = higher_user_id
  for update;

  if found then
    if existing_status = 'accepted' then
      raise exception 'You are already friends.';
    end if;
    if existing_requester = current_user_id then
      raise exception 'Your friend request is already pending.';
    end if;

    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
    return 'accepted';
  end if;

  insert into public.friendships (user_low, user_high, requested_by)
  values (lower_user_id, higher_user_id, current_user_id);
  return 'pending';
end
$$;

create or replace function public.respond_to_friend_request(target_user_id uuid, accept_request boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  lower_user_id uuid;
  higher_user_id uuid;
  existing_status text;
  existing_requester uuid;
begin
  if current_user_id is null then
    raise exception 'Sign in to respond to friend requests.';
  end if;
  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'This friend request is invalid.';
  end if;

  lower_user_id := least(current_user_id, target_user_id);
  higher_user_id := greatest(current_user_id, target_user_id);

  select f.status, f.requested_by
  into existing_status, existing_requester
  from public.friendships as f
  where f.user_low = lower_user_id and f.user_high = higher_user_id
  for update;

  if not found or existing_status <> 'pending' or existing_requester = current_user_id then
    raise exception 'This friend request is no longer available.';
  end if;

  if accept_request then
    update public.friendships
    set status = 'accepted', updated_at = now()
    where user_low = lower_user_id and user_high = higher_user_id;
  else
    delete from public.friendships
    where user_low = lower_user_id and user_high = higher_user_id;
  end if;
end
$$;

create or replace function public.get_my_friend_connections()
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  status text,
  requested_by uuid,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case when f.user_low = auth.uid() then f.user_high else f.user_low end,
    p.username,
    p.display_name,
    p.avatar_url,
    f.status,
    f.requested_by,
    f.created_at
  from public.friendships as f
  join public.profiles as p
    on p.id = case when f.user_low = auth.uid() then f.user_high else f.user_low end
  where auth.uid() is not null
    and (f.user_low = auth.uid() or f.user_high = auth.uid())
  order by f.created_at desc
$$;

create or replace function public.get_friend_dashboard(target_user_id uuid, client_time_zone text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  friend_profile record;
  stored_visibility jsonb;
  stored_attempts jsonb;
  append_only_attempts jsonb;
  visible_stats jsonb;
  dashboard jsonb;
begin
  if current_user_id is null then
    raise exception 'Sign in to view a friend profile.';
  end if;
  if target_user_id is null or target_user_id = current_user_id or not exists (
    select 1
    from public.friendships as f
    where f.status = 'accepted'
      and (
        (f.user_low = current_user_id and f.user_high = target_user_id)
        or (f.user_high = current_user_id and f.user_low = target_user_id)
      )
  ) then
    raise exception 'This friend profile is unavailable.';
  end if;

  select p.id, p.username, p.display_name, p.avatar_url
  into friend_profile
  from public.profiles as p
  where p.id = target_user_id;
  if not found then
    raise exception 'This friend profile is unavailable.';
  end if;

  select d.value
  into stored_visibility
  from public.user_data as d
  where d.user_id = target_user_id
    and d.storage_key = 'impulse_profile_stat_visibility';
  stored_visibility := coalesce(stored_visibility, '{}'::jsonb);
  if jsonb_typeof(stored_visibility) <> 'object' then
    stored_visibility := '{}'::jsonb;
  end if;

  select d.value
  into stored_attempts
  from public.user_data as d
  where d.user_id = target_user_id
    and d.storage_key = 'impulse_solved';
  stored_attempts := coalesce(stored_attempts, '[]'::jsonb);
  if jsonb_typeof(stored_attempts) <> 'array' then
    stored_attempts := '[]'::jsonb;
  end if;
  if to_regclass('public.study_attempts') is not null then
    execute 'select coalesce(jsonb_agg(attempt order by attempt_id), ''[]''::jsonb) from public.study_attempts where user_id = $1'
      into append_only_attempts using target_user_id;
    stored_attempts := stored_attempts || coalesce(append_only_attempts, '[]'::jsonb);
  end if;

  select jsonb_object_agg(setting.id, case
    when jsonb_typeof(stored_visibility -> setting.id) = 'boolean'
      then stored_visibility -> setting.id
    else 'true'::jsonb
  end)
  into visible_stats
  from (values
    ('problemsSolved'),
    ('activeDays'),
    ('longestStreak'),
    ('attemptsThisYear'),
    ('difficultyStats'),
    ('subjectRating'),
    ('yearlyActivity')
  ) as setting(id);

  with recursive attempt_values as (
    select distinct on (coalesce(
      nullif(item.value ->> 'attemptId', ''),
      nullif(item.value ->> 'attempt_id', ''),
      md5(item.value::text)
    ))
      item.ordinality::bigint as ordinal,
      item.value ->> 'question_id' as question_id,
      lower(trim(coalesce(item.value ->> 'subject', ''))) as subject,
      lower(trim(coalesce(item.value ->> 'difficulty', ''))) as difficulty,
      case item.value ->> 'is_correct'
        when 'true' then true
        when 'false' then false
        else null
      end as is_correct,
      nullif(item.value ->> 'timestamp', '')::timestamptz as attempted_at
    from jsonb_array_elements(stored_attempts) with ordinality as item(value, ordinality)
    where jsonb_typeof(item.value) = 'object'
    order by coalesce(
      nullif(item.value ->> 'attemptId', ''),
      nullif(item.value ->> 'attempt_id', ''),
      md5(item.value::text)
    ), item.ordinality
  ),
  attempts as (
    select *
    from attempt_values
    where attempted_at is not null
      and attempted_at <= now()
  ),
  ordered_attempts as (
    select
      row_number() over (order by attempted_at, ordinal)::bigint as attempt_number,
      *
    from attempts
  ),
  rating_steps(attempt_number, rating) as (
    select 0::bigint, 1000::bigint
    union all
    select
      attempt.attempt_number,
      greatest(0, previous.rating + case
        when attempt.is_correct is null
          or attempt.subject not in ('biology', 'chemistry', 'physics', 'math', 'mathematics', 'maths')
          or attempt.difficulty not in ('easy', 'medium', 'hard')
          then 0
        when attempt.is_correct then round(
          (case attempt.subject
            when 'biology' then 2
            when 'chemistry' then 5
            when 'physics' then 10
            else 20
          end) * (case attempt.difficulty
            when 'easy' then 1
            when 'medium' then 1.5
            else 2
          end)
        )::bigint
        else -floor(
          (case attempt.subject
            when 'biology' then 2
            when 'chemistry' then 5
            when 'physics' then 10
            else 20
          end) * (case attempt.difficulty
            when 'easy' then 1.5
            when 'medium' then 1
            else 0.5
          end) * (1 + previous.rating::numeric / 2000) + 0.5
        )::bigint
      end)::bigint
    from rating_steps as previous
    join ordered_attempts as attempt
      on attempt.attempt_number = previous.attempt_number + 1
  ),
  rating_changes as (
    select
      attempt.attempt_number,
      attempt.attempted_at,
      attempt.subject,
      previous.rating as old_rating,
      current.rating as new_rating
    from ordered_attempts as attempt
    join rating_steps as previous
      on previous.attempt_number = attempt.attempt_number - 1
    join rating_steps as current_step
      on current_step.attempt_number = attempt.attempt_number
    where current_step.rating <> previous.rating
  ),
  current_rating as (
    select rating
    from rating_steps
    order by attempt_number desc
    limit 1
  ),
  attempt_summary as (
    select
      count(*) filter (where is_correct) as correct_attempts,
      count(*) filter (where is_correct = false) as incorrect_attempts,
      count(distinct question_id) filter (where is_correct and question_id is not null) as problems_solved
    from attempts
  ),
  difficulty_summary as (
    select
      difficulty,
      count(distinct question_id) as attempted,
      count(distinct question_id) filter (where is_correct) as solved
    from attempts
    where question_id is not null and difficulty in ('easy', 'medium', 'hard')
    group by difficulty
  ),
  difficulty_values as (
    select
      setting.label,
      setting.difficulty,
      coalesce(summary.attempted, 0) as attempted,
      coalesce(summary.solved, 0) as solved,
      setting.position
    from (values
      ('Easy', 'easy', 1),
      ('Medium', 'medium', 2),
      ('Hard', 'hard', 3)
    ) as setting(label, difficulty, position)
    left join difficulty_summary as summary using (difficulty)
  ),
  subject_values as (
    select
      setting.label,
      coalesce(sum(change.new_rating - change.old_rating), 0) as points,
      setting.position
    from (values
      ('Biology', 'biology', 1),
      ('Chemistry', 'chemistry', 2),
      ('Physics', 'physics', 3),
      ('Mathematics', 'math', 4)
    ) as setting(label, subject, position)
    left join rating_changes as change
      on change.subject = setting.subject
        or (setting.subject = 'math' and change.subject in ('mathematics', 'maths'))
    group by setting.label, setting.position
  ),
  local_attempts as (
    select
      (attempted_at at time zone coalesce(nullif(client_time_zone, ''), 'UTC'))::date as activity_date,
      question_id,
      is_correct
    from attempts
  ),
  daily_activity as (
    select
      activity_date,
      count(*) as attempts,
      count(distinct question_id) filter (where is_correct and question_id is not null) as solved
    from local_attempts
    where activity_date between
      (now() at time zone coalesce(nullif(client_time_zone, ''), 'UTC'))::date - 364
      and (now() at time zone coalesce(nullif(client_time_zone, ''), 'UTC'))::date
    group by activity_date
  ),
  streak_groups as (
    select
      activity_date,
      activity_date - row_number() over (order by activity_date)::integer as streak_group
    from daily_activity
  ),
  activity_summary as (
    select
      count(*) as active_days,
      coalesce(sum(attempts), 0) as attempts,
      coalesce((select max(day_count) from (
        select count(*) as day_count
        from streak_groups
        group by streak_group
      ) as streak_lengths), 0) as longest_streak
    from daily_activity
  ),
  rating_history as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'timestamp', floor(extract(epoch from attempted_at) * 1000)::bigint,
      'rating', new_rating
    ) order by attempted_at, attempt_number), '[]'::jsonb) as events
    from rating_changes
    where attempted_at >= (
      date_trunc('year', now() at time zone coalesce(nullif(client_time_zone, ''), 'UTC'))
      at time zone coalesce(nullif(client_time_zone, ''), 'UTC')
    )
      or attempt_number = (
        select max(previous_change.attempt_number)
        from rating_changes as previous_change
        where previous_change.attempted_at < (
          date_trunc('year', now() at time zone coalesce(nullif(client_time_zone, ''), 'UTC'))
          at time zone coalesce(nullif(client_time_zone, ''), 'UTC')
        )
      )
  ),
  yearly_activity as (
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'date', activity_date,
      'attempts', case when visible_stats -> 'attemptsThisYear' = 'true'::jsonb then attempts end,
      'solved', solved
    )) order by activity_date), '[]'::jsonb) as days
    from daily_activity
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'id', friend_profile.id,
    'name', coalesce(nullif(friend_profile.display_name, ''), friend_profile.username),
    'username', friend_profile.username,
    'avatarUrl', friend_profile.avatar_url,
    'visibleStats', visible_stats,
    'dashboard', jsonb_strip_nulls(jsonb_build_object(
      'currentRating', (select rating from current_rating),
      'ratingEvents', (select events from rating_history),
      'profileStats', jsonb_strip_nulls(jsonb_build_object(
        'solved', case when visible_stats -> 'problemsSolved' = 'true'::jsonb
          then (select problems_solved from attempt_summary) end,
        'correctAttempts', case when visible_stats -> 'difficultyStats' = 'true'::jsonb
          then (select correct_attempts from attempt_summary) end,
        'incorrectAttempts', case when visible_stats -> 'difficultyStats' = 'true'::jsonb
          then (select incorrect_attempts from attempt_summary) end,
        'byDifficulty', case when visible_stats -> 'difficultyStats' = 'true'::jsonb
          then (select jsonb_agg(jsonb_build_object(
            'name', label,
            'attempted', attempted,
            'solved', solved
          ) order by position) from difficulty_values) end,
        'bySubject', case when visible_stats -> 'subjectRating' = 'true'::jsonb
          then (select jsonb_agg(jsonb_build_object(
            'subject', label,
            'points', points
          ) order by position) from subject_values) end
      )),
      'activity', jsonb_strip_nulls(jsonb_build_object(
        'activeDays', case when visible_stats -> 'activeDays' = 'true'::jsonb
          then (select active_days from activity_summary) end,
        'longestStreak', case when visible_stats -> 'longestStreak' = 'true'::jsonb
          then (select longest_streak from activity_summary) end,
        'attempts', case when visible_stats -> 'attemptsThisYear' = 'true'::jsonb
          then (select attempts from activity_summary) end,
        'days', case when visible_stats -> 'yearlyActivity' = 'true'::jsonb
          then (select days from yearly_activity) end
      ))
    ))
  ))
  into dashboard;

  return dashboard;
end
$$;

revoke execute on function public.search_profiles(text) from public, anon;
revoke execute on function public.send_friend_request(uuid) from public, anon;
revoke execute on function public.respond_to_friend_request(uuid, boolean) from public, anon;
revoke execute on function public.get_my_friend_connections() from public, anon;
revoke execute on function public.get_friend_dashboard(uuid, text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_to_friend_request(uuid, boolean) to authenticated;
grant execute on function public.get_my_friend_connections() to authenticated;
grant execute on function public.get_friend_dashboard(uuid, text) to authenticated;
