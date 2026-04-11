create table if not exists niggles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  body_part text not null,
  severity text not null,
  niggle_when text not null,
  side text,
  created_at timestamptz not null default now(),
  constraint niggles_body_part_check
    check (body_part in ('calf', 'knee', 'hamstring', 'quad', 'hip', 'glute', 'foot', 'shin', 'ankle', 'achilles', 'back', 'other')),
  constraint niggles_severity_check
    check (severity in ('niggle', 'mild', 'moderate', 'stop')),
  constraint niggles_when_check
    check (niggle_when in ('before', 'during', 'after')),
  constraint niggles_side_check
    check (side in ('left', 'right') or side is null)
);

create index if not exists niggles_user_created_idx
  on niggles(user_id, created_at desc);

create index if not exists niggles_activity_idx
  on niggles(activity_id);

create or replace function replace_niggles_for_activity(
  p_activity_id uuid,
  p_user_id uuid,
  p_niggles jsonb
)
returns setof niggles
language plpgsql
as $$
begin
  delete from niggles
  where activity_id = p_activity_id;

  insert into niggles (
    user_id,
    activity_id,
    body_part,
    severity,
    niggle_when,
    side,
    created_at
  )
  select
    p_user_id,
    p_activity_id,
    value ->> 'bodyPart',
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
    from niggles
    where activity_id = p_activity_id
    order by created_at asc;
end;
$$;
