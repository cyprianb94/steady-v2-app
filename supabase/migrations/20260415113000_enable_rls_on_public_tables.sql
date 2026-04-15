-- Close Data API exposure on SQL-created public tables.
-- Owner-facing app data stays user-scoped; server-managed secrets stay server-only.

alter table public.profiles enable row level security;
alter table public.training_plans enable row level security;
alter table public.activities enable row level security;
alter table public.coach_conversations enable row level security;
alter table public.coach_messages enable row level security;
alter table public.plan_edits enable row level security;
alter table public.cross_training_log enable row level security;
alter table public.shoes enable row level security;
alter table public.niggles enable row level security;
alter table public.integration_tokens enable row level security;

drop policy if exists profiles_owner_all on public.profiles;
create policy profiles_owner_all
on public.profiles
for all
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = id
)
with check (
  auth.uid() is not null
  and auth.uid() = id
);

drop policy if exists training_plans_owner_all on public.training_plans;
create policy training_plans_owner_all
on public.training_plans
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

drop policy if exists activities_owner_all on public.activities;
create policy activities_owner_all
on public.activities
for all
to authenticated
using (
  auth.uid() is not null
  and auth.uid() = user_id
)
with check (
  auth.uid() is not null
  and auth.uid() = user_id
  and (
    shoe_id is null
    or exists (
      select 1
      from public.shoes
      where shoes.id = activities.shoe_id
        and shoes.user_id = auth.uid()
    )
  )
);

drop policy if exists coach_conversations_owner_all on public.coach_conversations;
create policy coach_conversations_owner_all
on public.coach_conversations
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

drop policy if exists coach_messages_owner_all on public.coach_messages;
create policy coach_messages_owner_all
on public.coach_messages
for all
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.coach_conversations
    where coach_conversations.id = coach_messages.conversation_id
      and coach_conversations.user_id = auth.uid()
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.coach_conversations
    where coach_conversations.id = coach_messages.conversation_id
      and coach_conversations.user_id = auth.uid()
  )
);

drop policy if exists plan_edits_owner_all on public.plan_edits;
create policy plan_edits_owner_all
on public.plan_edits
for all
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.coach_conversations
    where coach_conversations.id = plan_edits.conversation_id
      and coach_conversations.user_id = auth.uid()
  )
)
with check (
  auth.uid() is not null
  and exists (
    select 1
    from public.coach_conversations
    where coach_conversations.id = plan_edits.conversation_id
      and coach_conversations.user_id = auth.uid()
  )
  and exists (
    select 1
    from public.coach_messages
    where coach_messages.id = plan_edits.message_id
      and coach_messages.conversation_id = plan_edits.conversation_id
  )
);

drop policy if exists cross_training_log_owner_all on public.cross_training_log;
create policy cross_training_log_owner_all
on public.cross_training_log
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
    from public.training_plans
    where training_plans.id = cross_training_log.plan_id
      and training_plans.user_id = auth.uid()
  )
);

drop policy if exists shoes_owner_all on public.shoes;
create policy shoes_owner_all
on public.shoes
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

drop policy if exists niggles_owner_all on public.niggles;
create policy niggles_owner_all
on public.niggles
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
    where activities.id = niggles.activity_id
      and activities.user_id = auth.uid()
  )
);

-- integration_tokens is server-managed and should not be reachable from the client API.
revoke all on table public.integration_tokens from anon, authenticated;
grant select, insert, update, delete on table public.integration_tokens to service_role;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where pronamespace = 'public'::regnamespace
      and proname = 'replace_niggles_for_activity'
      and oidvectortypes(proargtypes) = 'uuid, uuid, jsonb'
  ) then
    revoke execute on function public.replace_niggles_for_activity(uuid, uuid, jsonb)
      from public, anon, authenticated;
    grant execute on function public.replace_niggles_for_activity(uuid, uuid, jsonb)
      to service_role;
  end if;
end
$$;
