# Session Editor Target Pace and Propagation Rules

Status: product decision, ready for implementation
Date: 2026-04-29
Primary surfaces: `SessionEditor`, `/edit-session`, Plan Builder review, Block tab, Settings > Training paces

## Purpose

The session editor currently exposes too much of the underlying intensity model. Runners see effort cues, Training paces, single pace, pace range, custom chips, and propagation in the same row. The result is technically powerful but too easy to misunderstand.

The product decision is to keep the data model rich and simplify the editor. The editor should ask the runner to choose session intent first, then allow custom session-specific targets when needed.

## Vocabulary

Use these terms in product copy and implementation naming where practical.

| Term | Meaning | Use in UI |
|---|---|---|
| Training pace | A reusable runner-specific target such as Easy, Steady, Threshold, Interval, or Race pace. | Yes |
| Custom pace | A session-specific single pace target. | Yes |
| Custom range | A session-specific pace range target. | Yes |
| Manual pace | Internal concept only. Avoid in UI. | No |
| Profile pace | Internal concept only. Avoid in UI. | No |
| Linked pace | Internal explanation only. Avoid in UI. | No |

Approved captions:

- `Threshold · Training pace`
- `Race pace · Training pace`
- `Custom pace`
- `Custom range`

## Product Boundaries

Session editing and Training pace editing are separate.

- The session editor edits the planned session.
- Settings > Training paces edits reusable runner paces.
- A session pace edit must never mutate the runner's Training paces.
- Training pace options in the session editor are selectable, not editable.
- A future affordance may link from the session editor to Training paces, but that is out of scope for this pass.

Home remains deliberately non-editing. The runner goes to Block or Plan Builder review to change the plan. This keeps pace changes as deliberate plan edits, not pre-run mood tweaks.

## Core Behaviour

Sessions can carry one of these pace intents:

1. Use a Training pace, such as `Threshold`.
2. Use a Custom pace, such as `4:10/km`.
3. Use a Custom range, such as `4:10-4:22/km`.

Rules:

- Selecting `Threshold` stores "use Threshold", not frozen numbers.
- Selecting `Custom pace 4:10/km` stores a custom session target.
- Selecting `Custom range 4:10-4:22/km` stores a custom session target.
- Applying a Training pace to future sessions keeps those sessions connected to that Training pace.
- Applying a Custom pace or Custom range broadly converts the matching future session slots to custom targets.
- Updating Training paces later updates future sessions still using Training paces.
- Updating Training paces later does not change completed sessions or custom overrides.
- If a session uses a Training pace and the runner edits distance, reps, rep length, recovery, warm-up, or cool-down only, keep the Training pace reference.
- If the user opens Target pace, reselects the same Training pace, and changes nothing else, this is a no-op and should not trigger propagation.

## Target Pace UI

Collapsed row:

- Row label:
  - `Target pace` for easy, tempo, and long sessions.
  - `Rep target pace` for interval sessions.
- Primary value: numeric pace or range, using Space Mono.
- Caption:
  - `{Name} · Training pace` for Training pace selections.
  - `Custom pace` for custom single pace.
  - `Custom range` for custom pace range.

Expanded row:

- Remove the visible Single/Range segmented control.
- Show `Training paces` first.
- Show relevant Training paces only, plus the currently selected Training pace if it is unusual for the session type.
- Render Training paces as full-width two-line options:
  - first line: name, e.g. `Threshold`
  - second line: numeric target and effort cue, e.g. `4:14-4:27/km · controlled hard`
- Render Custom options below:
  - numeric chips around the current row value
  - `Custom pace...`
  - `Custom range...`
- Custom chips wrap instead of horizontal scrolling.
- `Custom range...` expands inline below the custom options with `Faster end` and `Slower end`.
- Training pace effort cues are secondary captions only. Do not make effort editable in this row.
- Header preview updates live as pace options change.
- Selecting an option should not auto-collapse the row.

Metric colour rule:

- Collapsed rows may keep values neutral to avoid a rainbow editor.
- The currently expanded row should colour its primary value by metric namespace.
- Pace values use pace teal.
- Distance and distance-based rep length values use distance cobalt.
- Time-based rep length, recovery, warm-up, and cool-down values use time brass.
- Session type colour remains reserved for session identity.

Relevant Training pace defaults:

| Session type | Training pace options |
|---|---|
| EASY | Recovery, Easy, Steady |
| LONG | Easy, Steady, Race pace |
| TEMPO | Threshold, Race pace |
| INTERVAL | Interval |
| REST | No pace editor |

Include the current selected Training pace even if it falls outside the normal set. Example: a Tempo session using `Steady` should still show `Steady` when reopened, alongside relevant Tempo options.

Race pace is part of Training paces even when it is a single pace. It should display as `Race pace · Training pace`. Race pace is edited through the race goal/target flow later, not directly inside Training paces for this pass.

## Custom Input Behaviour

Custom inputs should be easy to replace on mobile.

- If a field is prefilled, select all text on focus or provide equivalent low-friction replacement.
- `Custom range...` opened from a Training pace should prefill from the current Training pace range.
- `Custom pace...` opened from a range should prefill the representative midpoint.
- `Custom range...` opened from no useful current target may use a sensible range around the current anchor.
- Allow equal faster/slower ends. Display equal ranges as a single pace where display helpers already collapse them.

## Propagation Model

Keep the existing same-day-slot propagation model.

Propagation is not "all similar sessions" and not "all sessions using this Training pace". It is the same session slot across the selected scope.

Approved copy:

- `This session only`
- `This session in remaining weeks`
- `This session in this phase`

Default scope:

- Live Block edits: default to `This session only`.
- Plan Builder / review block: may default to `This session in remaining weeks`, because the runner is shaping the plan before living inside it.

Scope meaning:

- `This session only`: applies only to the edited session.
- `This session in remaining weeks`: includes the edited session and matching same-day slots through the end of the block.
- `This session in this phase`: applies to matching same-day slots in the same phase.

Use weekday/date context where available in live Block copy. In undated Plan Builder contexts, use `this session slot`.

Do not show propagation if nothing materially changed.

Completed sessions are protected. They do not need a routine warning in the session propagation sheet unless testing shows confusion.

## Structural Field Rules

These fields use the same session-slot propagation model as pace, but they do not have Training pace vs Custom source semantics.

Editor presentation rules:

- Non-interval Distance expansion should not repeat `Distance` as both row label and editor subsection label.
- Interval Repetitions expansion has two concepts: number of reps and rep length.
- The `km/min` unit toggle applies to rep length, not the number of reps, so place it with the Rep length control.
- Interval sessions must continue to show Cool-down wherever the interval editor state includes Warm-up.

| Field | Propagation behaviour |
|---|---|
| Distance | Apply distance delta across same slot where existing progression should be preserved. |
| Reps | Apply rep delta across same slot where interval progression should be preserved. |
| Rep length | Copy exact rep length across chosen scope. |
| Warm-up | Copy exact value across chosen scope. |
| Cool-down | Copy exact value across chosen scope. |
| Recovery | Copy exact value across chosen scope. |

Warm-up, cool-down, recovery, rep length, distance, and reps are all real planned structure. Weekly volume totals must update after propagation.

Completed sessions remain protected for all fields.

## Training Paces Settings Save

Settings > Training paces edits reusable Training paces, not individual session slots.

Saving should require confirmation when future sessions are affected.

Suggested confirmation:

Title: `Update Training paces?`

Body: `Future sessions using these Training paces will update. Custom paces and completed sessions will stay as they are.`

Button: `Update Training paces`

No scope picker is needed here. The action updates future sessions using Training paces and protects completed sessions and custom overrides.

Affected counts are useful but not required for the first implementation. If cheap to compute, use copy like `This updates 18 future sessions using Training paces.`

## Analysis Tolerance

Custom pace stores a single pace in the plan. Analysis may still use hidden tolerance.

Do not represent a single Custom pace as a tiny range in the planned target model just to make analysis less strict.

Prefer absolute pace tolerances over percentage tolerances:

- Easy and long: looser, roughly 15-20 sec/km, with slower effort-led running treated carefully.
- Tempo and threshold: roughly 5-10 sec/km.
- Intervals: roughly 3-5 sec/km for work reps, depending on rep length and GPS noise.

Use existing comparison helpers where possible before adding new thresholds.

## Import and Future Goal Editing

Plan import is out of scope for the current beta, but these future rules are documented now:

- Imported plain `5:00/km` should remain a Custom pace unless parsing confidently maps the text to a Training pace.
- Imported text like `easy`, `threshold`, `MP`, or `race pace` may map to Training paces if parsing confidence is high.
- Changing race target later should update Race pace and future sessions using Race pace, with the same confirmation/protection model.
- Race pace is not directly edited in the Training paces screen for this pass.

## Implementation Notes

Likely files:

- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/ui/EditableChipStrip.tsx`
- `packages/app/components/plan-builder/PropagateModal.tsx`
- `packages/app/features/plan-builder/session-editing.ts`
- `packages/types/src/lib/propagate-change.ts`
- `packages/types/src/lib/intensity-targets.ts`
- `packages/app/app/settings/training-paces.tsx`
- `packages/app/components/pace-profile/TrainingPaceProfileEditor.tsx`
- tests under `packages/app/tests` and `packages/types/tests`

Keep domain behaviour in shared helpers. Do not bury propagation, no-op detection, or target-source semantics in screen components if a small shared boundary can hide the complexity.

## Test Obligations

Behavioural tests should cover:

- Training pace selection stores a Training pace target, not frozen numbers.
- Custom pace selection stores a custom single pace.
- Custom range selection stores a custom range.
- Editing non-pace fields preserves existing Training pace references.
- Reselecting the same Training pace with no other changes does not trigger propagation.
- Live Block propagation default is `This session only`.
- Plan Builder propagation can remain broader.
- Propagation copy uses `This session...` wording.
- Completed sessions are protected for pace and structural edits.
- Distance and reps preserve progression by delta.
- Rep length, warm-up, cool-down, and recovery copy exact values.
- Weekly volume totals update after propagated structural changes.
- Training paces settings confirmation protects completed sessions and custom overrides.

Avoid tests that assert private helper calls. Test through public helpers and rendered user-visible behaviour.

## Out of Scope

- Editing Training paces inside SessionEditor.
- Adding a link from SessionEditor to Training paces.
- Plan import parsing.
- Race target editing UI.
- Steady AI notifications that suggest Training pace changes.
- Embedded quality long run modelling.
