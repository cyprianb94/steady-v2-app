create table if not exists cross_training_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id uuid not null references training_plans(id) on delete cascade,
  date date not null,
  type text not null,
  duration_minutes integer not null,
  created_at timestamptz not null default now(),
  constraint cross_training_log_type_check
    check (type in ('Cycling', 'Swimming', 'Strength', 'Yoga', 'Walking', 'Elliptical')),
  constraint cross_training_log_duration_check
    check (duration_minutes > 0)
);

create index if not exists cross_training_log_plan_date_idx
  on cross_training_log(plan_id, date asc);

create index if not exists cross_training_log_user_created_idx
  on cross_training_log(user_id, created_at desc);
