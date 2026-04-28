alter table public.training_plans
  add column if not exists training_pace_profile jsonb;

alter table public.training_plans
  drop constraint if exists training_plans_training_pace_profile_object_check;

alter table public.training_plans
  add constraint training_plans_training_pace_profile_object_check
  check (
    training_pace_profile is null
    or jsonb_typeof(training_pace_profile) = 'object'
  );
