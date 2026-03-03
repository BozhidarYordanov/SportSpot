-- Add profile avatar support (column + storage bucket + policies)

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id)
do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_user_insert_own_folder" on storage.objects;
drop policy if exists "avatars_user_update_own_folder" on storage.objects;
drop policy if exists "avatars_user_delete_own_folder" on storage.objects;

create policy "avatars_public_read"
  on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy "avatars_user_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_user_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_user_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Ensure profiles.id keeps cascading delete from auth.users
do $$
declare
  has_cascade_fk boolean;
  existing_fk record;
begin
  select exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and t.relname = 'profiles'
      and c.confrelid = 'auth.users'::regclass
      and c.confdeltype = 'c'
  )
  into has_cascade_fk;

  if not has_cascade_fk then
    for existing_fk in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.contype = 'f'
        and n.nspname = 'public'
        and t.relname = 'profiles'
        and c.confrelid = 'auth.users'::regclass
    loop
      execute format('alter table public.profiles drop constraint %I', existing_fk.conname);
    end loop;

    alter table public.profiles
      add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;