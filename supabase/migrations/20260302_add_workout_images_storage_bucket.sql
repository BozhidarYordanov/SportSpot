-- Ensure public workout-images bucket exists and enforce admin-managed writes

insert into storage.buckets (id, name, public)
values ('workout-images', 'workout-images', true)
on conflict (id)
do update set
  name = excluded.name,
  public = excluded.public;

drop policy if exists "workout_images_public_read" on storage.objects;
drop policy if exists "workout_images_admin_insert" on storage.objects;
drop policy if exists "workout_images_admin_update" on storage.objects;
drop policy if exists "workout_images_admin_delete" on storage.objects;

create policy "workout_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'workout-images');

create policy "workout_images_admin_insert"
  on storage.objects
  for insert
  with check (
    bucket_id = 'workout-images'
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text = 'admin'
    )
  );

create policy "workout_images_admin_update"
  on storage.objects
  for update
  using (
    bucket_id = 'workout-images'
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text = 'admin'
    )
  )
  with check (
    bucket_id = 'workout-images'
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text = 'admin'
    )
  );

create policy "workout_images_admin_delete"
  on storage.objects
  for delete
  using (
    bucket_id = 'workout-images'
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role::text = 'admin'
    )
  );
