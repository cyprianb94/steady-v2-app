# Steady — Design System

> Before any UI work, read `docs/BRAND_AND_CONTENT.md` and `/frontend-design/SKILL.md`. Every decision below implements the Steady brand direction and should not override it.

---

## Scope

This document owns Steady's visual implementation rules: colour tokens, typography, spacing, component patterns, layout rules, and session-editor interaction patterns.

Current implementation sources to check before changing UI:
- `packages/app/constants/colours.ts`
- `packages/app/constants/typography.ts`
- `packages/app/constants/session-types.ts`
- `packages/app/components/ui/`
- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/types/src/session.ts`

Brand, product naming, voice, vocabulary, emoji rules, and the high-level aesthetic metaphor live in `docs/BRAND_AND_CONTENT.md`.

---

## Colour tokens

These are the exact hex values used in both prototype files. Do not approximate.

```
// Backgrounds
cream:    #F4EFE6   // App background. Warm parchment. Primary surface.
surface:  #FDFAF5   // Card background. Slightly lighter.
card:     #F0EAE0   // Steady message background. Warmest tone.

// Text
ink:      #1C1510   // Primary text. Very dark warm black.
ink2:     #3D3028   // Secondary text. Slightly softer.
muted:    #9A8E7E   // Labels, metadata, placeholders.

// Structure
border:   #E5DDD0   // Dividers, outlines, separators.
```

### Session type colours

These are the most important colours in the system. Every session type has a fixed colour. These colours must be used consistently — dot indicators, backgrounds, text, borders — everywhere a session type appears.

```
INTERVAL: clay   #C4522A   bg: #FDF0EB
TEMPO:    amber  #D4882A   bg: #FDF6EB
EASY:     forest #2A5C45   bg: #EEF4F1
LONG:     navy   #1B3A6B   bg: #EDF1F8
REST:     slate  #8A8E9A   bg: #F2F2F4
```

### Phase colours

Used in the training block view and phase editor.

```
BASE:     navy    #1B3A6B
BUILD:    clay    #C4522A
RECOVERY: purple  #7C5CBF
PEAK:     amber   #D4882A
TAPER:    forest  #2A5C45
```

### Status colours (session completion)

```
completed:  forest  #2A5C45
varied / off-target: amber   #D4882A
missed / unfinished: clay    #C4522A
upcoming:   border  #E5DDD0
today:      clay    #C4522A  (with elevated shadow)
```

### Run status symbols

Weekly run-list status indicators use the hand-authored run status icon set, not text glyphs or icon-library replacements.

- `completed` uses the forest ring/check icon.
- `off-target` is displayed as `varied`: a forest partial ring/check with an amber accent dot.
- `missed` uses the clay unfinished icon.
- Source assets live in `packages/app/assets/run-status/`; render them through `packages/app/components/run/RunStatusIcon.tsx`.

---

## Typography

Three font families. Each has a specific job. Never mix them up.

### Playfair Display (serif)
- Use for: screen titles, week labels, session names in detail views, Steady avatar/name
- Weights: 400, 600, 700
- Never use for: data values, UI labels, body copy at small sizes
- Import: `https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700`

### Space Mono (monospace)
- Use for: ALL numeric data — paces, distances, HR values, times, km counts, week numbers
- Weights: 400, 700
- The defining typographic choice of the app. Every pace should look like a race result.
- Never use for: prose, labels, session names
- Import: `https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700`

### DM Sans (geometric sans)
- Use for: everything else — labels, descriptions, buttons, body copy, metadata
- Weights: 300, 400, 500, 600
- Import: `https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600`

### Font loading

The app registers local font files through Expo in `packages/app/app/_layout.tsx`. Web prototypes and marketing surfaces may use the Google Fonts imports above. Do not substitute Inter, Roboto, SF Pro, Arial, or system fonts as primary fonts.

### Type scale

```
Screen title:     Playfair Display 600, 24–26px
Section header:   Playfair Display 600, 19–22px
Session name:     DM Sans 500–600, 13–15px
Data value:       Space Mono 700, 13–18px
Label/tag:        DM Sans 700, 9–10px, 1.2–1.5px letter-spacing, uppercase
Body/description: DM Sans 400, 13px, 1.55 line-height
Metadata:         DM Sans 400, 10–11px, muted colour
```

---

## Spacing and layout

- Base unit: 4px
- Standard card padding: 12–14px
- Screen edge padding: 18px horizontal
- Section gaps: 6–8px between cards in a list
- Bottom tab bar height: 70px (including safe area)
- Status bar height: 44px
- Sheet drag handle: 36×4px pill, 10px padding above
- Max content width on landing/web pages: 720px centred
- Editorial density: tight vertical rhythm, small labels, 9–11px metadata, no roomy SaaS spacing

---

## Visual rules

### Surface

- Surface is always parchment: `C.cream` for app background, `C.surface` for cards, `C.card` for the warmest Steady message tier.
- Never use `#FFFFFF` or `#000000` as app backgrounds.
- Every colour use must mean something. Clay = INTERVAL + primary CTA + TODAY + unfinished. Amber = TEMPO + varied/off-target accent + plan-edit proposals. Forest = EASY + completed + connected. Navy = LONG + target time. Slate = REST.

### Corners

- Cards: 12px.
- Buttons: 22px pill for primary/secondary actions; 8px rounded for tighter contexts.
- Chips/tags: 20px pill.
- Bottom sheets: 22px 22px 0 0.
- Input fields: 22px pill.
- Avatars and dots: 50%.

### Borders and shadows

- Every card has a border: `1.5px solid C.border`, or session type colour at about 35% opacity when contextual.
- Dividers inside cards: `1px solid C.border`.
- Elevation is communicated through border and background, not shadow.
- Exceptions: today's session card uses `0 2px 10px rgba(196,82,42,0.20)`; bottom sheets and modals may use a large soft shadow plus the warm ink overlay.
- No neumorphism. No inner shadows on inputs. No button halo glows.

### Backgrounds and imagery

- No photographs, illustrations, full-bleed imagery, textures, grain, or repeating patterns inside the app.
- The app's warmth comes from the parchment palette and serif headlines.
- Marketing/landing visuals should use real app UI in a phone frame. Do not use abstract SVG illustrations as the main visual.

### Motion and transparency

- Motion is minimal and functional, never decorative.
- Landing scroll reveals may use opacity `0 → 1`, `translateY(20px → 0)`, `0.6s ease`, triggered once per section.
- Hover on primary buttons: opacity `0.9`. Secondary buttons: border darkens one notch. Links: underline appears.
- Press/active states stay quiet: no shrink, no dramatic colour shift.
- Focus ring: border switches to `C.clay`, never browser blue.
- Frosted glass appears only on the sticky landing header: `rgba(244,239,230,0.92)` plus `blur(12px)`.
- Modal backdrop: `rgba(28,21,16,0.60)` — warm ink, never black.
- No glassmorphism in cards. No translucent panels.

### Haptics

Default to no haptic. Steady haptics should feel like a stopwatch detent: short, precise, and tied to a real change.

Use haptics only for:
- Discrete value changes in controls such as chips, segmented units, steppers, and preset selectors.
- Physical manipulation, especially picking up a session and crossing valid slots while rearranging a week.
- Repeated but sparse detents in time-based controls, such as 5-minute fuelling ticks.
- Important explicit task outcomes, if the visual result alone is not enough.

Do not use haptics for:
- Tab navigation, route changes, opening rows, expanding/collapsing accordions, or closing sheets.
- No-op taps, active chips, disabled controls, scrolling, text input focus, keyboard input, or passive status changes.
- Routine buttons where the visual pressed state and resulting screen change are already clear.
- AI messages, nudges, recovery warnings, missed runs, or injury flows as reward/punishment feedback.

Implementation rules:
- Use semantic helpers from `packages/app/lib/haptics.ts`; do not call `expo-haptics` directly from components.
- Fire haptics only after confirming the interaction is allowed and will change state.
- Haptics must complement visible feedback, never replace it.
- Keep every haptic optional by design: the app must remain fully understandable when device or user settings suppress haptics.

### Layout

- Fixed elements: status bar at top, tab bar at bottom. Everything else scrolls.
- Bottom tab bar has 3 visible tabs: Home, Block, Settings.
- Steady AI is reached from Settings or from a Steady nudge. Do not add a visible Coach tab.
- No hamburger menus. No deep nesting. Everything reachable in at most 2 taps.
- Default home is the Home tab.

---

## Component patterns

### Cards

All cards use:
- `borderRadius: 12px`
- `border: 1.5px solid {C.border}` (default) or session type colour at 35% opacity (when contextual)
- `background: C.surface` (default) or session type bg colour (when contextual)
- No drop shadows on standard cards — elevation is communicated through border and background alone
- Exception: today's session gets `boxShadow: '0 2px 10px rgba(196,82,42,0.20)'`

### Bottom sheets

All bottom sheets (session detail, session editor, propagate modal):
- `borderRadius: '22px 22px 0 0'`
- Drag handle: centred pill, `width: 36, height: 4, borderRadius: 2, background: C.border`
- `maxHeight: '88–90%'` of screen
- Background overlay: `rgba(28,21,16,0.60)`
- Close on overlay tap

### Chat bubbles (Steady AI)

- Steady message, left: `background: C.card`, `borderRadius: 5px 14px 14px 14px`.
- Runner message, right: `background: C.surface`, `borderRadius: 14px 5px 14px 14px`.
- No borders on bubbles. No tail SVGs. The asymmetric corner is the tail.
- Text: DM Sans 13–13.5px, line height about 1.58. Timestamp: DM Sans 9.5px muted.

### Buttons

Primary action:
- `background: C.clay, color: white`
- `borderRadius: 22px` (pill shape)
- `border: 1.5px solid C.clay`
- `fontFamily: DM Sans, fontWeight: 600, fontSize: 14px`
- `padding: 12px 20px` (full-width: `width: 100%`)

Secondary action:
- `background: C.surface, color: C.ink`
- `border: 1.5px solid C.border`
- Same radius and font

Destructive:
- `background: #FEE2E2, color: #991B1B`
- `border: 1.5px solid #FECACA`

### Chip / pill tags

Session type tags (e.g. "INTERVAL"):
- `fontFamily: DM Sans, fontSize: 9–10px, fontWeight: 700`
- `letterSpacing: 1.2px, textTransform: uppercase`
- `borderRadius: 20px, padding: 3px 9px`
- Colour from session type system

Phase tags (e.g. "BUILD"):
- Same pattern, colour from phase system

### Editable chip strips

Use `EditableChipStrip` from `packages/app/components/ui/EditableChipStrip.tsx` for preset numeric choices with a custom value option. Do not add a separate input row below a chip group.

Pattern:
- Presets and custom value live in the same bordered chip strip card.
- `Custom...` is a chip. When tapped, that chip becomes the input itself.
- The input chip keeps the selected active colour, uses Space Mono, and shows the unit suffix inside the pill (`km`, `min`, `/km`).
- Once a custom value is valid, the same custom chip displays the value, for example `2.5 km` or `3:42 /km`.
- Selecting a preset exits custom editing and makes the preset chip active.

Use this pattern for session-editor distance, repetitions, recovery, target pace, warm-up, cool-down, progression percentages, or any similar compact preset-plus-custom control.

### Notebook-row session editor

Source of truth:
- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/ui/ChipStripEditor.tsx`
- `packages/app/lib/units.ts`
- `packages/types/src/session.ts`

All non-rest session editor fields use notebook-row expandable controls. Do not reintroduce separate above-row interval controls, standalone rep-distance strips, or scroll drums inside the current session editor.

Interval sessions use this exact row order:
`Session type → Repetitions → Rep target pace → Recovery between reps → Warm-up → Cool-down`

Easy, long, and tempo sessions use this exact row order:
`Session type → Distance → Target pace → Warm-up → Cool-down`

Session editor field patterns:
- `Repetitions` uses `RepStepper`, a `km`/`min` `UnitTogglePill`, and `ChipStripEditor` with inline `Custom...`.
- `Recovery between reps` uses the same `km`/`min` `UnitTogglePill` and `ChipStripEditor` custom pattern.
- `Rep target pace` and all non-rest `Target pace` rows use `EditableChipStrip`.
- `Warm-up` and `Cool-down` use `UnitTogglePill` plus `ChipStripEditor` with inline `Custom...`.
- Target pace is editable for every non-rest session type.
- Rest disables the metric rows and shows muted placeholders.

Keyboard and custom-field behaviour:
- Custom scroll targets: distance 80, repetitions 80, pace 120, recovery 180, warmup 280, cooldown 340.
- Compact custom keyboard padding: 44.
- Non-interval warm-up/cool-down custom padding: 72, because those forms have less content than interval and need extra scrollable space.
- `ChipStripEditor` uses `decimal-pad` for custom numeric inputs.

### Session dots

The universal visual shorthand for session types in grids and timelines:
- `width: 8–10px, height: 8–10px, borderRadius: 50%`
- `background: TYPE_COLOR[type]`
- REST: `background: C.border`
- Future/upcoming: full opacity (not faded)

### Scroll drum picker

Used only where the current app still explicitly uses a wheel/drum picker. Do not use it in the current session editor, which uses notebook rows and chip strips. Key characteristics:
- 5 visible items, centre item highlighted
- `scrollSnapType: 'y mandatory'`
- Centre highlight band: `background: ${activeColor}12, border-top/bottom: 1.5px solid ${activeColor}40`
- Fade gradients top and bottom
- Item heights: 38px
- Centre item: `fontSize: 17px, fontWeight: 700, color: activeColor`
- Adjacent items: `fontSize: 13px, color: C.ink2`
- Far items: `fontSize: 11px, color: C.muted, opacity: 0.3`
- Snap on scroll end with 120ms debounce

---

## Iconography

Icons are hand-authored, inline, and drawn for the app. No icon library, icon font, Lucide, or Heroicons import. Stroke weight is 1.5px with rounded caps and joins. Tab icons are defined in `packages/app/components/ui/TabIcon.tsx`. Active state uses `C.clay`, inactive uses `C.muted`.

Session type emoji indicators (used in compact contexts):
```
EASY:     ○
INTERVAL: ▲
TEMPO:    ◆
LONG:     ◉
REST:     —
```

---

## Do not

- Use `rgba(0,0,0,x)` for text — use the ink/muted/border tokens
- Use `#000000` or `#ffffff` as backgrounds anywhere
- Use Inter, Roboto, SF Pro, or system fonts — the three specified fonts only
- Add drop shadows except on modals and the today session card
- Use colour decoratively — every colour must mean something
- Make buttons rectangular — always pill-shaped (22px radius) or rounded (8–12px)
- Reintroduce separate above-row interval controls in the session editor
- Replace inline `Custom...` chips with standalone input rows below chip groups
