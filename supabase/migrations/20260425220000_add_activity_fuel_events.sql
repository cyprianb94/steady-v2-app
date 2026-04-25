alter table activities
  add column if not exists fuel_events jsonb not null default '[]'::jsonb;
