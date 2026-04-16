# Direct Reschedule — HTML Reference Screens

High-fidelity HTML screens for the direct drag-and-drop rescheduling change in onboarding and Block.

These are static product-reference artifacts, not coded app screens. They reuse the live Steady colour system, typography choices, and interaction framing so implementation can follow them closely without visual drift.

## How to view

Open any `.html` file directly in a browser.

Each screen is self-contained and uses:
- `tokens.css` for shared Steady tokens and component primitives
- Google Fonts fallbacks for `Playfair Display`, `DM Sans`, and `Space Mono`

No build step is required.

## Screens

| # | File | Purpose |
|---|---|---|
| 01 | [`01-onboarding-week.html`](01-onboarding-week.html) | Onboarding week-design screen with direct drag handles and no separate rearrange CTA |
| 02 | [`02-onboarding-drag.html`](02-onboarding-drag.html) | Active onboarding reorder state showing dragged item and drop target |
| 03 | [`03-block-week-idle.html`](03-block-week-idle.html) | Block tab with expanded week, direct drag affordance, and no `Rearrange sessions` button |
| 04 | [`04-block-week-apply-sheet.html`](04-block-week-apply-sheet.html) | Block tab after staged moves, with pending action strip and rewritten scope bottom sheet |

## Design intent

- Preserve the Steady aesthetic: warm paper surfaces, editorial hierarchy, no glossy mobile chrome.
- Make drag-and-drop feel built into the week itself, not hidden behind a separate mode.
- Keep tap-to-edit legible alongside drag-to-reorder by using handle-based drag.
- Make the Block persistence model obvious:
  1. reorder the week
  2. tap `Apply reschedule`
  3. choose scope

## Shared rules

- Session colour remains semantic only:
  - `EASY` = forest
  - `INTERVAL` = clay
  - `TEMPO` = amber
  - `LONG` = navy
  - `REST` = slate
- Titles use Playfair, numeric/meta values use Space Mono, controls and body copy use DM Sans.
- No `Rearrange` CTA appears in these flows.
- The Block bottom sheet uses plain-English copy:
  - `Where should this reschedule apply?`
  - `Just this week`
  - `This week + following weeks`
  - `{Phase} weeks only`
  - `Apply reschedule`
