alter table public.niggles
  add column if not exists body_part_other_text text;

update public.niggles
set body_part_other_text = 'Other'
where body_part = 'other'
  and nullif(btrim(coalesce(body_part_other_text, '')), '') is null;

alter table public.niggles
  drop constraint if exists niggles_body_part_other_text_check;

alter table public.niggles
  add constraint niggles_body_part_other_text_check
  check (
    (
      body_part = 'other'
      and nullif(btrim(body_part_other_text), '') is not null
    )
    or (
      body_part <> 'other'
      and body_part_other_text is null
    )
  );

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
    value ->> 'when',
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
