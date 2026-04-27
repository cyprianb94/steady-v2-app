alter table public.profiles
  add column if not exists weekly_volume_metric text not null default 'distance';

alter table public.profiles
  add constraint profiles_weekly_volume_metric_check
  check (weekly_volume_metric in ('time', 'distance'));
