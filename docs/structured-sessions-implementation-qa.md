# QA Plan: Structured Sessions and Recovery Runs

Status: implementation QA checklist
Date: 2026-04-30
Feature: Structured Sessions and Recovery Runs
Primary PRD: `docs/structured-sessions-and-recovery-runs-prd.md`
Wireframes: `wireframes/structured-sessions-recovery/index.html`

## Purpose

Use this document to verify whether the implementation matches the product decision, data model, wireframes, and Steady's bring-your-own-plan boundary.

This is not a research rubric. It is a QA brief for an implementation QA agent. The agent should test the finished product, inspect relevant code paths where useful, and produce a pass/fail report with evidence.

## QA Agent Instructions

1. Test the product as a runner editing an existing plan, not as a coach generating a perfect plan.
2. Treat the PRD as the source of truth unless a later Linear comment or issue explicitly changes scope.
3. Verify behaviour through the app first, then inspect code and tests to explain failures.
4. Capture screenshots for every major surface checked.
5. Record the commit SHA, branch, app build target, device/simulator, and date tested.
6. Separate completion from execution quality in all findings.
7. Flag overclaiming. Steady must not pretend it knows exact segment execution when the activity data cannot support it.
8. Flag overbuilding. Steady must not become a full prescriptive plan generator as part of this feature.

## Reference Materials

- PRD: `docs/structured-sessions-and-recovery-runs-prd.md`
- Wireframe HTML: `wireframes/structured-sessions-recovery/index.html`
- Wireframe screenshot: `wireframes/structured-sessions-recovery/structured-sessions-recovery.png`
- Relevant existing surfaces:
  - `packages/app/components/plan-builder/SessionEditor.tsx`
  - `packages/app/components/plan-builder/SessionEditorScreen.tsx`
  - `packages/app/app/onboarding/plan-builder/step-template.tsx`
  - `packages/app/app/onboarding/plan-builder/step-plan.tsx`
  - `packages/app/components/block/BlockWeekList.tsx`
  - `packages/app/components/block-review/BlockReviewSurface.tsx`
  - `packages/app/components/home/TodayHeroCard.tsx`
  - `packages/app/components/home/RemainingDaysList.tsx`
  - `packages/app/components/home/ResolveSessionSheet.tsx`
  - `packages/server/src/lib/context-builder.ts`
  - `packages/types/src/session.ts`
  - `packages/types/src/lib/session-km.ts`

## Minimum Release Gates

The implementation should not ship if any gate fails.

1. `RECOVERY` is a first-class session role and does not masquerade as `EASY`.
2. Existing plans and sessions without structured-session fields still load, edit, save, and calculate volume.
3. Run structure supports segments, one-level repeat groups, mixed distance/time units, and seconds-level time volumes.
4. Nested repeat groups are rejected or unavailable in v1.
5. Simple interval editing still works without forcing the advanced run-structure builder.
6. Plan note is distinct from run structure and never drives totals, warnings, or intensity distribution.
7. Run structure is canonical when present; simple fields are canonical when structure is absent.
8. Weekly volume and session totals distinguish exact kilometres, estimated kilometres, planned minutes, and short structured durations honestly.
9. Home, block, review, and editor surfaces show structured sessions without visual noise.
10. Warnings are advisory and non-blocking.
11. Whole-session completion remains separate from segment execution quality.
12. Steady AI context includes plan note and run-structure intent without claiming unavailable precision.

## Acceptance Scenarios

Run these as end-to-end product checks.

### 1. Recovery Run

Create or edit a session as:

- Role: `Recovery`
- Volume: `35min`
- Target: `very easy`

Expected:

- Recovery appears as its own role in the editor.
- It uses a distinct muted lavender visual identity.
- It does not show advanced quality structure prompts by default.
- It appears distinctly in week rows, block review, and home.
- It does not count as a hard or quality session for spacing warnings.

### 2. Structured Marathon Long Run

Create or edit:

`LONG 26km including 3 x 3km marathon pace off 1km float`

Expected:

- Parent role remains `Long`.
- The session summary communicates `Long run · Marathon pace` or equivalent compact focus.
- Run structure contains one repeat group with `3` repeats.
- Each repeat contains a marathon-pace run segment and a float segment.
- Total distance is calculated from structured parts when possible.
- The long-run identity is not replaced by interval identity.

### 3. Threshold Cruise Intervals

Create or edit:

`TEMPO 3 x 10min threshold, 2min jog`

Expected:

- Parent role remains `Tempo`.
- Time-based segments are first-class.
- Recovery jog is modelled separately from the threshold segment.
- Weekly totals show exact planned time and only estimated distance where the model has enough pace context.

### 4. Easy Run With Strides

Create or edit:

`EASY 8km with 6 x 20s strides`

Expected:

- Parent role remains `Easy`.
- Strides are represented as structured details, not as a full interval session.
- The session is not treated like a hard workout for demand warnings.
- Seconds-level segment duration is preserved.

### 5. Progression Run

Create or edit:

`LONG 60min progression easy to marathon`

Expected:

- Parent role remains `Long`.
- Progression uses start and end targets rather than fake fixed chunks.
- The summary communicates progression clearly.
- Estimated distance is clearly marked as estimated if derived.

### 6. Fartlek Ladder With Multiple Repeat Groups

Create or edit:

`INTERVAL/FARTLEK 4 x 1.5min on/off, 4 x 1min on/off, 4 x 30s on/off`

Expected:

- The structure can be represented without nested repeats.
- Each of the three repeat groups can have different work and recovery durations.
- `30s` persists as seconds, not as an awkward decimal-minute truth.
- The UI may render `30s`, `90s`, or `1.5min`, but stored data should keep precise duration semantics.

### 7. Plan Note Only

Create or edit a normal long run with a plan note but no run structure.

Expected:

- Plan note persists.
- The note can be seen where useful.
- The session does not show the run-structure indicator.
- The note does not affect volume, warnings, focus, or intensity distribution.

### 8. Simple Interval Quick Path

Create:

`6 x 800m @ VO2 range with 2min recovery`

Expected:

- The current simple interval path remains quick.
- The user is not forced into run structure.
- There is a clear CTA to add run structure if they want more detail.
- Existing interval distance calculations still work.

## Surface Checklist

### Session Editor

- Recovery chip appears with existing chip styling.
- Top-level volume can be distance-led or time-led where required by the PRD.
- Existing distance, pace, repetition, recovery, warm-up, and cool-down controls still work.
- `Plan note` is available and saved.
- `Add run structure` appears in the intended area without overcrowding the editor.
- Structured sessions show clear copy when quick fields are no longer the right editing surface.
- Save/cancel behaviour is unchanged for ordinary sessions.

### Run Structure Editor

- Opens as a dedicated full-screen flow.
- Offers sensible templates before blank custom building.
- Supports warm-up, run, recovery, float, rest, stride, and cool-down segment kinds.
- Supports one-level repeat groups.
- Rejects or prevents nested repeat groups.
- Supports seconds internally for short time-based segments.
- Shows calculated totals and mismatch warnings.
- Allows plan note without forcing structure.
- Uses colour sparingly; no rainbow segment list.

### Onboarding Template Week

- The current `Design your week` layout remains recognisable.
- Recovery sessions can appear in the weekly template.
- Existing drag behaviour still works.
- Structure and note indicators are tiny and quiet.
- Template volume remains understandable with time-led and mixed-unit sessions.

### Review Your Block

- The current review screen remains recognisable.
- Expanded rows show compact structure summaries.
- Collapsed rows stay calm.
- Session role remains the primary dot/row identity.
- Structured long runs remain long runs.

### Home And Current Week

- Today's card shows the top-line structure without overcrowding.
- Remaining-day rows keep scan quality.
- Recovery runs have their own visual identity.
- Completed sessions remain completed at whole-session level even if segment analysis is absent.

### Planned Vs Actual And Sync

- Whole-session completion continues to work.
- Execution quality is shown only where evidence supports it.
- Per-kilometre splits are not used to overclaim short strides or time-based reps.
- Resolve-session and sync surfaces can display planned structure intent.

### Steady AI Context

- Plan note and structure summary are included in context.
- AI responses respect the BYOP boundary.
- AI does not tell the runner their plan is invalid.
- Warnings are framed as things worth checking, not hard rules.

## Data And Compatibility Checklist

- `SessionType` includes `RECOVERY`.
- Existing serialized plans without `plannedVolume`, `planNote`, or `runStructure` normalize safely.
- `SessionDurationSpec` or equivalent supports the required units without decimal-minute storage for short seconds.
- Run-structure validation handles positive volumes, repeat counts, allowed segment kinds, and v1 nesting limits.
- `sessionKm` remains backwards-compatible.
- New richer volume helpers distinguish exact and estimated values.
- Derived focus, demand, warnings, summaries, and intensity distribution are not stored as source-of-truth fields.
- Supabase/server persistence does not silently strip new fields.
- Training pace profile handling remains compatible with recovery/easy/steady/marathon/threshold/interval bands.

## Test Expectations

At minimum, automated coverage should include:

- Session normalization and backwards compatibility.
- Recovery session defaults and display behaviour.
- Plan note persistence and indicator behaviour.
- Run-structure validation.
- Repeat-group and no-nested-repeat behaviour.
- Seconds-level segment duration behaviour.
- Structure summary formatting for all acceptance examples.
- Volume helper exact/estimated output.
- Simple interval regression tests.
- Editor flow tests for quick path and advanced path.
- Block/home display tests for indicators and summaries.
- Context-builder tests for plan note and structure summaries.

## QA Report Format

The QA agent should return:

1. `Verdict`: pass / pass with issues / fail.
2. `Confidence`: high / medium / low.
3. `Build tested`: branch, commit SHA, environment, device.
4. `Release gate failures`: list or `None`.
5. `Scenario results`: pass/fail for each acceptance scenario.
6. `Surface findings`: grouped by session editor, run structure, onboarding, review, home, planned vs actual, AI.
7. `Regression findings`: existing behaviours that broke.
8. `Evidence`: screenshots, logs, failing tests, or code references.
9. `Recommended fixes before ship`.
10. `Safe to defer`.

## Evidence Log Template

| Area | Check | Result | Evidence | Notes |
|---|---|---|---|---|
| Session editor | Recovery role can be saved | Pass/Fail | Screenshot/test | |
| Run structure | Fartlek ladder persists seconds | Pass/Fail | Screenshot/test/code | |
| Block review | Structured long run remains Long | Pass/Fail | Screenshot/test | |
| Home | Top-line structure shown | Pass/Fail | Screenshot/test | |
| AI context | Structure and plan note included | Pass/Fail | Test/log | |

## Red Flags

Treat these as likely blockers:

- Recovery is implemented as a label on Easy rather than a real role.
- Run structure stores short durations as ambiguous decimal minutes only.
- Simple intervals are removed or forced into the advanced builder.
- Plan notes affect calculations.
- Long runs with embedded quality become interval sessions.
- The UI adds loud new colours for every segment.
- Weekly totals show estimated distance as exact.
- The app blocks runners from saving demanding plans.
- Planned-vs-actual claims segment execution from insufficient split data.
- Existing plans fail to load or save.
