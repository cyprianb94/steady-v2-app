---
name: plan-builder
description: Use when working on onboarding, plan creation, phase editing, template weeks, generated plan review, or plan-builder UX and logic.
---

# Steady — Plan Builder

Use `/brand-and-content` alongside this skill when changing onboarding wording, plan-builder microcopy, CTA labels, helper text, or the tone of Steady hints. Use `/design-system` for the visual/editor control patterns.

The plan builder is a 3-step onboarding flow that creates the user's training plan. It is the most complex UI in the app. A complete working prototype exists in `steady-plan-builder.jsx` — read it fully before implementing.

The three steps:
1. **Goal** — race type, target time, total weeks, phase structure
2. **Template week** — design one repeating week with all sessions
3. **Full plan** — review and edit the generated N-week plan

A progress bar (3 segments) sits below the nav header throughout. Back navigation between steps.

---

## Step 1: Goal

**Component:** `StepGoal` in `steady-plan-builder.jsx`

### Fields

**Race distance** — chip row:
`5K · 10K · Half Marathon · Marathon`
Default: Marathon. One selectable at a time. Active chip: `background: C.clayBg, border: C.clay, color: C.clay`.

**Time target** — chip row, options vary by distance:
- 5K: sub-18, sub-20, sub-22, sub-25
- 10K: sub-38, sub-42, sub-45, sub-50
- Half Marathon: sub-1:25, sub-1:30, sub-1:45, sub-2:00
- Marathon: sub-3:00, sub-3:15, sub-3:30, sub-4:00
Font: Space Mono (these are data values).

**Weeks to race** — horizontal range slider, 8–24 weeks. Live `Space Mono` label showing current value. Changing weeks resets the phase structure to default proportions.

**Customise phases** — collapsible section. Collapsed state shows:
- Mini phase bar preview (60×10px colour strip)
- One-line summary: "3w Base · 9w Build · 0w Recovery · 2w Peak · 2w Taper"
- Chevron

Expanded state shows `PhaseEditor`.

### PhaseEditor component

**Visual bar** — full-width, 28px height, `borderRadius: 8px`. Segments proportional to week counts, coloured by phase. White uppercase label if segment is wide enough. Zero-week phases disappear entirely.

**Per-phase rows** — one row per phase: BASE, BUILD, RECOVERY, PEAK, TAPER:
- Left: 8px colour dot + phase name (DM Sans 600 12.5px) + description (muted 10.5px)
- Right: stepper control — `[−][{n}w][+]` as three joined segments
- BUILD row: steppers disabled, labelled "auto-adjusts". BUILD fills whatever weeks remain after other phases are set. Never drops below 1 week.
- RECOVERY: minimum 0 (can be zero — it's optional). When >0, recovery weeks are spread evenly through the build section during plan generation.
- Total counter at bottom: `{used}/{total} weeks ✓` — forest colour when balanced, clay when not.

**Phase defaults** (calculated from total weeks):
```
taper    = max(2, round(total × 0.13))
peak     = max(1, round(total × 0.13))
recovery = 0
base     = max(1, round(total × 0.20))
build    = total - base - peak - taper - recovery
```

### Steady hint card
Forest-coloured card below the phase section. Updates live as user changes fields. Example: "16-week Marathon plan for sub-3:30. 3w base · 9w build · 2w peak · 2w taper."

### CTA
"Build my template week →" — full-width clay button. Passes `{race, weeks, target, phases}` to next step.

---

## Step 2: Template week

**Component:** `StepTemplate` in `steady-plan-builder.jsx`

**Purpose:** Design one repeating week. This becomes the structural template that the plan generator uses for all N weeks, with progressive overload applied on top.

**Steady hint:** "This is your base week. It repeats across all {N} weeks — you'll be able to fine-tune each week individually in the next step. Set the structure here, adjust the details there."

### Default pre-filled template
```
Mon: EASY    8km @ 5:20/km
Tue: INTERVAL  6×800m @ 3:50/km, 90s recovery, 1.5km warmup, 1km cooldown
Wed: EASY    8km @ 5:30/km
Thu: TEMPO   10km @ 4:20/km, 2km warmup, 1.5km cooldown
Fri: REST
Sat: EASY    12km @ 5:20/km
Sun: LONG    20km @ 5:10/km
```

### Day cards
7 cards stacked vertically. Each card:
- `borderRadius: 12px`
- Active session: type colour bg + 35% type colour border
- Rest day: cream bg + border colour border + "Rest day" label + "+" indicator (right)
- Tapping any day opens `SessionEditor` as a bottom sheet

Content inside active day card:
- Day label left (DM Sans 600 11px, type colour)
- Full session label (e.g. "1.5km w/u · 6×800m @ 3:50 · 1km c/d") — DM Sans 500 12.5px
- Session type label below (e.g. "Intervals") — DM Sans 400 11px muted
- Chevron right

### Volume summary
Small card at bottom: "TEMPLATE VOLUME" label + `~{totalKm}km / week` in Space Mono clay. Sub-label: "Includes warm-up, cool-down and recovery jogs between reps."

**Volume calculation** — uses `sessionKm(session)` function:
```javascript
sessionKm(d) = {
  INTERVAL: (reps × intervalRepKm(d)) + (recoveryKm(recovery) × reps) + sessionDurationKm(warmup) + sessionDurationKm(cooldown)
  TEMPO: distance + sessionDurationKm(warmup) + sessionDurationKm(cooldown)
  EASY/LONG: distance
}
```

### CTA
"Generate {N}-week plan →" — passes template to Step 3.

---

## SessionEditor

**Source of truth:** `packages/app/components/plan-builder/SessionEditor.tsx`, `packages/app/components/ui/ChipStripEditor.tsx`, `packages/app/lib/units.ts`, `packages/types/src/session.ts`.

`SessionEditor` can render as a bottom sheet in the plan builder or as the full-screen `/edit-session` route from Block. The field model and control patterns are the same in both presentations. Header shows day name plus a live session label from the current field state.

All non-rest fields use notebook-row expandable controls. Do not reintroduce separate above-row interval controls, standalone rep-distance strips, or scroll drums inside the current session editor.

### Shared top section

**Session type** — `ChipRow` with five session chips: `EASY`, `INTERVAL`, `TEMPO`, `LONG`, `REST`. Active chip uses the session type colour. Changing type applies `TYPE_DEFAULTS`, carries useful pace/distance where appropriate, closes expanded rows, and clears custom editing.

### Interval sessions

Exact row order:

`Session type → Repetitions → Rep target pace → Recovery between reps → Warm-up → Cool-down`

**Repetitions**
- Notebook row label: `Repetitions`.
- Summary value: `{reps}×{rep length}`.
- Expanded editor uses `RepStepper` with min 2, max 20.
- Trailing `UnitTogglePill` switches rep length between `km` and `min`.
- Rep length presets render through `ChipStripEditor`.
- Custom rep length is the inline `Custom...` chip, not a separate input row.

**Rep target pace**
- Notebook row label: `Rep target pace`.
- Expanded editor uses `EditableChipStrip`.
- Preset pace chips are generated from the current pace and session type.
- Custom pace is the inline `Custom...` chip with `/km` inside the pill.

**Recovery between reps**
- Notebook row label: `Recovery between reps`.
- Trailing `UnitTogglePill` switches recovery between `km` and `min`.
- Expanded editor uses `ChipStripEditor`.
- Custom recovery is the inline `Custom...` chip.

**Warm-up and Cool-down**
- Each is its own notebook row.
- Each has a trailing `UnitTogglePill` for `km`/`min`.
- Expanded editor uses `ChipStripEditor`.
- `0` means off. Custom values stay inside the chip strip.

### Easy and long sessions

Exact row order:

`Session type → Distance → Target pace`

Easy and long runs do not expose warm-up or cool-down rows. Their planned distance is the run.

### Tempo sessions

Exact row order:

`Session type → Distance → Target pace → Warm-up → Cool-down`

**Distance**
- Notebook row label: `Distance`.
- Summary value uses the current app distance units for display.
- Expanded editor uses `ChipStripEditor`.
- Custom distance is the inline `Custom...` chip.

**Target pace**
- Editable for all non-rest session types: easy, tempo, long, and interval.
- Expanded editor uses `EditableChipStrip`.
- Custom pace is the inline `Custom...` chip with `/km` inside the pill.

**Warm-up and Cool-down**
- Same pattern as interval sessions: `UnitTogglePill` plus `ChipStripEditor`.
- These fields are available for tempo sessions as optional easy-effort volume before/after the main run.

### Rest sessions

Rest disables metric rows and shows muted placeholders. Saving a rest session returns `{ type: 'REST' }`.

### Keyboard and custom-field behaviour

- Custom scroll targets are fixed: distance 80, repetitions 80, pace 120, recovery 180, warmup 280, cooldown 340.
- Compact custom keyboard padding is 44.
- Non-interval warm-up/cool-down custom padding is 72 because those forms have less content than interval and need extra scrollable space.
- `ChipStripEditor` uses `decimal-pad` for custom numeric inputs.
- Selecting a preset closes the matching custom field.

---

## Step 3: Full plan

**Component:** `StepPlan` in `steady-plan-builder.jsx`

### Review block surface

For the full reusable implementation spec, use `/review-block`. That skill is the source of truth for a 1:1 copy of the Review your block screen, including chart behavior, tabs, week-row animations, drag/reschedule scope, and verification.

The Plan Builder final review should use the shared review surface instead of bespoke local cards:
- `packages/app/features/plan-builder/review-block-integration.tsx`
- `packages/app/components/block-review/BlockReviewSurface.tsx`
- `packages/types/src/lib/block-review.ts`

The review has two tabs: `Structure` and `Weeks`.
- No `Overview` or separate `Phases` tab.
- Structure owns weekly volume, progression controls, and phase structure editing.
- Weeks owns Block-style week rows and expanded session editing.

Weekly volume graph requirements:
- Reuse `BlockVolumeChart` / `buildReviewVolumeChartModel` from `BlockReviewSurface`.
- The curve must be a single continuous `react-native-svg` `Path`, not a set of short rotated views.
- Keep phase-coloured gradient stroke, phase-start markers, compact y-axis gutter with `km` above the top tick, y-axis tick values, horizontal grid lines, phase-start x labels close to the baseline and centered on their markers, scrubbing, haptics, scroll locking, and tooltip.
- Tooltip format: week number plus bold coloured phase name, date range, and total weekly volume.
- Do not re-add the chart subtitle copy; the graph should be self-explanatory in this review context.

### Progression card

Shown first, before the week list. Amber-coloured card.

"Steady — Add progressive overload? Volume builds automatically through the build phase, then tapers before race day."

Three choices (initially shown as buttons):
1. **"Yes, +7% / 2 weeks"** — applies 7% volume increase every 2 weeks through build phase
2. **"Custom %"** — expands inline to show preset chips (5% / 7% / 10% / 12% / 15%) plus a freetext input + "Apply {n}%" button
3. **"Keep flat"** — all weeks mirror the template volume exactly

Once a choice is made, the card collapses to a green confirmation bar: "✓ +7% progression applied" with a "change" link. The week list recalculates immediately.

### Plan generation logic

`generatePlan(template, totalWeeks, progPct, phases)` in `steady-plan-builder.jsx`:

1. Build array of phase labels for each week using `phases` object from Step 1
2. RECOVERY weeks are distributed evenly within the BUILD section (not at the end)
3. For each week, apply transformations:
   - BUILD with progression: volume multiplied by `(1 + progPct/100) ^ floor(weekIndex/2)`
   - RECOVERY: 65% of template volume (deload)
   - PEAK: 110% of template volume (highest load)
   - TAPER week 1: 80% of template volume
   - TAPER week 2+: 60% of template volume
4. All km counts use `sessionKm()`: interval/tempo bookends are counted, easy/long bookends are stripped or ignored, interval recovery jogs are counted

### Week list

All weeks rendered as rows. Not paginated — all visible in a scrollable list.

**Week row (collapsed):**
- Left: `W{n}` in Space Mono 11px (clay if expanded, muted if not)
- Middle: 7 session dots (8px, type colours)
- Right: `{n}km` Space Mono 11px
- Below: 2px volume bar proportional to this week's km as % of max week km. Colour from phase.

**Week row (expanded):**
- Row header stays visible with clay border
- Expanded body uses the same row pattern as the Block screen: weekday/date on the left, session dot + session label/caption in the middle, drag handle on the right.
- Do not show the old helper label "Edit sessions — any change will ask where to apply it".
- Do not add divider lines between day rows.
- Tapping any row opens the shared full-screen `SessionEditorScreen`.
- Dragging the handle rearranges sessions within that week using the existing direct week reschedule hook, with haptics and drop-target feedback. Rest slots are draggable too.
- After a drag, Plan Builder must open `PropagateModal` to choose where the reschedule applies; do not silently apply the reorder to one week only.

### Full-plan session editing

**Source of truth:** `packages/app/components/plan-builder/SessionEditorScreen.tsx` wrapping `SessionEditor` with `presentation="screen"`.

Full-plan review uses the same editor presentation as the Block screen. Do not reintroduce a separate inline editor, `SessionRow`, `TypeStrip`, above-row interval controls, or compact +/- distance controls.

After `SessionEditor` saves, Step 3 stages the edit and shows `PropagateModal` so the runner chooses where to apply it.

### PropagateModal

Fired after a full-screen session edit is saved from a week row.

Title: "Apply change where?" with the change description in `Space Mono clay` below.

Three options (radio select):
1. **"This week only"** — `scope: 'this'` — applies only to the expanded week
2. **"All remaining weeks"** — `scope: 'remaining'` — applies from this week to end of plan
3. **"Build phase only"** — `scope: 'build'` — applies only to BUILD-phase weeks from this point

Propagation logic:
- `'this'`: direct replacement
- `'remaining'` / `'build'`: calculates delta (e.g. distance changed by +2km) and applies that delta to all affected weeks relative to their current values. Does not overwrite — adjusts proportionally. This preserves any progression already applied.

"Apply change" — full-width clay button. Closes modal and updates plan immediately.

### CTA
"Save plan and start training →" — saves plan to storage, proceeds to integration connection.

---

## ScrollPicker implementation notes

Use `ScrollPicker` only where the current codebase still explicitly calls for a wheel/drum picker. Do not use it in the current `SessionEditor`, which uses notebook rows, `EditableChipStrip`, and `ChipStripEditor`. Key implementation details from the prototype:

```javascript
ITEM_H = 38         // px per item
VISIBLE = 5         // visible items (odd number)
PAD = 2             // padding items top and bottom

// Snap behaviour
scrollSnapType: 'y mandatory'
scrollSnapAlign: 'start'  // on each item

// Debounced snap-to-nearest on scroll end
// 120ms debounce before snapping
// Also responds to direct click on any item
```

The component must be implemented natively in React Native using `FlatList` or `ScrollView` with `snapToInterval`. The web prototype uses CSS scroll snap; React Native requires a different implementation but identical visual behaviour.
