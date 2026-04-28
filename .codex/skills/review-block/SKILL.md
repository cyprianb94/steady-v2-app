---
name: review-block
description: Use when working on the Review your block screen, BlockReviewSurface, weekly volume review chart, Structure/Weeks tabs, Block-style week rows, phase summary, progression controls, or when reusing that review UI elsewhere 1:1.
---

# Steady — Review Your Block

Use this skill whenever the app needs the settled "Review your block" experience or a 1:1 copy of it in another flow. Do not rebuild this screen from scratch. Reuse the shared components and model below, then adapt only data/callback wiring.

## Source Of Truth

Code:
- `packages/app/components/block-review/BlockReviewSurface.tsx`
- `packages/types/src/lib/block-review.ts`
- `packages/app/components/block/BlockWeekList.tsx`
- `packages/app/components/block/AnimatedWeekExpansion.tsx`
- `packages/app/features/plan-builder/review-block-integration.tsx`
- `packages/app/app/onboarding/plan-builder/step-plan.tsx`

Core APIs:
- Build data with `buildBlockReviewModel({ weeks, phases, progressionPct, progressionEveryWeeks, currentWeekIndex })`.
- Render the review with `BlockReviewSurface`.
- Use `BlockWeekList` for the Weeks tab; it owns the Block-style week row visuals, expanded day rows, drag affordances, and collapse animation.
- Use `PropagateModal` after session edits or day-order changes that need scope selection.

Hard rules:
- Keep the two tabs: `Structure` and `Weeks`. Do not reintroduce `Overview` or `Phases`.
- The screen starts on `Structure`; the primary CTA moves to `Weeks`, then saves/continues from `Weeks`.
- Do not duplicate summary stats outside the chart card. Start/Peak/Race live below the graph.
- Do not show the old helper label `Edit sessions - any change will ask where to apply`.
- Do not add divider lines between expanded day rows.
- Do not silently apply drag rearranges; open `PropagateModal` so the user chooses scope.

## Screen Shell

Plan Builder wrapper: `PlanBuilderReviewBlock`.

Layout:
- Root background `C.cream`.
- Header: `paddingHorizontal: 18`, `paddingTop: 60`, `paddingBottom: 10`.
- Step label: `STEP 6 OF 6`, DM Sans semibold 10, muted, `letterSpacing: 1.5`, `marginBottom: 4`.
- Title: `Review your block`, Playfair bold 22, line height 28, `C.ink`.
- Structure subtitle: race label, target time, week count, race date. Target time is Space Mono bold and navy.
- Weeks subtitle: `Tap a week to inspect or edit sessions.`
- Body `ScrollView`: horizontal padding 18, bottom padding 18.
- Footer: horizontal padding 18, top padding 10, bottom padding 28, top border `1px C.border`.
- Footer CTA: `Review weeks ->` on Structure; `Save plan and start training ->` or saving copy on Weeks.

Scroll locking:
- While chart scrubbing, parent `ScrollView.scrollEnabled = false`.
- While dragging a week session, parent `ScrollView.scrollEnabled = false`.
- Combine locks as `scrollEnabled={!isScrubbingVolumeChart && !isDraggingWeekSession}`.

## Tabs

Component: `BlockReviewTabControl`.

Visuals:
- Track height 44, padding 4, gap 4.
- Background `C.card`, border `1.5px C.border`, radius 24, overflow hidden.
- Two equal buttons, radius 20.
- Active indicator is an absolutely positioned `Animated.View`, top/bottom/left 4, background `C.surface`, radius 20.
- Text DM Sans semibold 12; muted inactive, ink active.
- On native only: `hitSlop` 10 on all sides and `pressRetentionOffset` 12 on all sides.

Animation:
- `Animated.timing` on active tab index.
- Duration 220ms, `Easing.out(Easing.cubic)`, native driver true.
- Respect reduced motion by using duration 0.

Haptics:
- Do not fire haptics for tab switches.

## Structure Tab

Panel:
- `gap: 10`, `marginTop: 10`.
- Order: weekly volume chart, progression control, phase summary card.

### Weekly Volume Chart

Component: `BlockVolumeChart`.

Card:
- Base card: `C.surface`, border `1.5px C.border`, radius 16.
- Padding: horizontal 14, top 14, bottom 13.
- Title: `Weekly volume`, DM Sans semibold 18, `C.ink`.
- Do not add explanatory subtitle copy.

Chart constants:
- `CHART_HEIGHT = 150`
- `CHART_Y_AXIS_WIDTH = 24`
- `CHART_TOP = 22`
- `CHART_BOTTOM = 122`
- `CHART_LINE_WIDTH = 2.8`
- `CHART_CURVE_SMOOTHING = 0.18`
- `CHART_PHASE_MARKER_SIZE = 8`
- `CHART_SELECTED_MARKER_SIZE = 12`
- `CHART_X_AXIS_LABEL_WIDTH = 40`
- `CHART_TOOLTIP_WIDTH = 132`
- Scrub hit band: `CHART_TOP - 16` through `CHART_BOTTOM + 30`

Line rendering:
- Build `pathD` through `buildReviewVolumeChartModel`.
- Draw one continuous `react-native-svg` `Path` with cubic `C` commands.
- Use `strokeLinecap="round"` and `strokeLinejoin="round"`.
- Use an SVG `LinearGradient` with sharp phase stops for phase colour changes.
- Never draw the curve as many rotated `View`s or many tiny line/dot segments.

Axes and markers:
- Reserve a 24px y-axis gutter on the left so numeric labels do not overlap the curve while preserving plot width.
- Show `km` label above the top y-axis tick in Space Mono 9 muted, right-aligned with the tick labels.
- Show y-axis tick values in the left gutter for every nice tick, including `0`.
- Show y-axis line from chart top to bottom in muted border colour.
- Show visible solid horizontal grid lines at every nice y-axis tick, including the baseline; grid lines start after the y-axis gutter.
- Show phase-start circular markers only. Marker background = phase colour, border `1.5px C.surface`.
- Show x-axis labels only at phase-start weeks (`W1`, `W4`, `W13`, etc.) and keep them close to the baseline, not floating near the bottom of the frame. Center each 40px label box on the same x coordinate as its phase-start marker.
- Do not show a separate `Race` x-axis label.

Scrubbing:
- Chart responder starts only inside the scrub hit band.
- On grant: set scrub active, select nearest week from x.
- On move: select nearest week from x.
- On release/terminate/unmount: clear selection and call `onScrubActiveChange(false)`.
- Use `triggerSelectionChangeHaptic()` only when selected week changes.

Tooltip:
- Pointer events none.
- Width 132.
- Tooltip card padding horizontal 9, vertical 8, radius 10, border `1px C.border`, background `C.surface`.
- Title: `W{weekNumber} {Phase}` where phase is DM Sans semibold, bold/coloured with `PHASE_COLOR[phase]`.
- Second line: date range from `formatReviewWeekDateRange`, e.g. `Apr 11 - 18`.
- Third line: `{volume} total`, Space Mono bold 11, `C.ink2`.

Stats and phase strip:
- Stats grid has 3 boxes: `Start`, `Peak`, `Race`; gap 7, marginTop 9.
- Stat box: flex 1, horizontal padding 8, vertical 9, radius 13, border `1.5px C.border`, background `C.surface`.
- Stat label: DM Sans semibold 9, muted, uppercase, `letterSpacing: 1.5`.
- Stat value: Space Mono bold 14.
- Phase strip: height 24, marginTop 12, gap 2, radius 7, overflow hidden.
- Phase strip segment flex = week count, min width 6, background = phase colour.
- Labels are uppercase, DM Sans semibold 8.5, `letterSpacing: 1`, cream-toned text. Use compact labels (`B`, `BLD`, `REC`, `PK`, `TP`) when the segment is too narrow.

### Progression Control

Component: `BlockReviewOverloadCard`.

Unconfirmed:
- Card padding horizontal 14, vertical 13.
- Background `C.amberBg`, border `${C.amber}57`.
- Title `Progression`, DM Sans semibold 15.
- Copy DM Sans 11/14 muted.
- Primary choice: amber pill, minHeight 34, horizontal padding 11, radius 18.
- Secondary choices: surface pill, border `1.5px C.border`.
- Custom state: percentage chips and inline fields. Presets default to 5, 7, 10, 12, 15.
- Custom field: minHeight 38, radius 19, border `1.5px C.border`, Space Mono bold 13 value, suffix DM Sans medium 11.5.

Confirmed:
- Compact green confirmation bar.
- Horizontal padding 12, vertical 8, radius 10.
- Border `${C.forest}25`, background `C.forestBg`.
- Left check and text, right `change` link.
- Text: `+7% progression every 2 weeks.` or flat equivalent.

### Phase Summary

Component: `BlockReviewPhaseSummaryCard`.

Visuals:
- Min height 68.
- Horizontal padding 12, vertical 11.
- Row layout, `justifyContent: space-between`, gap 12.
- Background `C.card`, border `1.5px C.border`, radius 14.
- Title `Phase structure`, DM Sans semibold 15.
- Value from `model.structureLabel`, Space Mono bold 10, line height 16, muted, marginTop 6.
- Right action column aligns end with gap 9.
- Mini phase strip: width 78, height 11, gap 2, radius 7, overflow hidden.
- Edit link: DM Sans semibold 12, clay.

## Weeks Tab

Component path: `BlockReviewWeeks -> BlockWeekList`.

Wiring:
- Pass `weekStartDate` inferred from race date so expanded day rows show real dates.
- Pass `expandedWeekIndex`.
- Pass `onDragActiveChange` to lock parent scrolling during handle drag.
- Pass `rescheduleResetKey` so cancelled scope sheets reset local reorder drafts.

List:
- Outer review style: gap 8, marginTop 10.
- `BlockWeekList` internal row gap: 5.

Collapsed week row:
- Padding horizontal 11, top 10, bottom 9.
- Radius 12, border width 1.5.
- Default border transparent; past border `C.border`; current/expanded background `C.surface`, border `${C.clay}59`.
- Header row flex, align center, gap 7.
- Left column width 38.
- Week number: Space Mono bold 11, muted; clay when current/expanded.
- Phase mini label: DM Sans 8, muted, uppercase, marginTop 1.
- Dots: 7 dots, 9x9, radius 4.5, gap 3.5, session type colours.
- Right width 50, km label Space Mono bold 10.
- Volume bar height 2, marginTop 8, radius 999, background `rgba(229, 221, 208, 0.72)`.
- Fill uses `AnimatedProgressFill`, phase colour, duration 520ms, `Easing.out(Easing.cubic)`, reduced-motion immediate.

Expanded behavior:
- Keep collapsed content mounted while closing; do not conditionally remove immediately.
- Use `AnimatedWeekExpansion`.
- In Review surface: `expandedMarginTop = 10`, `showDivider = false`.
- Expand duration 200ms, `Easing.out(Easing.cubic)`.
- Collapse duration 130ms, `Easing.in(Easing.cubic)`.
- Animate height, opacity, marginTop, optional paddingTop/borderTop, and translateY from -4 to 0.
- Respect `ReduceMotion.System`.
- `onCollapseEnd` is what unmounts the expanded body.

Expanded day row:
- No helper label by default and no divider lines.
- Row wrapper marginBottom 4.
- Day row minHeight 40, radius 10, row layout, align center.
- Pressable content is row layout and flex 1.
- Day meta width 74.
- Day name: DM Sans semibold 12, `C.ink2`.
- Day date: DM Sans 10, muted.
- Session area: flex row, gap 8, minWidth 0.
- Dot: 9x9, radius 4.5, session type colour; rest uses slate.
- Session title: Space Mono 13 for run sessions, ink.
- Rest title: DM Sans medium, ink.
- Caption: DM Sans 10.5, muted, marginTop 1. Rest caption is `Recovery slot locked in for this day`.
- Right area minWidth 34, align end, paddingRight 2.

Drag handle:
- Use `DragHandle`.
- Width 38, minHeight 32, radius 16, gap 3, marginRight 2.
- Default platforms show three bars, each width 18 and height 2.5; Android uses two 16px bars.
- Bar colour `C.muted`; disabled colour `C.border`.
- Active background `${C.clay}12`.
- `delayLongPress = 160`.

Drag behavior:
- Use `useDirectWeekReschedule`.
- Rest/null slots are draggable; do not disable the rest-day handle.
- Record touch start on handle touch/mouse down and call `onDragActiveChange(true)`.
- Begin drag on long press/touch or mouse down, update with page/client Y, finish on touch/mouse end, cancel on terminate.
- While dragging, translate the dragged row with the hook's `dragY`.
- Drop target outline: absolute top/bottom -6, left -10, right -6, radius 14, border 1.5 dashed clay.
- Dragging row gets clay shadow, opacity handled by existing row.
- Hook fires drag-start and valid-slot haptics through semantic haptic helpers.
- On finish with changed indices, call `onMoveSession(week, fromDayIndex, toDayIndex)`.

Reschedule scope:
- In Plan Builder, `onMoveSession` stages a pending rearrange.
- Show `PropagateModal` with title `Where should this reschedule apply?`, body explaining local vs matching plan scope, and apply label `Apply reschedule`.
- Scope labels: `Just this week`, `This week + following weeks`, `{Phase} weeks only`.
- On apply, commit with `propagateSwap(plan, weekIndex, from, to, scope, sourceWeek.phase)`.
- On close/cancel, bump `rescheduleResetKey` so the local drag draft resets.

## Model Contract

`buildBlockReviewModel` returns:
- `totalWeeks`
- `progressionPct`, `progressionEveryWeeks`, `overload`
- `weeks`: week number, phase, planned km, volume ratio, sessions, start/peak/race/current flags
- `phases`: week count, range label, start/end/peak/average km, summary
- `phaseSegments`: contiguous phase runs for the chart and strips
- `volume.stats`: start, peak, race, average, max
- `structureLabel`: `3w base · 9w build · 0w recovery · 2w peak · 2w taper`

Phase order is always:
`BASE -> BUILD -> RECOVERY -> PEAK -> TAPER`

Use `formatDistance` from preferences when rendering. Use race date to infer week date ranges and day dates.

## Verification

Required focused tests when changing this surface:
- `npm run test -w packages/app -- block-review-surface.test.tsx block-week-list.test.tsx step-plan.test.tsx`
- `npm run typecheck`
- `git diff --check`

Test expectations:
- Structure tab renders chart, stats, phase strip, progression, phase summary.
- Chart uses one SVG path, not segmented views.
- Scrubbing shows tooltip, haptics fire on selected-week changes, and parent scroll locks.
- Tabs remain controlled and touch-friendly.
- Weeks tab renders `BlockWeekList`, expands/collapses with animation, and no helper/divider rows.
- Day rows open the shared full-screen session editor.
- Dragging run or rest rows locks scroll, stages a reschedule, opens `PropagateModal`, and applies via `propagateSwap`.
