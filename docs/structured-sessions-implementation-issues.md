# Implementation Issue Plan: Structured Sessions and Recovery Runs

Status: ready to convert into Linear issues
Date: 2026-04-30
Linear project: Structured Sessions and Recovery Runs
PRD: `docs/structured-sessions-and-recovery-runs-prd.md`
QA plan: `docs/structured-sessions-implementation-qa.md`
Wireframes: `wireframes/structured-sessions-recovery/index.html`

## Note

Linear blocked direct issue creation because the workspace has exceeded its free issue limit. This document is the issue plan to convert into Linear issues once that limit is cleared.

## Dependency Map

1. Domain model and persistence foundation
2. Volume, summary, focus, and demand helpers - blocked by 1
3. Recovery role and colour language - blocked by 1
4. Simple session editor entry points - blocked by 1, 2, 3
5. Run Structure editor v1 - blocked by 1, 2
6. Onboarding and generated-plan integration - blocked by 4, 5
7. Block review, week rows, and home display - blocked by 2, 3, 5
8. Guardrails and intensity distribution - blocked by 2, 7
9. Planned-vs-actual and Steady AI context - blocked by 2, 5, 7
10. QA hardening and release sign-off - blocked by 1-9

## 1. Add Structured-Session Domain Model And Backwards-Compatible Persistence

Type: AFK
Priority: High
Estimate: 5
Blocked by: None

### What to build

Add the shared data-model foundation for structured sessions while preserving every existing plan shape.

This should cover `RECOVERY`, `plannedVolume`, `planNote`, and optional `runStructure` on planned sessions. `runStructure` should support v1 segment kinds, one-level repeat groups, progressions, mixed distance/time units, and seconds-level short durations.

Likely areas:

- `packages/types/src/session.ts`
- shared validators and normalizers
- `packages/types/src/index.ts`
- server plan persistence paths
- strict switch statements over `SessionType`

### Acceptance Criteria

- [ ] `SessionType` includes `RECOVERY` without breaking existing sessions.
- [ ] `PlannedSession` supports `plannedVolume`, `planNote`, and `runStructure` as optional fields.
- [ ] Run structure supports `WARMUP`, `RUN`, `RECOVERY`, `FLOAT`, `REST`, `STRIDE`, and `COOLDOWN`.
- [ ] Repeat groups support one level only.
- [ ] Nested repeat groups are rejected or impossible to construct in v1.
- [ ] Segment time volume supports seconds internally.
- [ ] Legacy sessions normalize, load, and save without requiring new fields.
- [ ] Server and local plan save/load paths preserve the new fields.
- [ ] Derived values are not stored as source-of-truth session fields.

### Tests

- [ ] Legacy session normalization.
- [ ] Valid and invalid run structures.
- [ ] Seconds-level segment volume.
- [ ] One-level repeat groups and nested-repeat rejection.
- [ ] Server/app persistence of new fields.

## 2. Add Structured Volume, Summary, Focus, And Demand Helpers

Type: AFK
Priority: High
Estimate: 5
Blocked by: 1

### What to build

Add shared helpers that make structured sessions usable outside the editor: honest volume totals, compact summaries, focus labels, demand classification, and intensity distribution inputs.

`sessionKm` must remain backwards-compatible. New helpers should support exact kilometres, estimated kilometres, planned minutes, and structured seconds without pretending estimates are exact.

Likely areas:

- `packages/types/src/lib/session-km.ts`
- new structured-session helper module
- `packages/types/src/lib/block-review.ts`
- app/server formatting helpers where shared output is needed

### Acceptance Criteria

- [ ] Existing kilometre totals keep working.
- [ ] A richer volume helper distinguishes exact km, estimated km, planned min, and structured seconds.
- [ ] Mixed-unit sessions produce honest partial totals.
- [ ] Structure summaries render canonical examples from the PRD.
- [ ] Focus derivation handles long-run race blocks, easy strides, cruise intervals, progressions, fartlek ladders, and recovery runs.
- [ ] Demand derivation treats a long easy run differently from an embedded-quality long run.
- [ ] Intensity distribution can use segment-level data when present and session-level fallback otherwise.

### Tests

- [ ] Volume helper tests for exact and estimated output.
- [ ] Summary formatter tests for all PRD acceptance examples.
- [ ] Focus and demand tests.
- [ ] Backwards-compatible `sessionKm` tests.

## 3. Add Recovery Role And Colour Language Across Core UI

Type: AFK
Priority: High
Estimate: 3
Blocked by: 1

### What to build

Make `Recovery` a first-class session role across existing app surfaces, not a label on `Easy`.

Use a muted lavender session token related to phase recovery purple but visually distinct from it. Do not reuse exact phase recovery purple or metric effort plum.

Likely areas:

- `packages/app/constants/session-types.ts`
- `packages/app/constants/colours.ts`
- `packages/app/lib/plan-helpers.ts`
- `packages/app/lib/session-row-text.ts`
- `packages/app/components/ui/SessionDot.tsx`
- existing role-based colour maps

### Acceptance Criteria

- [ ] Recovery appears in role selectors where runner-created sessions are edited.
- [ ] Recovery row/card/dot styling is distinct from Easy and Rest.
- [ ] Recovery defaults to very easy effort and recovery training pace where applicable.
- [ ] Recovery does not support quality run structure in v1.
- [ ] Existing role displays still match current app behaviour.

### Tests

- [ ] Colour language test for recovery token usage.
- [ ] Session row/title tests for Recovery.
- [ ] Editor tests proving Recovery can be selected and saved.

## 4. Add Plan Note, Planned Volume, And Run Structure Entry Points To The Simple Editor

Type: AFK
Priority: High
Estimate: 5
Blocked by: 1, 2, 3

### What to build

Amend the existing session editor without replacing it. The simple editor remains the default path for normal sessions and simple intervals.

Add top-level planned volume support where needed, add `Plan note`, and add an `Add run structure` CTA that opens the advanced builder. Existing interval editing must remain quick.

Likely areas:

- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/plan-builder/SessionEditorScreen.tsx`
- `packages/app/features/plan-builder/session-editing.ts`
- `packages/app/tests/session-editor.test.tsx`
- `packages/app/tests/session-editing.test.ts`

### Acceptance Criteria

- [ ] Ordinary easy, tempo, long, interval, rest, and recovery editing still works.
- [ ] Simple intervals can still be created without opening run structure.
- [ ] Existing warm-up and cool-down controls remain in the simple editor.
- [ ] Plan note can be added, edited, removed, and saved.
- [ ] `Add run structure` appears without overcrowding the editor.
- [ ] If a session already has detailed structure, quick fields use clear copy that points back to structure editing.
- [ ] Training pace labels remain coherent, including `VO2 range` for the former Interval pace label where UI copy is touched.

### Tests

- [ ] Editor quick-path interval regression tests.
- [ ] Plan note persistence tests.
- [ ] Recovery editor save tests.
- [ ] Structured-session quick-field copy tests.

## 5. Build Run Structure Editor V1

Type: AFK
Priority: High
Estimate: 8
Blocked by: 1, 2

### What to build

Build the dedicated full-screen Run Structure editor.

It should support templates first, then a custom builder. It should model segments, one-level repeat groups, progressions, floats, strides, warm-up/cool-down, totals, mismatch warnings, and plan note.

Likely areas:

- new app route or full-screen component under plan-builder/session editing
- shared UI components for segment rows and repeat groups
- unit/value controls for distance, minutes, and seconds
- tests for editor save/load behaviour

### Acceptance Criteria

- [ ] Opens as a full-screen flow from the simple editor.
- [ ] Provides templates for fast finish, progression, race-pace blocks, cruise intervals, short reps, strides, and custom.
- [ ] Filters templates by parent session role.
- [ ] Supports one-level repeat groups with different work/recovery durations.
- [ ] Supports seconds-level inputs such as `20s` and `30s`.
- [ ] Supports the fartlek ladder example without nested repeats.
- [ ] Shows calculated totals and non-blocking mismatch warnings.
- [ ] Allows plan note without forcing structure.
- [ ] Uses parent-session identity and metric colours sparingly, not a rainbow segment list.

### Tests

- [ ] Save/load tests for all canonical structure examples.
- [ ] Repeat-group editor tests.
- [ ] Seconds input tests.
- [ ] Mismatch warning tests.
- [ ] Plan-note-only tests.

## 6. Integrate Structured Sessions Into Onboarding Template Week And Generated Plan Flow

Type: AFK
Priority: High
Estimate: 5
Blocked by: 4, 5

### What to build

Make structured sessions available where users build and edit their block during onboarding. The `Design your week` and generated plan flow should preserve structure and plan notes.

Steady remains BYOP. Generated plans are scaffolds; do not add new onboarding complexity for detailed training philosophy.

Likely areas:

- `packages/app/app/onboarding/plan-builder/step-template.tsx`
- `packages/app/app/onboarding/plan-builder/step-plan.tsx`
- `packages/types/src/lib/plan-generator.ts`
- plan propagation helpers
- relevant plan-builder tests

### Acceptance Criteria

- [ ] Recovery can appear in the weekly template.
- [ ] Run structure can be opened from template-week editing.
- [ ] Plan note and run structure survive generation into the full block.
- [ ] Drag/reorder behaviour still works.
- [ ] Generated plans do not become complex by default.
- [ ] Style-led structured generation only appears where explicitly selected or already implied by the chosen session.

### Tests

- [ ] Step-template tests for Recovery and indicators.
- [ ] Step-plan persistence tests for plan note and structure.
- [ ] Plan-generator tests proving simple plans stay simple.
- [ ] Propagation tests for structured sessions.

## 7. Show Structure And Notes In Block Review, Week Rows, And Home

Type: AFK
Priority: High
Estimate: 5
Blocked by: 2, 3, 5

### What to build

Update scan surfaces to reveal structured sessions without making the product noisy.

Collapsed week rows should keep role dots. Run structure and plan notes should use tiny, quiet indicators. Expanded/detail surfaces should show compact summaries.

Likely areas:

- `packages/app/components/block/BlockWeekList.tsx`
- `packages/app/components/block-review/BlockReviewSurface.tsx`
- `packages/app/components/home/TodayHeroCard.tsx`
- `packages/app/components/home/RemainingDaysList.tsx`
- `packages/app/components/home/ResolveSessionSheet.tsx`
- `packages/app/lib/session-row-text.ts`

### Acceptance Criteria

- [ ] Collapsed week rows remain calm.
- [ ] Run structure indicator appears only after structure has been saved.
- [ ] Plan note indicator is visually distinct from run structure.
- [ ] Expanded rows show compact structure summaries.
- [ ] Today's card shows top-line structure for the current run.
- [ ] Structured long runs remain visually and semantically Long.
- [ ] Recovery runs display with the new recovery identity.

### Tests

- [ ] Block week list tests for indicators and summaries.
- [ ] Block review surface tests for structured rows.
- [ ] Home card tests for top-line structure.
- [ ] Resolve-session display tests.

## 8. Add Advisory Guardrails And Intensity Distribution Support

Type: AFK
Priority: Normal
Estimate: 5
Blocked by: 2, 7

### What to build

Use derived demand and structure data to improve warnings and intensity distribution. Warnings should be advisory and non-blocking.

Do not turn this into a compliance or coaching-judgement feature. Avoid hard 80/20 moralising.

Likely areas:

- block review model helpers
- weekly load/intensity components
- warning copy and display helpers
- tests around stacked demanding sessions

### Acceptance Criteria

- [ ] Demand, not just quality, can drive spacing warnings.
- [ ] Long easy runs and embedded-quality long runs are treated differently.
- [ ] Easy strides are not treated like hard workouts.
- [ ] Warnings use advisory language such as `worth checking`, `stacked`, or `limited recovery`.
- [ ] Warnings never block save.
- [ ] Intensity distribution uses structure when available and session fallback otherwise.

### Tests

- [ ] Demand-warning tests.
- [ ] Easy-strides demand tests.
- [ ] Intensity-distribution derivation tests.
- [ ] Non-blocking save tests.

## 9. Add Structured-Session Intent To Planned-Vs-Actual And Steady AI Context

Type: AFK
Priority: Normal
Estimate: 5
Blocked by: 2, 5, 7

### What to build

Teach planned-vs-actual and Steady AI context about plan notes and run-structure summaries, while keeping whole-session completion separate from segment execution quality.

Do not promise full segment-by-segment analysis in v1.

Likely areas:

- `packages/server/src/lib/context-builder.ts`
- `packages/app/app/sync-run/[activityId].tsx`
- `packages/app/app/sync-run/index.tsx`
- `packages/app/components/home/ResolveSessionSheet.tsx`
- quality summary helpers

### Acceptance Criteria

- [ ] Whole-session completion still works.
- [ ] Execution quality remains separate from completion.
- [ ] Plan note and structure summary appear in AI context.
- [ ] AI does not claim exact segment execution without suitable data.
- [ ] Sync/resolve surfaces can show planned structure intent.
- [ ] Existing quality summary behaviour for current tempo/interval sessions does not regress.

### Tests

- [ ] Context-builder tests for plan note and run structure.
- [ ] Planned-vs-actual tests proving completion remains stable.
- [ ] Quality summary regression tests.
- [ ] Sync/resolve display tests.

## 10. Run End-To-End QA And Release Hardening

Type: HITL
Priority: High
Estimate: 3
Blocked by: 1, 2, 3, 4, 5, 6, 7, 8, 9

### What to build

Run the implementation through the QA plan, fix release-blocking defects, and produce a final sign-off report.

This issue should not start until the main implementation slices are ready together.

Likely inputs:

- `docs/structured-sessions-implementation-qa.md`
- PRD acceptance examples
- wireframes
- automated test suite
- simulator screenshots

### Acceptance Criteria

- [ ] Every minimum release gate in the QA plan is checked.
- [ ] All eight acceptance scenarios are tested.
- [ ] Screenshots are captured for editor, run structure, onboarding, review, home, and sync/detail surfaces.
- [ ] Failing automated tests are fixed or explicitly deferred with rationale.
- [ ] Any PRD divergence is documented.
- [ ] Final verdict is recorded as pass, pass with issues, or fail.

### Tests

- [ ] Run relevant unit and component tests.
- [ ] Run typecheck/lint where available.
- [ ] Run app smoke flow on simulator or local runtime.
