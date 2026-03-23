-- 002_rls_policies.sql
-- Row Level Security: users can only access their own data

alter table users enable row level security;
alter table strava_tokens enable row level security;
alter table training_plans enable row level security;
alter table activities enable row level security;
alter table coach_conversations enable row level security;
alter table coach_messages enable row level security;
alter table plan_edits enable row level security;

-- Users: own row only
create policy "users_own" on users
  for all using (id = auth.uid());

-- Strava tokens: own row only
create policy "strava_tokens_own" on strava_tokens
  for all using (user_id = auth.uid());

-- Training plans: own rows only
create policy "training_plans_own" on training_plans
  for all using (user_id = auth.uid());

-- Activities: own rows only
create policy "activities_own" on activities
  for all using (user_id = auth.uid());

-- Coach conversations: own rows only
create policy "coach_conversations_own" on coach_conversations
  for all using (user_id = auth.uid());

-- Coach messages: via conversation ownership
create policy "coach_messages_own" on coach_messages
  for all using (
    conversation_id in (
      select id from coach_conversations where user_id = auth.uid()
    )
  );

-- Plan edits: via conversation ownership
create policy "plan_edits_own" on plan_edits
  for all using (
    conversation_id in (
      select id from coach_conversations where user_id = auth.uid()
    )
  );
