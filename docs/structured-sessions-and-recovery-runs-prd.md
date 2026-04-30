# PRD: Structured Sessions and Recovery Runs

Status: product decision, ready for design
Date: 2026-04-30
Primary surfaces: onboarding plan builder, session editor, run structure editor, block review, home, planned vs actual, Steady AI context

## Problem Statement

Steady is a bring-your-own-plan product for runners who already have a training plan. The current session model is strong enough for simple easy runs, long runs, tempos, intervals, and rest days, but it flattens common serious training prescriptions.

Examples that are currently hard to represent faithfully:

1. `26km including 3 x 3km marathon pace off 1km float`
2. `3 x 10min threshold with 2min jog`
3. `8km easy with 6 x 20s strides`
4. `60min progression from easy to marathon effort`
5. `35min recovery`

This creates a credibility risk with experienced runners. A runner can choose or import a plan whose key session meaning lives inside the run, but Steady may only preserve the outer shell. A long run with embedded marathon-pace work becomes just "26km long run". An easy run with strides becomes just "8km easy". A time-based session is treated awkwardly because the top-level model is distance-led.

The product problem is not that Steady needs to become Runna, Garmin, TrainingPeaks, or a prescriptive coaching engine. The problem is that Steady must preserve, display, edit, and reason about the plan the runner already chose.

## Solution

Add structured-session support while preserving Steady's BYOP principle and simple editing paths.

The feature introduces:

1. A new first-class `Recovery` session role.
2. A top-level planned volume concept that can be distance-led or time-led.
3. A `Plan note` field for display-only plan context.
4. Optional `Run structure` for sessions with internal parts, repeats, progressions, floats, strides, warm-ups, cool-downs, and recoveries.
5. Derived `Focus`, demand, and intensity distribution models for scanning, warnings, analytics, and Steady AI context.
6. Non-blocking guardrails that flag plan tension without overruling the runner.

The simple session editor remains the default path. Runners can still create normal intervals quickly without using the advanced builder. `Run structure` is an advanced full-screen path for sessions that need more fidelity.

The product principle:

> Steady does not prescribe the "right" plan. It helps runners preserve, understand, edit, and follow the plan they chose.

## User Stories

1. As a runner with a coach-written marathon plan, I want to store a long run with marathon-pace blocks, so that Steady does not flatten my key session into a plain long run.
2. As an experienced runner, I want a long run to remain a long run even when it contains faster segments, so that my weekly structure stays understandable.
3. As a runner following a threshold plan, I want to store `3 x 10min threshold with 2min jog`, so that time-based cruise intervals are represented accurately.
4. As a runner doing strides after an easy run, I want to add strides without turning the day into an interval session, so that the session role still reflects the plan.
5. As a runner doing recovery runs, I want Recovery to be a distinct session role, so that recovery runs are not hidden as generic easy runs.
6. As a runner reviewing my week, I want recovery runs to have their own calm visual identity, so that I can distinguish them from ordinary easy runs.
7. As a runner, I want a plan note on any session, so that I can preserve coach wording or nuance that does not need structured modelling.
8. As a runner, I want plan notes to be visible where useful, so that I do not lose important session context.
9. As a runner, I want the app to calculate total distance or duration from structure when possible, so that weekly totals stay accurate.
10. As a runner, I want Steady to avoid pretending uncertain estimates are exact, so that time-based sessions do not create fake precision.
11. As a runner, I want duration-led sessions such as `60min easy` to be first-class, so that Steady supports plans written by time.
12. As a runner, I want mixed-unit sessions such as `12km including 10 x 1min hard` to be allowed, so that real-world fartlek sessions fit.
13. As a runner, I want a simple interval editor to remain quick, so that common sessions do not require a complex builder.
14. As a runner, I want to convert a simple interval into detailed run structure, so that I can add nuance only when needed.
15. As a runner, I want advanced structured sessions to be edited in one dedicated place, so that I do not have two conflicting sources of truth.
16. As a runner, I want structure templates such as fast finish, progression, race-pace blocks, cruise intervals, short reps, and strides, so that I do not have to build every session from scratch.
17. As a runner, I want run-structure templates filtered by session role, so that the advanced path still feels focused.
18. As a runner, I want repeat groups, so that prescriptions like `3 x 3km marathon pace off 1km float` are not stored as duplicated noise.
19. As a runner, I want one level of repeat groups in the first version, so that common sessions are supported without creating a full workout programming language.
20. As a runner, I want progression sessions to support start and end targets, so that `progress from easy to marathon pace` does not need artificial chunks.
21. As a runner, I want Steady to distinguish completion from execution quality, so that finishing the run is not treated the same as hitting every segment perfectly.
22. As a runner, I want structured sessions to be compared at the whole-session level first, so that completion remains stable even when segment analysis is unavailable.
23. As a runner, I want detailed segment analysis only when activity data supports it, so that Steady does not overclaim.
24. As a runner, I want Steady AI to understand plan notes and run structure, so that feedback reflects the intended workout.
25. As a runner, I want non-blocking warnings when demanding sessions are close together, so that I can notice plan tension without being stopped.
26. As a runner, I want to dismiss or ignore warnings, so that Steady respects my chosen plan.
27. As a runner, I want the block review to show compact structure summaries, so that I can scan the week without opening every session.
28. As a runner, I want collapsed week rows to stay calm, so that structure fidelity does not make the block view noisy.
29. As a runner, I want a tiny indicator when I have deliberately added run structure, so that extra detail is visible but not loud.
30. As a runner, I want a separate note indicator for plan notes, so that notes are not confused with structured work.
31. As a runner, I want the home card to show the top-line structure for today's run, so that I know the important part before heading out.
32. As a runner, I want Focus labels such as `Long run · Marathon pace` or `Easy run · Strides`, so that I can understand a session's purpose quickly.
33. As a runner, I want effort and pace targets to stay in the editor/detail layer, so that scanning surfaces do not duplicate too much information.
34. As a runner, I want intensity distribution to be shown as information rather than judgement, so that Steady does not moralise my training philosophy.
35. As a runner, I want easy, moderate, and hard intensity to be derived from session structure when available, so that intensity distribution is more accurate.
36. As a runner, I want generated plans to stay a convenience scaffold, so that Steady does not become a prescriptive plan generator.
37. As a runner, I want generated structured workouts only when I choose a style that implies structure, so that simple plans stay simple.
38. As a runner, I want run structure available from onboarding template week and live session editing, so that I can shape the plan wherever I am editing it.
39. As a runner using an existing plan, I want older simple sessions to keep working, so that structured sessions do not break existing data.
40. As a future import user, I want imported text to be preserved even when Steady cannot parse it, so that the original plan is not lost.

## Implementation Decisions

### Product Model

- Session role remains the top-level weekly job of the run.
- Add `Recovery` as a first-class session role.
- Keep `Easy`, `Interval`, `Tempo`, `Long`, and `Rest`.
- A long run with embedded marathon-pace work remains a `Long` session.
- An easy run with strides remains an `Easy` session.
- A recovery run should not support run structure in the first version. If a session needs structure, it should not be a recovery run.
- Focus is derived from role, style, and structure. It is not manually edited in v1.
- Demand is derived from role, planned volume, and structure. It is used for warnings and future analysis.
- Intensity distribution is derived from structure where available and session-level targets as fallback.
- Completion and execution quality remain separate concepts everywhere.

### Vocabulary

- Use `Run structure` in UI.
- Use `Plan note` in UI and internal naming.
- Use `Focus` in compact UI and `Training focus` where a section label needs more clarity.
- Use `Run` as the generic active segment name. Do not introduce `Work` as a parallel term.
- Use `Float` for easier continuous running between harder segments. A float is not standing rest and not necessarily a very easy jog.
- Rename the `Interval` training pace UI label to `VO2 range` while preserving current behaviour internally until a migration is warranted.
- Keep `Steady range` as a training pace label for now. It remains runner-native enough and avoids overcomplicating the UI.

### Data Model

- Add optional `plannedVolume` to a session to support top-level distance-led or time-led prescriptions.
- Keep existing top-level distance and pace fields for compatibility.
- Keep existing simple interval fields for compatibility and quick editing.
- Add optional `planNote` directly to planned sessions.
- Add optional `runStructure` directly to planned sessions.
- `runStructure` is canonical when present.
- Simple fields are canonical when `runStructure` is absent.
- The simple interval editor should not automatically create `runStructure`.
- The `Add run structure` path can convert simple interval fields into a structured representation.
- Once `runStructure` exists, simple fields become summary and compatibility fields unless the structure can be safely collapsed back.
- Run structure v1 supports segments and one level of repeat groups.
- Nested repeat groups are out of scope for v1.
- Each segment has a kind, a distance or time volume, an optional intensity target, and optional progression metadata.
- Segment time volumes should support seconds internally. The UI can render `90s`, `1.5min`, or `10min`, but the persisted structured value should avoid awkward decimal-minute storage for short reps.
- Top-level planned volume can remain kilometre- or minute-led for this project unless a clear top-level seconds use case emerges.
- Multiple repeat groups with different work and recovery durations are in scope for v1.
- Progression supports start and end intensity targets rather than forcing artificial chunks.
- Plan note never drives totals, warnings, or intensity distribution. It is display and context only.
- Focus, demand, warnings, structure summaries, and intensity distribution are derived helpers, not stored truth.

### Volume and Totals

- Add a richer volume helper alongside current kilometre totals.
- The helper should distinguish prescribed kilometres, estimated kilometres, prescribed minutes, and structured seconds where short time-based segments are present.
- Existing kilometre-based surfaces can keep using kilometre totals during migration.
- New structured-session surfaces should show exact values and estimates honestly.
- Duration plus a profile pace/range may produce estimated distance.
- Duration plus effort-only may produce estimated distance only if the effort maps to a training pace.
- Duration plus plan note or custom text should not create estimated distance unless the runner supplies a top-level distance or pace target.
- Weekly volume UI should eventually distinguish planned kilometres from estimated kilometres and planned time.

### Editor UX

- The current simple session editor remains the default.
- `Add run structure` appears below common target fields and before save.
- Run structure opens a dedicated full-screen editor.
- The first run-structure screen offers templates before a blank builder.
- Template options include fast finish, progression, race-pace blocks, cruise intervals, short reps, strides, and custom.
- Templates are filtered by session role.
- Repeat groups are edited through a nested detail flow or focused section, not cramped inline controls.
- The final run-structure screen shows calculated totals.
- If structure totals differ from top-level planned volume, show a non-blocking warning.
- If an advanced structure is too detailed for the quick editor, use copy like: `This session has a detailed structure. Edit the structure to change the workout.`
- Plan note can be saved without run structure.
- A session with only a plan note should not show the same indicator as a session with run structure.

### Display UX

- Collapsed week rows keep the existing role-based seven-dot pattern.
- Add only a tiny indicator for sessions where the user deliberately saved run structure.
- Use a separate quiet note indicator for plan notes.
- Expanded week rows show compact structure summaries.
- Today/home surfaces show the top-line structure only.
- Session detail/edit surfaces show structure prominently when present.
- Focus labels are compact phrases, not chip clusters.
- Effort cues mostly stay out of scanning surfaces.

### Colour Language

- Colour remains semantic signal, not decoration.
- Session role color remains the primary identity color for dots, tags, cards, and day rows.
- Add a distinct recovery-run session color related to, but not identical to, phase recovery purple.
- Do not reuse metric effort plum or exact phase recovery purple for the recovery session role.
- Proposed direction: a muted lavender session token with a very pale lavender background.
- Tune the exact token visually against Easy forest, Long navy, and Rest slate.
- Run-structure indicators should be neutral or parent-session-colored. They should not introduce a new semantic hue.
- Plan-note indicators should be muted/ink/border, not performance color.
- Numeric distance values use distance metric color.
- Numeric duration values use time metric color.
- Numeric pace values use pace metric color.
- Effort values use effort metric color only where effort is the value being communicated.
- Warnings use status amber.
- Injury caution remains status clay.
- Do not create a rainbow segment list. Use color sparingly inside run structure.

### Warnings and Guardrails

- Warnings are advisory and non-blocking.
- Warnings flag plan tension; they do not overrule the runner.
- Demand, not just quality, drives spacing warnings.
- A 30km easy long run can be demanding even if it is not a quality session.
- A long run with marathon-pace blocks is both demanding and structured quality.
- Strides after an easy run should not be treated like a hard workout for spacing warnings.
- Use language such as `demanding`, `stacked`, `limited recovery`, and `worth checking`.
- Avoid `unsafe` unless injury or recovery context makes it explicit.

### Generation

- Steady remains BYOP.
- Generated plans are scaffolds to make editing easier.
- Do not add onboarding complexity for detailed training background in this project.
- Structured generation should be explicit and style-led.
- Do not generate complex structured workouts by default for all users.
- Support a small set of style-driven structures first.
- Do not try to encode every named training philosophy in generation.

### Planned vs Actual

- V1 structured sessions should not promise full segment-by-segment analysis.
- Whole-session completion remains based on completing the run.
- Execution quality is a separate insight.
- Segment-level analysis is available only when structure and activity data support it.
- Per-kilometre splits are not enough for short strides or many time-based reps.
- Steady AI may use structure and plan notes as context, but it must not claim exact segment execution without data.

### Rollout Order

1. Add Recovery session role.
2. Add data-model foundation for planned volume, plan note, and run structure.
3. Add read/display support for plan notes and run-structure summaries.
4. Add full-screen Run Structure editor.
5. Add structure-aware volume, focus, demand, warning, and intensity-distribution helpers.
6. Add style-led structured generation.
7. Later: import parsing, segment-level analysis, and device export.

## Testing Decisions

Good tests should verify external behaviour and stable contracts rather than implementation details. The most important tests should sit around the shared type/domain helpers and editor flows because those are the deep modules that make this feature scalable.

Test coverage should include:

1. Session normalization preserves older sessions without run structure.
2. Recovery sessions normalize with recovery defaults and no run structure.
3. Plan notes persist through save/load and count as session edits.
4. Run structure validates positive segment volumes and valid repeat counts.
5. Run structure rejects nested repeat groups in v1.
6. Structure summaries render canonical examples correctly.
7. Volume helpers distinguish exact kilometres, estimated kilometres, prescribed minutes, and short structured durations in seconds.
8. Mixed-unit sessions produce honest partial totals.
9. `sessionKm` remains backwards-compatible for existing kilometre-based screens.
10. Existing simple intervals continue to calculate distance as they do today.
11. Converting a simple interval to run structure creates equivalent totals.
12. Once run structure exists, structure-driven totals take precedence where calculable.
13. Multiple repeat groups with different time durations are represented without nested repeats.
14. Structure summaries render descending fartlek ladders such as `4 x 1.5min on/off, 4 x 1min on/off, 4 x 30s on/off`.
15. Focus derivation handles long-run race blocks, easy strides, threshold cruise intervals, progression, fartlek ladders, and recovery runs.
16. Demand derivation treats long easy runs and embedded-quality long runs differently.
17. Intensity distribution uses segment-level data when present and session fallback otherwise.
18. Warning helpers flag stacked demanding sessions without blocking edits.
19. Session editor quick path remains usable without opening run structure.
20. Run structure editor can save plan note only.
21. Run structure editor shows mismatch warnings without blocking save.
22. Steady AI context includes plan note and run-structure summaries.

Prior art in the codebase includes tests around training pace profiles, session editing fingerprints, weekly volume, planned vs actual, structured quality summaries, block week rows, and plan propagation. The new tests should follow those behaviour-first patterns.

## Out of Scope

The following are explicitly out of scope for the first structured-session release:

1. Device workout export to Garmin, Apple, Coros, or other platforms.
2. Import parsing from screenshots, CSV, plain text, or external plan sources.
3. Full segment-by-segment execution scoring for every structured session.
4. Nested repeat groups.
5. Full training-methodology generation for Pfitz, Norwegian, Daniels, or other named systems.
6. New onboarding questions for runner background, experience, or plan complexity.
7. Blocking safety rules that prevent runners from saving demanding plans.
8. Manual editing of Focus labels.
9. Replacing all legacy simple session fields in one migration.
10. A dedicated 80/20 compliance feature.

## Further Notes

Acceptance examples for design and implementation:

1. `LONG 26km including 3 x 3km marathon pace off 1km float`
2. `TEMPO 3 x 10min threshold, 2min jog`
3. `EASY 8km with 6 x 20s strides`
4. `LONG 60min progression easy to marathon`
5. `RECOVERY 35min very easy`
6. `INTERVAL/FARTLEK 4 x 1.5min on/off, 4 x 1min on/off, 4 x 30s on/off`

This PRD supersedes the narrower long-run-quality exploration as the product umbrella. The previous long-run-quality work remains useful as concept input, but implementation should treat structured sessions and recovery runs as the broader capability.

The high-fidelity wireframes should assume the future-correct model even if implementation ships in slices.
