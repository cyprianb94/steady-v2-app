# Sync My Run — Wireframes

HTML wireframes for the new *"I just finished a run, sync it"* flow.

These are **not mockups** — they are reference artifacts that use the real design tokens from `packages/app/constants/` (colours, typography, session-type accents) so a coding agent can translate them into React Native with zero visual drift.

## How to view

Open any `.html` file directly in a browser (double-click). Each page is self-contained and pulls:
- `tokens.css` — CSS variables mirroring the live app constants
- Google Fonts (Playfair Display, DM Sans, Space Mono) — free equivalents of the embedded app fonts

No build step, no dependencies.

## Screens

| # | File | Screen | Component name |
|---|---|---|---|
| 01 | [`01-home-entry.html`](01-home-entry.html) | Home (Today) with new "I just finished this run" CTA | `HomeScreen`, `TodayHeroCard`, `FinishedRunCta` |
| 02 | [`02-syncing.html`](02-syncing.html) | Transient "Pulling from Strava" overlay | `SyncingOverlay` |
| 03 | [`03-run-detail-matched.html`](03-run-detail-matched.html) | **Core screen** — Run Detail, matched to today's plan | `RunDetail`, `SplitsList`, `PlannedVsActual`, `SubjectiveInputPrompt`, `NiggleList` |
| 04 | [`04-run-detail-unmatched.html`](04-run-detail-unmatched.html) | Run Detail — no matched session (bonus run) | same as 03, minus `PlannedVsActual` |
| 05 | [`05-match-picker.html`](05-match-picker.html) | Re-assign match picker | `MatchPicker` |
| 06 | [`06-multi-run-picker.html`](06-multi-run-picker.html) | Strava returned multiple new runs | `NewRunPicker` |
| 07 | [`07-shoe-picker.html`](07-shoe-picker.html) | Change shoe for this run | `ShoePicker` |
| 08 | [`08-niggle-picker.html`](08-niggle-picker.html) | Flag a niggle (body part / side / severity / when) | `NigglePicker` |
| 09 | [`09-home-post-save.html`](09-home-post-save.html) | Home after save — completed card with "Review run" link | `TodayHeroCard` (completed state) |

## Design tokens used

See [`tokens.css`](tokens.css) for the full set. Headline rules:

| Token | Hex | Purpose |
|---|---|---|
| `--cream` | `#F4EFE6` | App background (paper) |
| `--surface` | `#FDFAF5` | Cards, modals |
| `--card` | `#F0EAE0` | Secondary cards |
| `--border` | `#E5DDD0` | Hairlines |
| `--ink` | `#1C1510` | Primary text |
| `--ink2` | `#3D3028` | Body copy |
| `--muted` | `#9A8E7E` | Meta text |
| `--forest` / `--forest-bg` | `#2A5C45` / `#EEF4F1` | EASY |
| `--clay` / `--clay-bg` | `#C4522A` / `#FDF0EB` | INTERVAL |
| `--amber` / `--amber-bg` | `#D4882A` / `#FDF6EB` | TEMPO |
| `--navy` / `--navy-bg` | `#1B3A6B` / `#EDF1F8` | LONG |

Fonts: **Playfair Display** (serif display) / **DM Sans** (body) / **Space Mono** (all numeric data).

## Shared Home primitives

The Home-layout screens (01, 02, 09) share a locked shell. These primitives live in `tokens.css` and should be reused verbatim when translating to React Native components:

| Primitive | Class | Purpose | Component |
|---|---|---|---|
| Week header | `.week-header` / `.week-meta` / `.week-title` | "APR 6 – 12 · 2026 / Week 2 · Base Phase" above every Home screen | `WeekHeader` |
| Weekly load bar | `.load-bar-card` / `.load-header` / `.progress-track` / `.progress-fill` | Already implemented in the live app. Shows actual vs planned km, 5px forest-filled track, actual in forest mono, planned in muted mono | `WeeklyLoadCard` |
| THIS WEEK list | `.list-divider` / `.day-list` / `.day-row` / `.day-dot.{easy,interval,tempo,long,rest}` / `.day-status.{ok,warn,miss}` / `.day-km` | Compact vertical list of the remaining week. 48px day label, 8px coloured dot + session name, status glyph + actual km. `.upcoming` fades the km to border-grey | `RemainingDaysList` |

Locked Home structure, top-to-bottom: `WeekHeader → WeeklyLoadCard → TodayHeroCard → (contextual CTA | completed state) → RemainingDaysList`. This matches the pattern already agreed in `landing/wireframes/today-hero.html`.

## Golden rules

1. Backgrounds are always paper-cream (`--cream`) or paper-white (`--surface`). Never pure `#FFF`.
2. Numbers (km, pace, HR, duration, splits) are **always** monospaced (`--mono`). Titles and stats use the serif (`--serif`). Sans is for labels and body only.
3. One session accent per screen. Never mix accent colours inside a single card.
4. Labels are tiny (10px), uppercase, wide-tracked (1.3 letter-spacing), in `--muted`.
5. No gradients, no purple, no glassmorphism. Depth comes from warm surface-on-surface layering.
6. Card radius 16px (hero), 10px (inner), 999px (pills/chips/buttons).

## When implementing

Each screen's annotations column (right side of the HTML) lists the component breakdown and the app files each piece would map to. Follow those mappings when translating to React Native.
