-- Fix booking trigger behavior under RLS by running as definer

create or replace function public.handle_booking_enrollment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_capacity integer;
  target_enrolled integer;
begin
  if tg_op = 'INSERT' then
    select capacity, enrolled_count
      into target_capacity, target_enrolled
    from public.schedule
    where id = new.schedule_id
    for update;

    if target_capacity is null then
      raise exception 'Schedule % not found', new.schedule_id;
    end if;

    if target_enrolled >= target_capacity then
      raise exception 'Schedule % is fully booked', new.schedule_id;
    end if;

    update public.schedule
    set enrolled_count = enrolled_count + 1
    where id = new.schedule_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.schedule
    set enrolled_count = greatest(enrolled_count - 1, 0)
    where id = old.schedule_id;

    return old;
  elsif tg_op = 'UPDATE' then
    if new.schedule_id is distinct from old.schedule_id then
      update public.schedule
      set enrolled_count = greatest(enrolled_count - 1, 0)
      where id = old.schedule_id;

      select capacity, enrolled_count
        into target_capacity, target_enrolled
      from public.schedule
      where id = new.schedule_id
      for update;

      if target_capacity is null then
        raise exception 'Schedule % not found', new.schedule_id;
      end if;

      if target_enrolled >= target_capacity then
        raise exception 'Schedule % is fully booked', new.schedule_id;
      end if;

      update public.schedule
      set enrolled_count = enrolled_count + 1
      where id = new.schedule_id;
    end if;

    return new;
  end if;

  return null;
end;
$$;

revoke all on function public.handle_booking_enrollment_count() from public;
grant execute on function public.handle_booking_enrollment_count() to authenticated;
grant execute on function public.handle_booking_enrollment_count() to service_role;