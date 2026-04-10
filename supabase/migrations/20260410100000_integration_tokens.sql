create table if not exists integration_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  expires_at timestamptz not null,
  external_athlete_id text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  constraint integration_tokens_user_provider_unique unique (user_id, provider)
);
