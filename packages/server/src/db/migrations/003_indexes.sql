-- 003_indexes.sql
-- Performance indexes for common query patterns

-- Training plans: lookup by user
create index idx_training_plans_user_id on training_plans(user_id);

-- Activities: lookup by user + time range (common for sync and display)
create index idx_activities_user_id on activities(user_id);
create index idx_activities_user_start on activities(user_id, start_time desc);

-- Activities: dedup on external_id per source
create unique index idx_activities_external_unique on activities(user_id, source, external_id)
  where external_id is not null;

-- Coach conversations: lookup by user, ordered by recent
create index idx_coach_conversations_user on coach_conversations(user_id, created_at desc);

-- Coach messages: lookup by conversation
create index idx_coach_messages_conversation on coach_messages(conversation_id, created_at asc);

-- Plan edits: lookup by conversation and status
create index idx_plan_edits_conversation on plan_edits(conversation_id);
create index idx_plan_edits_status on plan_edits(status) where status = 'proposed';
