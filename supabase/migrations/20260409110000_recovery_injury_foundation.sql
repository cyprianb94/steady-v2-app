alter table training_plans
  add column if not exists active_injury jsonb;
