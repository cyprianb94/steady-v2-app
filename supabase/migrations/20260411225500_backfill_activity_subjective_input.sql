with matched_subjective_input as (
  select
    session ->> 'actualActivityId' as activity_id,
    session -> 'subjectiveInput' as subjective_input
  from training_plans
  cross join lateral jsonb_array_elements(weeks) as week
  cross join lateral jsonb_array_elements(coalesce(week -> 'sessions', '[]'::jsonb)) as session
  where jsonb_typeof(session) = 'object'
    and session ? 'actualActivityId'
    and session ? 'subjectiveInput'
)
update activities
set subjective_input = matched_subjective_input.subjective_input
from matched_subjective_input
where activities.id::text = matched_subjective_input.activity_id
  and activities.subjective_input is null;
