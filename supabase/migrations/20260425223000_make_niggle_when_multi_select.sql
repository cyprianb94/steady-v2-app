alter table public.niggles
  drop constraint if exists niggles_when_check;

alter table public.niggles
  alter column niggle_when type text[]
  using case
    when niggle_when is null then array[]::text[]
    else array[niggle_when]
  end;

alter table public.niggles
  alter column niggle_when set not null;

create or replace function public.niggle_when_values_are_valid(p_values text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_values is not null
    and cardinality(p_values) between 1 and 3
    and p_values <@ array['before', 'during', 'after']::text[]
    and cardinality(p_values) = (
      select count(distinct selected.value)::int
      from unnest(p_values) as selected(value)
    ), false);
$$;

alter table public.niggles
  add constraint niggles_when_check
  check (public.niggle_when_values_are_valid(niggle_when));

create or replace function public.replace_niggles_for_activity(
  p_activity_id uuid,
  p_user_id uuid,
  p_niggles jsonb
)
returns setof public.niggles
language plpgsql
set search_path = ''
as $$
begin
  delete from public.niggles
  where activity_id = p_activity_id;

  insert into public.niggles (
    user_id,
    activity_id,
    body_part,
    body_part_other_text,
    severity,
    niggle_when,
    side,
    created_at
  )
  select
    p_user_id,
    p_activity_id,
    value ->> 'bodyPart',
    case
      when value ->> 'bodyPart' = 'other'
        then nullif(btrim(coalesce(value ->> 'bodyPartOtherText', '')), '')
      else null
    end,
    value ->> 'severity',
    case
      when jsonb_typeof(value -> 'when') = 'array'
        then array(
          select selected.value
          from jsonb_array_elements_text(value -> 'when') as selected(value)
        )
      else array[value ->> 'when']::text[]
    end,
    case
      when jsonb_typeof(value -> 'side') = 'null' then null
      else value ->> 'side'
    end,
    now() + ((ord - 1) * interval '1 millisecond')
  from jsonb_array_elements(coalesce(p_niggles, '[]'::jsonb)) with ordinality as entry(value, ord);

  return query
    select *
    from public.niggles
    where activity_id = p_activity_id
    order by created_at asc;
end;
$$;
