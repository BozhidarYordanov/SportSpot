-- SportSpot initial database schema (Supabase / PostgreSQL)

create extension if not exists pgcrypto;

-- 1) Custom Types
create type public.user_role as enum ('admin', 'user');

-- 2) profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now()
);

-- 3) user_roles (RBAC)
create table public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.user_role not null default 'user',
  unique (user_id, role)
);

-- 4) workout_types
create table public.workout_types (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  duration_minutes integer not null check (duration_minutes > 0),
  difficulty_level integer not null check (difficulty_level between 1 and 3)
);

-- 5) schedule (calendar slots)
create table public.schedule (
  id uuid primary key default gen_random_uuid(),
  workout_type_id uuid not null references public.workout_types(id) on delete restrict,
  start_time timestamptz not null,
  trainer_name text not null,
  capacity integer not null check (capacity > 0),
  room text,
  enrolled_count integer not null default 0 check (enrolled_count >= 0 and enrolled_count <= capacity)
);

-- 6) bookings (reservations)
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.schedule(id) on delete cascade,
  user_id uuid null references public.profiles(id) on delete set null,
  guest_name text,
  guest_email text,
  guest_phone text,
  created_at timestamptz not null default now()
);

create unique index bookings_unique_user_per_schedule
  on public.bookings (schedule_id, user_id)
  where user_id is not null;

-- 7a) View: bookings + schedule status
create or replace view public.view_bookings_status as
select
  b.id,
  b.schedule_id,
  b.user_id,
  b.guest_name,
  b.guest_email,
  b.guest_phone,
  b.created_at,
  s.start_time,
  case
    when s.start_time < now() then 'past'
    else 'upcoming'
  end as session_status
from public.bookings b
join public.schedule s on s.id = b.schedule_id;

-- 7b) Trigger: auto-create profile + default role on auth signup
create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        email = excluded.email,
        phone = excluded.phone;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user_signup();

-- 7c) Trigger: maintain schedule.enrolled_count from bookings changes
create or replace function public.handle_booking_enrollment_count()
returns trigger
language plpgsql
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
      -- decrement old slot
      update public.schedule
      set enrolled_count = greatest(enrolled_count - 1, 0)
      where id = old.schedule_id;

      -- increment new slot with capacity guard
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

drop trigger if exists bookings_enrollment_count_trigger on public.bookings;
create trigger bookings_enrollment_count_trigger
after insert or delete or update of schedule_id on public.bookings
for each row
execute procedure public.handle_booking_enrollment_count();

-- 8) Security: RLS enabled + initial development policies (allow all)
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.workout_types enable row level security;
alter table public.schedule enable row level security;
alter table public.bookings enable row level security;

create policy profiles_dev_all
  on public.profiles
  for all
  using (true)
  with check (true);

create policy user_roles_dev_all
  on public.user_roles
  for all
  using (true)
  with check (true);

create policy workout_types_dev_all
  on public.workout_types
  for all
  using (true)
  with check (true);

create policy schedule_dev_all
  on public.schedule
  for all
  using (true)
  with check (true);

create policy bookings_dev_all
  on public.bookings
  for all
  using (true)
  with check (true);
