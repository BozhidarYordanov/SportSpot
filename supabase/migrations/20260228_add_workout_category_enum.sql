-- Add workout_category enum and category column on workout_types with safe casting

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'workout_category'
      and n.nspname = 'public'
  ) then
    create type public.workout_category as enum (
      'Cardio',
      'Strength',
      'Mind & Body',
      'Combat',
      'Other'
    );
  end if;
end $$;

alter table public.workout_types
  add column if not exists category public.workout_category;

do $$
declare
  category_udt text;
begin
  select c.udt_name
  into category_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'workout_types'
    and c.column_name = 'category';

  if category_udt is distinct from 'workout_category' then
    execute $sql$
      alter table public.workout_types
      alter column category type public.workout_category
      using (
        case
          when category is null then 'Other'
          when lower(btrim(category::text)) = 'cardio' then 'Cardio'
          when lower(btrim(category::text)) = 'strength' then 'Strength'
          when lower(btrim(category::text)) in ('mind & body', 'mind and body', 'mind-body', 'mind/body') then 'Mind & Body'
          when lower(btrim(category::text)) = 'combat' then 'Combat'
          when lower(btrim(category::text)) = 'other' then 'Other'
          else 'Other'
        end
      )::public.workout_category
    $sql$;
  end if;
end $$;

update public.workout_types
set category = 'Other'
where category is null;

alter table public.workout_types
  alter column category set default 'Other';

alter table public.workout_types
  alter column category set not null;

create index if not exists workout_types_category_idx
  on public.workout_types (category);
