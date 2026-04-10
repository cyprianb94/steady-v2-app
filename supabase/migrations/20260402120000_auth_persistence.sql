-- Auth and persistence schema for Steady v2.
-- PRD-aligned source of truth for Supabase CLI migrations.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  strava_athlete_id text,
  apple_health_connected boolean not null default false,
  garmin_athlete_id text,
  subscription_tier text not null default 'free',
  subscription_expires_at timestamptz,
  timezone text not null default 'UTC',
  units text not null default 'metric',
  created_at timestamptz not null default now(),
  constraint profiles_subscription_tier_check
    check (subscription_tier in ('free', 'pro')),
  constraint profiles_units_check
    check (units in ('metric', 'imperial'))
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into profiles (id, email, created_at)
select
  au.id,
  coalesce(au.email, ''),
  coalesce(au.created_at, now())
from auth.users au
on conflict (id) do update
  set email = excluded.email;

create table if not exists training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  race_name text not null,
  race_date date not null,
  race_distance text not null,
  target_time text not null,
  phases jsonb not null,
  progression_pct integer not null default 0,
  template_week jsonb not null,
  weeks jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  source text not null,
  external_id text,
  start_time timestamptz not null,
  distance numeric not null,
  duration integer not null,
  elevation_gain numeric,
  avg_pace numeric not null,
  avg_hr numeric,
  max_hr numeric,
  splits jsonb not null default '[]'::jsonb,
  subjective_input jsonb,
  matched_session_id text,
  created_at timestamptz not null default now()
);

create table if not exists coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  related_session_id text,
  related_week_number integer,
  title text not null,
  created_at timestamptz not null default now()
);

create table if not exists coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  attached_session_id text,
  plan_edit_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists plan_edits (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  message_id uuid not null references coach_messages(id) on delete cascade,
  session_id text not null,
  before jsonb not null,
  after jsonb not null,
  status text not null default 'proposed',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  constraint plan_edits_status_check
    check (status in ('proposed', 'applied', 'rejected'))
);

create unique index if not exists training_plans_active_per_user
  on training_plans(user_id)
  where is_active = true;

create index if not exists training_plans_user_created_idx
  on training_plans(user_id, created_at desc);

create unique index if not exists activities_source_external_id_unique
  on activities(source, external_id)
  where external_id is not null;

create index if not exists activities_user_start_idx
  on activities(user_id, start_time desc);

create index if not exists coach_conversations_user_created_idx
  on coach_conversations(user_id, created_at desc);

create index if not exists coach_messages_conversation_created_idx
  on coach_messages(conversation_id, created_at asc);

create index if not exists plan_edits_conversation_idx
  on plan_edits(conversation_id);
