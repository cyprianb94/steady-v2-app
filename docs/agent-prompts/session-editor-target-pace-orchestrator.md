# Orchestrator Prompt: Session Editor Target Pace and Propagation Cleanup

You are an implementation orchestrator working in `/Users/cyprianbrytan/Projects/steady-v2-app`.

Your task is to implement the Session Editor target pace and propagation rules documented in:

- `docs/session-editor-target-pace-and-propagation.md`
- `wireframes/session-editor-target-pace/index.html`

You may spin additional explorer or worker agents if useful. If you do, give each worker a disjoint write scope and tell them they are not alone in the codebase. Do not duplicate work between agents.

## Required Skills

Load and follow these skills before coding:

- `steady-feature-guardrails`
- `engineering`
- `product`
- `brand-and-content`
- `design-system`
- `colour-language`
- `frontend-design`
- `plan-builder`
- `data-model`
- `screens`
- `interface-design`
- `deep-modules`
- `tests`
- `tdd`
- `branching-workflow`

Use the skills to preserve Steady's architecture, wording, colour semantics, notebook-row session editor pattern, and behavioural test style.

## Branching

Create a fresh branch from `main` before implementation.

Suggested branch:

`session-editor-training-pace-cleanup`

Keep the branch scoped to this work only.

## Product Rules

Implement these boundaries exactly:

- No global single/range preference.
- No per-session-type single/range preference.
- SessionEditor edits sessions only.
- Settings > Training paces edits reusable Training paces.
- Session pace edits never mutate Training paces.
- Training pace options in SessionEditor are selectable, not editable.
- Effort cues are secondary captions only in the pace row.
- Home remains non-editing.

User-facing vocabulary:

- Use `Training pace`, `Custom pace`, and `Custom range`.
- Avoid `manual`, `profile`, and `linked` in UI copy.
- Collapsed captions should look like:
  - `Threshold · Training pace`
  - `Race pace · Training pace`
  - `Custom pace`
  - `Custom range`

## Implementation Slices

Use TDD-style vertical tracer bullets. Do not write all tests first.

### Slice 1: Domain target semantics

Goal:

- Selecting a Training pace stores a Training pace target, not frozen numbers.
- Selecting a Custom pace/range stores a custom target.
- Editing distance, reps, rep length, warm-up, cool-down, or recovery preserves an existing Training pace target.

Likely files:

- `packages/app/features/plan-builder/session-editing.ts`
- `packages/types/src/lib/intensity-targets.ts`
- `packages/types/src/session.ts`
- tests in `packages/app/tests/session-editing.test.ts` or `packages/app/tests/session-editor.test.tsx`

### Slice 2: Target pace editor UI

Goal:

- Remove the visible Single/Range toggle.
- Render `Training paces` first as full-width two-line options.
- Render `Custom` below with wrapped one-line numeric chips, `Custom pace...`, and `Custom range...`.
- Custom range expands inline with `Faster end` and `Slower end`.
- Training pace rows show name plus numeric range/pace and lower-case effort cue.
- Custom inputs are easy to replace on focus.
- Header preview updates live.

Likely files:

- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/ui/EditableChipStrip.tsx` or a new small component if the existing primitive becomes too contorted
- `packages/app/lib/units.ts`
- tests in `packages/app/tests/session-editor.test.tsx`

Design:

- Preserve the existing notebook-row pattern.
- Use pace metric colour only as metric signal, not as broad decoration.
- Keep selected Training pace identity on the named option, not on a numeric midpoint chip.
- Collapsed rows may keep values neutral, but the currently expanded row should colour its primary value by metric namespace: distance cobalt, pace teal, time brass.
- Session type colour must remain session identity only.

### Slice 3: No-op detection and propagation copy/defaults

Goal:

- Do not show the propagation sheet when nothing materially changed.
- Update propagation copy:
  - `This session only`
  - `This session in remaining weeks`
  - `This session in this phase`
- Live Block default is `This session only`.
- Plan Builder default may remain `This session in remaining weeks`.
- Propagation remains same-day-slot based.
- Completed sessions stay protected.

Likely files:

- `packages/app/components/plan-builder/PropagateModal.tsx`
- `packages/app/app/(tabs)/block.tsx`
- `packages/app/app/onboarding/plan-builder/step-plan.tsx`
- `packages/types/src/lib/propagate-change.ts`
- tests for block/edit-session and plan-builder propagation flows

### Slice 4: Structural field propagation

Goal:

- Distance and reps preserve progression by delta.
- Rep length, warm-up, cool-down, and recovery copy exact values.
- Weekly volume totals update after propagated structural edits.
- Completed sessions are protected for all structural field propagation.
- Non-interval Distance expansion does not repeat the `Distance` label inside the editor body.
- The `km/min` toggle in Repetitions applies to rep length, not rep count, and should sit with the Rep length controls.
- Interval editor states include Cool-down as well as Warm-up.

Likely files:

- `packages/types/src/lib/propagate-change.ts`
- `packages/types/src/lib/session-km.ts`
- `packages/app/app/(tabs)/block.tsx`
- `packages/app/app/onboarding/plan-builder/step-plan.tsx`
- tests in `packages/types/tests/session-rearrange.test.ts` or a dedicated propagation test file

### Slice 5: Training paces Settings confirmation

Goal:

- Saving Training paces asks for confirmation when future sessions are affected.
- Copy:
  - Title: `Update Training paces?`
  - Body: `Future sessions using these Training paces will update. Custom paces and completed sessions will stay as they are.`
  - Button: `Update Training paces`
- No scope picker.
- Future sessions using Training paces update.
- Completed sessions and custom overrides do not.
- Affected count is optional if cheap.

Likely files:

- `packages/app/app/settings/training-paces.tsx`
- `packages/app/components/pace-profile/TrainingPaceProfileEditor.tsx`
- `packages/app/lib/plan-api.ts`
- `packages/server/src/trpc/plan.ts`
- `packages/types/src/lib/training-pace-profile-propagation.ts`
- tests in `packages/app/tests/training-paces-screen.test.tsx`, `packages/server/tests/plan-router.test.ts`, or `packages/types/tests/training-pace-profile-propagation.test.ts`

## Verification

Run the focused tests after each slice. At the end run:

- `npm run test --workspace packages/types -- --run`
- `npm run test --workspace packages/app -- --run`
- `npm run build:types`

If the full suite is too slow or blocked, run the most relevant focused tests and clearly report what was not run.

If a dev server is needed for visual verification, start it and inspect the relevant screens. Compare against:

- `wireframes/session-editor-target-pace/index.html`

## Linear Warm Trace

When finished, update Linear with:

- branch name
- summary of implemented slices
- tests run
- known gaps
- any follow-up issue needed

Do not mark work complete if any rule in `docs/session-editor-target-pace-and-propagation.md` is knowingly unimplemented without creating a follow-up.
