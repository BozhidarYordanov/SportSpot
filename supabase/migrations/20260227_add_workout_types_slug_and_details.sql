-- Add SEO/detail fields to workout_types and optimize slug lookup

alter table public.workout_types
  add column if not exists slug varchar,
  add column if not exists description_long text,
  add column if not exists suitable_for text,
  add column if not exists what_to_bring text;

-- Backfill slug from title and ensure deterministic uniqueness
with normalized as (
  select
    id,
    coalesce(
      nullif(regexp_replace(lower(trim(title)), '[^a-z0-9]+', '-', 'g'), ''),
      'workout'
    ) as base_slug
  from public.workout_types
), numbered as (
  select
    id,
    base_slug,
    row_number() over (partition by base_slug order by id) as slug_rank
  from normalized
)
update public.workout_types wt
set slug = case
  when n.slug_rank = 1 then n.base_slug
  else n.base_slug || '-' || n.slug_rank
end
from numbered n
where wt.id = n.id
  and (wt.slug is null or btrim(wt.slug) = '');

alter table public.workout_types
  alter column slug set not null;

create unique index if not exists workout_types_slug_idx
  on public.workout_types (slug);
