-- 001_initial_schema.sql
-- Core tables for Steady v2

create extension if not exists "uuid-ossp";

-- Users
create table users (
  id uuid primary key default uuid_generate_v4(),
  email text unique not null,
  created_at timestamptz not null default now(),
  strava_athlete_id text,
  apple_health_connected boolean not null default false,
  garmin_athlete_id text,
  subscription_tier text not null default 'free',
  subscription_expires_at timestamptz,
  timezone text not null default 'UTC',
  units text not null default 'metric'
);

-- Strava tokens (separate table to isolate sensitive data)
create table strava_tokens (
  user_id uuid primary key references users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

-- Training plans
create table training_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  race_name text not null,
  race_date date not null,
  race_distance text not null,
  target_time text not null,
  phases jsonb not null,
  progression_pct integer not null default 0,
  template_week jsonb not null,
  weeks jsonb not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Activities
create table activities (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  source text not null,
  external_id text,
  start_time timestamptz not null,
  distance numeric not null,
  duration integer not null,
  elevation_gain numeric,
  avg_pace numeric not null,
  avg_hr numeric,
  max_hr numeric,
  splits jsonb not null default '[]',
  subjective_input jsonb,
  matched_session_id text,
  created_at timestamptz not null default now()
);

-- Coach conversations
create table coach_conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null,
  related_session_id text,
  related_week_number integer,
  title text not null,
  created_at timestamptz not null default now()
);

-- Coach messages
create table coach_messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  role text not null,
  content text not null,
  attached_session_id text,
  plan_edit_id uuid,
  created_at timestamptz not null default now()
);

-- Plan edits
create table plan_edits (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references coach_conversations(id) on delete cascade,
  message_id uuid not null references coach_messages(id) on delete cascade,
  session_id text not null,
  before_state jsonb not null,
  after_state jsonb not null,
  status text not null default 'proposed',
  applied_at timestamptz,
  created_at timestamptz not null default now()
);
