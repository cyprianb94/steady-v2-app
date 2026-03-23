# Steady — Design System

> Before any UI work, read `/frontend-design/SKILL.md` in the project skills folder. Every decision below is consistent with that skill. Do not override these tokens.

---

## Aesthetic direction

**The metaphor:** A coach's training notebook meets a sports timing display. Warm, physical, precise. The feeling of a well-worn Moleskine annotated in biro, combined with the authority of a Casio stopwatch.

**Reject:**
- Dark mode neon dashboards (Garmin, Whoop)
- Generic white SaaS minimalism (TrainingPeaks, Strava)
- Aggressive fitness-brand energy (any app with a bolt of lightning)
- Chart-heavy data dumps (Intervals.icu)

**Embrace:**
- Warm parchment tones — not white, not grey
- Editorial information density — clear hierarchy without visual noise
- Monospace data — all numbers look like split sheets
- Colour as semantic signal only — every colour use has a meaning

---

## Colour tokens

These are the exact hex values used in both prototype files. Do not approximate.

```
// Backgrounds
cream:    #F4EFE6   // App background. Warm parchment. Primary surface.
surface:  #FDFAF5   // Card background. Slightly lighter.
card:     #F0EAE0   // Coach message background. Warmest tone.

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
off-target: amber   #D4882A
missed:     clay    #C4522A
upcoming:   border  #E5DDD0
today:      clay    #C4522A  (with elevated shadow)
```

---

## Typography

Three font families. Each has a specific job. Never mix them up.

### Playfair Display (serif)
- Use for: screen titles, week labels, session names in detail views, coach name
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

### Session dots

The universal visual shorthand for session types in grids and timelines:
- `width: 8–10px, height: 8–10px, borderRadius: 50%`
- `background: TYPE_COLOR[type]`
- REST: `background: C.border`
- Future/upcoming: full opacity (not faded)

### Scroll drum picker

Used for pace and distance selection. This component exists in `steady-plan-builder.jsx` as `ScrollPicker`. Key characteristics:
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

Icons are SVG-only, inline. No icon library. The 4 tab bar icons are defined in `steady-app.jsx` as `TabIcon`. Active state uses `C.clay`, inactive uses `C.muted`.

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
