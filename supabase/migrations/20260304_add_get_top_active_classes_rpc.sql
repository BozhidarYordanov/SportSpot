-- Return top active classes by upcoming schedules in a configurable window.
-- Primary sort: number of upcoming sessions (desc)
-- Secondary sort: total current bookings across those sessions (desc)

create or replace function public.get_top_active_classes(
  window_days integer default 7,
  result_limit integer default 4
)
returns table (
  slug varchar,
  title text,
  description text,
  duration_minutes integer,
  difficulty_level integer,
  category public.workout_category,
  upcoming_sessions_count bigint,
  current_bookings_count bigint
)
language sql
stable
as $$
  with upcoming as (
    select
      s.workout_type_id,
      count(*)::bigint as upcoming_sessions_count,
      coalesce(sum(s.enrolled_count), 0)::bigint as current_bookings_count
    from public.schedule s
    where s.start_time > now()
      and s.start_time <= (now() + make_interval(days => greatest(window_days, 1)))
    group by s.workout_type_id
  )
  select
    wt.slug,
    wt.title,
    wt.description,
    wt.duration_minutes,
    wt.difficulty_level,
    wt.category,
    u.upcoming_sessions_count,
    u.current_bookings_count
  from upcoming u
  join public.workout_types wt on wt.id = u.workout_type_id
  order by u.upcoming_sessions_count desc, u.current_bookings_count desc, wt.title asc
  limit greatest(result_limit, 1);
$$;
