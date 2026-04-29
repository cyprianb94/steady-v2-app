# Today Card Direction

High-fidelity direction for simplifying the Home Today card.

Reference files:
- `wireframes/today-card-direction/index.html`
- `wireframes/today-card-direction/today-card-direction.png`

## Product Goal

The Home tab is a daily check-in. The Today card should answer one question at a time:

- Before the run: what should I go and run?
- After the run: did the run match the intent?

Do not add Steady AI to this surface. Do not introduce new analysis features here. Structured analysis belongs in run detail, with only a compact summary on the logged Today card.

## Core Decision

Before-run cards must be instructional, not analytical.

Use this structure:

1. Session type chip in the top-left corner.
2. `TODAY` label in the top-right corner.
3. Session title.
4. Date.
5. One target frame.
6. One quiet detail line only when the session needs it.
7. Finished-run CTA when the session can be logged.

After-run cards may be analytical because the run has happened.

Use this structure:

1. Session type chip in the top-left corner.
2. Status chip in the top-right corner, such as `COMPLETED` or `NEEDS REVIEW`.
3. Verdict headline.
4. One short evidence sentence.
5. Slim comparison list.
6. Optional review row to open run detail.

## Colour Language

Colour must answer exactly one semantic question.

### Session

Use session colour for:
- session type chip
- card border
- session title
- week-list dots

Session colours:
- Easy: forest `#2A5C45`
- Interval: clay `#C4522A`
- Tempo: amber `#D4882A`
- Long: navy `#1B3A6B`
- Rest: slate `#8A8E9A`

### Status

Use status colour for judgement/state only:
- Today: clay `#C4522A`
- Completed: forest `#2A5C45`
- Needs review / varied: amber `#D4882A`
- Missed / caution: clay `#C4522A`

Do not use session colour to imply judgement. A completed tempo run is not amber because it was good; amber only means tempo identity or varied/review status depending on the element.

### Metric

Use metric colour only on metric values:
- Distance: cobalt `#3D55A4`
- Pace: teal `#187F7A`
- Time/duration: brass `#9D711F`
- Effort/feel: plum `#765098`
- Heart rate: coral `#BD433B`

Labels, frames, card surfaces, and dividers stay neutral.

### Heart Rate

Remove planned heart-rate zones from the Today card.

Heart rate can appear after logging only if it explains a verdict, for example:
- `Heart rate high`
- `Effort drifted despite target pace`

If heart rate does not explain the judgement, keep it out of the Today card and leave it to run detail.

## Planned Card Variants

### Easy

Title example:
- `8km Easy Run`

Target frame:
- label: `Target`
- primary: `conversational`
- secondary: `5:33-6:06/km`

No detail line.

### Long

Title example:
- `18km Long Run`

Target frame:
- label: `Target`
- primary: effort cue when present, such as `steady` or `conversational`
- secondary: pace range when present, such as `5:10-5:40/km`

Detail line only when useful, for example fuelling or progression context if already supported by existing product behaviour. Do not invent new fuelling features in this pass.

### Tempo

Title example:
- `10km Tempo`

Target frame:
- label: `Tempo target`
- primary: `4:21-4:35/km`
- secondary: `controlled hard`

Detail line:
- `10km total · 2km warm · 1.5km cool`

If no warm-up or cool-down exists, omit that part. If neither exists, omit the whole detail line.

### Interval

Title example:
- `6×800m Intervals`

Target frame:
- label: `Rep target`
- primary: `3:47-4:10/km`
- secondary: `hard repeatable`

Detail line:
- `90s recoveries · 1.5km warm · 1km cool`

If recovery, warm-up, or cool-down is missing, omit that part. Preserve the order: recoveries, warm, cool.

### Effort-only Targets

If there is no pace target:
- show the effort cue as the primary target
- do not show a pace placeholder
- do not show `—`

Example:
- label: `Target`
- primary: `conversational`

### Pace-only Targets

If there is no effort cue:
- show the pace or pace range as the primary target
- do not show an effort placeholder

Example:
- label: `Target`
- primary: `5:33-6:06/km`

### Legacy Pace

If a session has only legacy `pace` and no richer intensity target:
- show the legacy pace as the target
- do not create fake effort copy

## Logged Card Variants

### Completed Easy or Long

Top row:
- left: session chip, for example `EASY`
- right: `COMPLETED`

Content:
- verdict, for example `On target`
- evidence sentence, for example `8.1km at 5:48/km · inside the conversational guide.`
- slim list:
  - Distance: `8.1km / 8km`
  - Pace: `5:48/km`
  - Feel: `normal` or `add feel`

Do not show heart rate unless it explains the verdict.

### Completed Tempo or Interval

Top row:
- left: session chip, for example `TEMPO`
- right: `COMPLETED` or `NEEDS REVIEW`

Content:
- verdict, for example `Fast early, faded late`
- evidence sentence based on quality work, not whole-run average
- slim quality summary list:
  - Quality pace
  - Tempo time or rep completion, depending on session type

This should align with the separate structured-session quality project:
- interval quality = work reps only
- tempo quality = tempo block only when inferable
- easy/long quality = whole activity

Warm-up, cool-down, and interval recoveries are context. They should not drive the verdict.

### Activity Linked but Details Missing

If a session has `actualActivityId` but activity details have not loaded:
- show logged state
- show `COMPLETED`
- use a neutral headline such as `Run saved`
- show planned session summary if needed
- avoid fake actual metrics

### Subjective Feel

If feel exists:
- show the saved feel in the logged comparison list
- use effort plum for the value

If feel is missing and can be added:
- show `add feel`
- do not make the missing feel look like a warning

If feel was dismissed:
- omit the prompt
- keep the logged card focused on available evidence

## Rest Day

Use the same chip pattern:
- left: `REST`
- right: `TODAY`

Content:
- headline: `Rest day`
- body: `No planned run today.`

Do not show a finished-run CTA by default.

## CTA Rules

Before-run runnable sessions:
- show the finished-run CTA
- label: `✓ I finished this run`
- supporting copy: `Looks for a recent Strava activity.`

Logged sessions:
- do not show the finished-run CTA
- use a review row only when run detail can be opened

Rest days:
- no finished-run CTA by default

## Component Boundary

Implement inside the existing Today card component unless the code becomes clearer by extracting small internal presentational helpers.

Likely component pieces:
- `TodayHeroCard`
- planned target presentation helper
- logged verdict presentation helper
- session detail line formatter

Avoid introducing a broad new card system. Keep the change scoped to the Home Today card and its tests.

## Testing Expectations

Use behaviour-focused tests through the public rendered component.

Cover:
- before easy/long shows session chip, Today label, title, effort target, pace target, and no HR zone
- before tempo shows tempo target and detail line with warm/cool when present
- before interval shows rep target and detail line with recovery/warm/cool when present
- effort-only target shows no placeholder
- pace-only target shows no placeholder
- logged easy/long shows session chip left and Completed status right
- logged structured run can show Needs review and quality summary entry point
- rest day shows Rest chip and no finished-run CTA

Avoid tests that assert implementation details such as exact component names or internal helper calls.

## Non-goals

- No Steady AI card or nudge work.
- No new analytics dashboard.
- No new heart-rate planning feature.
- No new derived calculations beyond what existing summary logic already supports.
- No redesign of the weekly volume card.
- No redesign of the week list except any tiny copy/spacing change required for visual consistency.
