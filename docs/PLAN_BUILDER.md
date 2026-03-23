# Steady — Plan Builder

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
RECOVERY_KM = { '45s':0.14, '60s':0.18, '90s':0.27, '2min':0.36, '3min':0.55, '4min':0.73, '5min':0.91 }

sessionKm(d) = {
  INTERVAL: (reps × repDist / 1000) + (RECOVERY_KM[recovery] × reps) + warmup + cooldown
  EASY/TEMPO/LONG: distance + warmup + cooldown
}
```

### CTA
"Generate {N}-week plan →" — passes template to Step 3.

---

## SessionEditor (bottom sheet)

**Component:** `SessionEditor` in `steady-plan-builder.jsx`

Full-height bottom sheet (max 90% screen). Drag handle. Header shows day name + live session label that updates as fields change.

### Sections (top to bottom)

**Session type** — 5-button grid: ○E ▲I ◆T ◉L —R. Tapping changes type. Grid uses `TYPE` metadata for colour/bg/emoji. Active button: type colour bg and border.

**Distance / reps** (varies by type):

*INTERVAL:*
- Repetitions: `RepStepper` (−/n/+) with "reps" label. Min 2, max 20.
- Rep distance: chip row — `200 300 400 500 600 800 1000 1200 1600 2000` metres. One tap selects.
- Summary card: `{reps}×{repDist}m ≈ {totalKm}km reps` in clay bg card.

*EASY / TEMPO / LONG:*
- Distance: `ScrollPicker` drum — 2–40km in 1km increments. Centre item highlighted in type colour. Suffix " km".

**Target pace** (all non-REST types):
- `ScrollPicker` drum — 3:00 to 7:00/km in 5-second increments (49 options)
- Suffix " /km". Colour matches session type.
- Sub-label describes effort: "per rep effort" / "sustained tempo, Zone 4" / "easy long effort, Zone 2" / "conversational, Zone 2"

**Recovery between reps** (INTERVAL only):
- Chip row: `45s · 60s · 90s · 2min · 3min · 4min · 5min`

**Warm-up & cool-down** (INTERVAL and TEMPO only):
- Two side-by-side `ScrollPicker` drums in a `0 0 48%` flex layout
- Options: `0.5 1 1.5 2 2.5 3 4 5` km
- Labels: "Warm-up" / "Cool-down", sub-label: "Before main set" / "After main set"

**Actions:**
- "Remove" button (destructive, left) — only shows if session exists already
- "Add session" / "Update session" (primary, right, full-width)

---

## Step 3: Full plan

**Component:** `StepPlan` in `steady-plan-builder.jsx`

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
4. All km counts use `sessionKm()` including warmup, cooldown, recovery jogs

### Week list

All weeks rendered as rows. Not paginated — all visible in a scrollable list.

**Week row (collapsed):**
- Left: `W{n}` in Space Mono 11px (clay if expanded, muted if not)
- Middle: 7 session dots (8px, type colours)
- Right: `{n}km` Space Mono 11px + phase tag pill
- Below: 2px volume bar proportional to this week's km as % of max week km. Colour from phase.
- Chevron right, rotates 90° when expanded.

**Week row (expanded):**
- Row header stays visible with clay border
- Below header: `border: 1.5px solid C.clay, borderTop: none, borderRadius: 0 0 12px 12px`
- Sub-header label: "Edit sessions — any change will ask where to apply it"
- 7 `SessionRow` components stacked

### SessionRow (inline editor)

**Component:** `SessionRow` in `steady-plan-builder.jsx`

Each row within an expanded week. Shows ALL days including REST.

**Type strip** — always visible at top of each row:
5 small chip buttons: ○E ▲I ◆T ◉L —R. Active chip highlighted in type colour. Tapping a different type:
- Fires `PropagateModal` with description "Change {day} to {TypeLabel}"
- Applies smart defaults for the new type (see `TYPE_DEFAULTS` in source)
- Carries over distance and pace where they make sense

**Volume controls** (non-REST only):

*INTERVAL:*
- Rep stepper (−/value reps/+)
- Rep distance chips (same as SessionEditor)

*EASY / TEMPO / LONG:*
- `[−2][−1]{n}km[+1][+2]` button row

**Pace override:**
- "Pace: {value} /km ▼" toggle button in type colour
- Expanding shows inline `ScrollPicker` drum labelled "Override pace for week {n}"
- Pace changes always apply to `'this'` week only (no propagation prompt)

### PropagateModal

Fired whenever a volume or type change is made in a week row.

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

The `ScrollPicker` component is critical and must work well on mobile. Key implementation details from the prototype:

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
