# Agent Prompt: Flag a Niggle Modal Polish

You are implementing a small, scoped polish pass for Steady's **Flag a niggle** bottom sheet.

This does **not** warrant a new Linear project. Treat it as one implementation branch. If a Linear trace is required, use a single issue, not a project.

## Design Source Of Truth

Use this wireframe as the reference:

- HTML: `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/niggle-picker-polish/index.html`
- Top screenshot: `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/niggle-picker-polish/niggle-picker-polish.png`
- Lower screenshot: `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/niggle-picker-polish/niggle-picker-polish-bottom.png`

Existing component to update:

- `/Users/cyprianbrytan/Projects/steady-v2-app/packages/app/components/sync-run/NigglePickerModal.tsx`

Existing domain model:

- `/Users/cyprianbrytan/Projects/steady-v2-app/packages/types/src/niggle.ts`

Do not implement the exploratory 3D/body-map concept. This task is only the polished chip-based modal.

## Required Skills

Before editing, explicitly load and follow:

- `$steady-feature-guardrails`
- `$engineering`
- `$design-system`
- `$brand-and-content`
- `$screens`
- `$colour-language`
- `$tdd`
- `$tests`
- `$branching-workflow`

## Product Intent

The current bottom sheet works but feels like a flat grid of options. Polish it without changing the feature.

The improved experience should:

- Keep the same modal flow: where, side, how bad, when.
- Keep the same data model and saved payload.
- Make body-part selection feel anatomically ordered instead of random.
- Make the modal feel calmer and more deliberate.
- Avoid adding new interactions, animations, 3D body selection, or medical complexity.

## Scope

In scope:

- Update the title/copy to the wireframe direction:
  - Main title: `What showed up?`
  - Supporting copy: concise, direct, non-medical.
- Reorganise body-part chips visually into top-to-bottom runner-friendly groups:
  - Back & hips: Back, Hip, Glute
  - Thigh & knee: Hamstring, Quad, Knee
  - Lower leg: Calf, Shin, Achilles
  - Foot & ankle: Foot, Ankle
  - Other: Something else
- Preserve the underlying body-part values from `BODY_PARTS`.
- Keep `Other` text input behaviour intact.
- Keep side options: Left, Right, Both / N/A.
- Keep severity options: Niggle, Mild, Moderate, Stopped.
- Keep `when` multi-select: Before, During, After.
- Add or preserve a compact sticky summary above the Add button if it can be done cleanly:
  - Example: `Right calf · mild · during`
  - It should update from the selected state.
  - It must not replace validation.
- Keep the Add button disabled until required fields are complete.

Out of scope:

- New body-part enum values.
- New persistence fields.
- New injury diagnosis logic.
- 3D mannequin/body map.
- Haptics.
- Linear project creation.
- Refactoring unrelated sync-run components.

## Colour Language

Yes, this design uses the colour language.

Use colour this way:

- Neutral parchment surfaces carry most of the UI.
- Body-part selected state uses clay because niggles are body caution.
- `Stopped` severity uses clay because it is injury/stop caution.
- `Mild` or `Moderate` selected states may use amber as a softer review/warning state.
- Side and `when` selection may use ink because those are structural choices, not semantic body-caution states.
- Labels stay muted.
- Do not colour every chip.
- Do not use metric colours here.
- Do not use session or phase colours here.

If the result feels too colourful, reduce severity colour first; preserve clay for body caution.

## Implementation Notes

Prefer small component-level helpers over a large inline map.

Suggested approach:

- Define a local grouped body-part structure in `NigglePickerModal.tsx`, using existing `BodyPart` values.
- Render group labels in a left rail and chips on the right, matching the wireframe hierarchy.
- Map display text `Something else` to existing value `other`.
- Preserve `BODY_PART_LABELS` for accessibility and fallback where useful.
- Rename only local style names as needed.
- Avoid touching `packages/types/src/niggle.ts` unless absolutely necessary.

## TDD / Test Expectations

Use a small TDD loop. Do not write broad snapshot tests.

Add or update tests through the public rendered modal behaviour:

- The modal renders body parts in grouped top-to-bottom order.
- Selecting a grouped body part still saves the same `bodyPart` value.
- `Something else` still requires text before Add is enabled.
- Side, severity, and when still save correctly.
- `when` remains multi-select and preserves canonical order.
- The Add button remains disabled until required selections are complete.

Do not test private style names. Do not assert every colour value in component tests.

If there is no focused modal test file, update the existing Run detail modal tests only where the behaviour is already covered.

## Branching And Verification

Follow `$branching-workflow`:

1. Start from `main`.
2. Create one short branch, for example `niggle-picker-polish` or the environment-required prefixed equivalent.
3. Keep changes scoped to this modal polish.
4. Commit only this work.
5. Run focused tests.
6. Run app typecheck if reasonable.
7. Merge back to `main` only after verification, then clean up the branch.

Be careful: the working tree may already contain unrelated user or prior-agent changes. Do not revert them and do not include unrelated files in the commit.

## Verification Checklist

Before handoff:

- Compare the implementation to the wireframe screenshots.
- Verify the modal still opens from Run detail.
- Verify a normal niggle can be added.
- Verify `Other` works.
- Verify multiple `when` values work.
- Verify Add remains disabled until the required fields are complete.
- Verify colour remains restrained and meaningful.
- Run focused tests and report the exact commands.

## Final Handoff

Report:

- Files changed.
- Behaviour preserved.
- Tests/checks run.
- Branch/commit/merge status.
- Any residual risk or follow-up.
