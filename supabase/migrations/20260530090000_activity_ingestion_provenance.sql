alter table public.profiles
  add column if not exists primary_run_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_primary_run_source_check'
  ) then
    alter table public.profiles
      add constraint profiles_primary_run_source_check
      check (primary_run_source in ('apple_watch', 'garmin', 'strava'));
  end if;
end
$$;

alter table public.activities
  add column if not exists source_name text,
  add column if not exists source_device text,
  add column if not exists run_subtype text,
  add column if not exists avg_cadence numeric;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'activities_run_subtype_check'
  ) then
    alter table public.activities
      add constraint activities_run_subtype_check
      check (run_subtype in ('outdoor', 'trail', 'track', 'treadmill', 'unknown'));
  end if;
end
$$;

drop index if exists public.activities_source_external_id_unique;

create unique index if not exists activities_user_source_external_id_unique
  on public.activities(user_id, source, external_id)
  where external_id is not null;

create table if not exists public.provider_activity_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  source text not null,
  external_id text not null,
  source_name text,
  source_bundle_id text,
  source_device text,
  run_subtype text,
  data_quality_flags jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  constraint provider_activity_records_source_check
    check (source in ('apple_health', 'garmin', 'strava')),
  constraint provider_activity_records_run_subtype_check
    check (run_subtype is null or run_subtype in ('outdoor', 'trail', 'track', 'treadmill', 'unknown')),
  constraint provider_activity_records_user_source_external_unique
    unique (user_id, source, external_id)
);

create index if not exists provider_activity_records_activity_idx
  on public.provider_activity_records(activity_id);

create table if not exists public.activity_sync_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null,
  started_at timestamptz not null,
  finished_at timestamptz not null,
  fetched_count integer not null default 0,
  imported_count integer not null default 0,
  skipped_count integer not null default 0,
  upgraded_count integer not null default 0,
  error_count integer not null default 0,
  last_successful_sync_at timestamptz,
  constraint activity_sync_logs_source_check
    check (source in ('apple_health', 'garmin', 'strava')),
  constraint activity_sync_logs_counts_check
    check (
      fetched_count >= 0
      and imported_count >= 0
      and skipped_count >= 0
      and upgraded_count >= 0
      and error_count >= 0
    )
);

create index if not exists activity_sync_logs_user_source_finished_idx
  on public.activity_sync_logs(user_id, source, finished_at desc);

alter table public.provider_activity_records enable row level security;
alter table public.activity_sync_logs enable row level security;

drop policy if exists provider_activity_records_owner_all on public.provider_activity_records;
create policy provider_activity_records_owner_all
on public.provider_activity_records
for all
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = user_id
)
with check (
  auth.uid() is not null
  and auth.uid() = user_id
  and exists (
    select 1
    from public.activities
    where activities.id = provider_activity_records.activity_id
      and activities.user_id = auth.uid()
  )
);

drop policy if exists activity_sync_logs_owner_all on public.activity_sync_logs;
create policy activity_sync_logs_owner_all
on public.activity_sync_logs
for all
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = user_id
)
with check (
  auth.uid() is not null
  and auth.uid() = user_id
);
