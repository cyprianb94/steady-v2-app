alter table public.training_plans
  add column if not exists progression_every_weeks integer not null default 2;

alter table public.training_plans
  drop constraint if exists training_plans_progression_every_weeks_check;

alter table public.training_plans
  add constraint training_plans_progression_every_weeks_check
  check (progression_every_weeks between 1 and 12);
