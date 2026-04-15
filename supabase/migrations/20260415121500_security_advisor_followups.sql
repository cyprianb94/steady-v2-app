-- Silence remaining advisor findings without widening access.

create or replace function public.replace_niggles_for_activity(
  p_activity_id uuid,
  p_user_id uuid,
  p_niggles jsonb
)
returns setof public.niggles
language plpgsql
set search_path = ''
as $$
begin
  delete from public.niggles
  where activity_id = p_activity_id;

  insert into public.niggles (
    user_id,
    activity_id,
    body_part,
    severity,
    niggle_when,
    side,
    created_at
  )
  select
    p_user_id,
    p_activity_id,
    value ->> 'bodyPart',
    value ->> 'severity',
    value ->> 'when',
    case
      when jsonb_typeof(value -> 'side') = 'null' then null
      else value ->> 'side'
    end,
    now() + ((ord - 1) * interval '1 millisecond')
  from jsonb_array_elements(coalesce(p_niggles, '[]'::jsonb)) with ordinality as entry(value, ord);

  return query
    select *
    from public.niggles
    where activity_id = p_activity_id
    order by created_at asc;
end;
$$;

drop policy if exists integration_tokens_no_client_access on public.integration_tokens;
create policy integration_tokens_no_client_access
on public.integration_tokens
for all
to anon, authenticated
using (false)
with check (false);
