create table if not exists shoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  strava_gear_id text,
  brand text not null,
  model text not null,
  nickname text,
  retired boolean not null default false,
  retire_at_km numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shoes_user_strava_gear_unique unique (user_id, strava_gear_id)
);

alter table activities
  add column if not exists shoe_id uuid references shoes(id) on delete set null;

create index if not exists shoes_user_created_idx
  on shoes(user_id, created_at desc);

create index if not exists activities_shoe_idx
  on activities(shoe_id);
