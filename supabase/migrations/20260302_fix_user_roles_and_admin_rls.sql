-- Align role source to user_roles and enforce admin-only CRUD on workout_types/schedule

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('admin', 'user');
  end if;
end $$;

create table if not exists public.user_roles (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.user_role not null default 'user',
  unique (user_id, role)
);

alter table public.user_roles
  add column if not exists user_id uuid;

alter table public.user_roles
  add column if not exists role public.user_role;

do $$
declare
  role_udt text;
begin
  select c.udt_name
  into role_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'user_roles'
    and c.column_name = 'role';

  if role_udt is distinct from 'user_role' then
    execute $sql$
      alter table public.user_roles
      alter column role type public.user_role
      using (
        case
          when lower(btrim(role::text)) = 'admin' then 'admin'
          else 'user'
        end
      )::public.user_role
    $sql$;
  end if;
end $$;

update public.user_roles
set role = 'user'
where role is null;

alter table public.user_roles
  alter column user_id set not null,
  alter column role set not null,
  alter column role set default 'user';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_user_id_fkey'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_roles_user_id_role_key'
      and conrelid = 'public.user_roles'::regclass
  ) then
    alter table public.user_roles
      add constraint user_roles_user_id_role_key unique (user_id, role);
  end if;
end $$;

create or replace function public.get_user_role(user_uuid uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select ur.role::text
  from auth.users au
  join public.user_roles ur on ur.user_id = au.id
  where au.id = user_uuid
  order by case ur.role::text when 'admin' then 0 else 1 end
  limit 1;
$$;

revoke all on function public.get_user_role(uuid) from public;
grant execute on function public.get_user_role(uuid) to authenticated;
grant execute on function public.get_user_role(uuid) to service_role;

alter table public.workout_types enable row level security;
alter table public.schedule enable row level security;

drop policy if exists workout_types_dev_all on public.workout_types;
drop policy if exists schedule_dev_all on public.schedule;

drop policy if exists workout_types_select_all on public.workout_types;
drop policy if exists workout_types_admin_insert on public.workout_types;
drop policy if exists workout_types_admin_update on public.workout_types;
drop policy if exists workout_types_admin_delete on public.workout_types;

drop policy if exists schedule_select_all on public.schedule;
drop policy if exists schedule_admin_insert on public.schedule;
drop policy if exists schedule_admin_update on public.schedule;
drop policy if exists schedule_admin_delete on public.schedule;

create policy workout_types_select_all
  on public.workout_types
  for select
  using (true);

create policy workout_types_admin_insert
  on public.workout_types
  for insert
  with check (public.get_user_role(auth.uid()) = 'admin');

create policy workout_types_admin_update
  on public.workout_types
  for update
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

create policy workout_types_admin_delete
  on public.workout_types
  for delete
  using (public.get_user_role(auth.uid()) = 'admin');

create policy schedule_select_all
  on public.schedule
  for select
  using (true);

create policy schedule_admin_insert
  on public.schedule
  for insert
  with check (public.get_user_role(auth.uid()) = 'admin');

create policy schedule_admin_update
  on public.schedule
  for update
  using (public.get_user_role(auth.uid()) = 'admin')
  with check (public.get_user_role(auth.uid()) = 'admin');

create policy schedule_admin_delete
  on public.schedule
  for delete
  using (public.get_user_role(auth.uid()) = 'admin');