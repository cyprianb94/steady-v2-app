---
name: screens
description: Use when implementing navigation, screen structure, information architecture, and screen-by-screen product behavior.
---

# Steady — Screens & Information Architecture

Use `/brand-and-content` alongside this skill when screen work touches labels, hierarchy copy, empty states, CTA text, notification text, or Steady AI naming. Use `/design-system` alongside this skill for visual implementation.

---

## Navigation model

Bottom tab bar with 3 tabs. No hamburger menus. No deep nesting. Everything reachable in at most 2 taps.

```
Tab 1: Home     (house icon)
Tab 2: Block    (three bars icon)
Tab 3: Settings (gear icon)
```

Active tab: `C.clay`. Inactive: `C.muted`. Tab labels capitalised. Icons are inline SVG — see `TabIcon` in `steady-app.jsx`.

The Home tab is the default home screen. The app always opens here.

Steady AI is currently frozen. Do not add a visible Settings entry, Home nudge, notification deep link, or surprise AI surface while the freeze is active. Coach mode (real human coach) is also managed in Settings when that feature is live.

---

## Information architecture

```
App
├── Home Tab  ← DEFAULT HOME
│   ├── Week header (week number, phase label, date range)
│   ├── Load bar (planned km vs actual km so far)
│   ├── No Steady AI nudge while the AI freeze is active
│   ├── 7-day session list (Mon–Sun)
│   │   └── Each day: type dot, session name, status badge, key metric
│   ├── [Tap any session] → SessionSheet (bottom sheet)
│   │   ├── Session header (type tag, name, date, status badge)
│   │   ├── Planned section (distance, pace target, HR zone)
│   │   ├── Actual section (distance, avg pace, avg HR, elapsed)
│   │   ├── Pace trace (planned dashed vs actual solid SVG)
│   │   ├── Split breakdown (interval sessions: per-rep planned vs actual)
│   │   └── No Steady's read while the AI freeze is active
│   │
│   └── [Injury active] → Home tab transforms to Recovery state
│       ├── Injury banner (injury type, date marked, recovering status)
│       ├── Goal reassessment (original vs reassessed target)
│       ├── Cross-training log (non-running activities this week)
│       └── Return-to-running progression (stepped weeks back to plan)
│
├── Block Tab
│   ├── Race header (name, date, countdown, target time)
│   ├── Phase strip (colour-banded horizontal bar, current position marked)
│   ├── Scrollable week list
│   │   └── Each week row: number, date, 7 session dots, km, phase tag, adherence bar
│   └── [Tap any week] → expands inline (same dot grid, more detail)
│
└── Settings Tab
    ├── PLAN section (training plan, goal race, mark injury)
    ├── YOUR COACH section (future: invite coach, connected coach name, coach access status)
    ├── No STEADY AI section while the AI freeze is active
    ├── INTEGRATIONS section (Strava, Apple Health, Garmin)
    └── ACCOUNT section (email, subscription tier)
```

---

## Onboarding flow

Triggered on first launch. Must complete in under 4 minutes. Consists of the plan builder (see `PLAN_BUILDER.md`) followed by integration connection.

```
Launch
→ Welcome screen (app name, single value prop line)
→ Plan Builder — Step 1: Goal (race, target, weeks, phases)
→ Plan Builder — Step 2: Template week
→ Plan Builder — Step 3: Full plan review
→ Connect integrations (Strava / Apple Health — at least one)
→ Success screen ("Plan is live. Steady is watching.")
→ Home tab (populated with plan data)
```

---

## Screen: Home Tab

**Purpose:** Daily check-in. Glanceable in under 5 seconds. Answers: what did I plan this week, what have I done, am I on track?

**Prototype reference:** `WeekTab` in `steady-app.jsx`

**Key components:**

**Week header**
- `Playfair Display 600 24px`: "Week 14 · Build Phase"
- Below: date range in `DM Sans 11px muted`

**Load bar**
- Full-width thin bar (5px height)
- Two segments: actual (forest green) / remaining (border colour)
- Labels: `Space Mono 12px` — actual km in forest, planned km in muted
- Label: "WEEKLY LOAD" uppercase DM Sans 9.5px

**Steady nudge — frozen**
- Do not render this while the AI freeze is active.
- Do not replace it with deterministic "coach note" copy.

Future implementation notes, once the freeze is lifted:
- Small card: `background: ${C.clay}0C, border: 1px solid ${C.clay}28`
- 6px dot bullet (clay), then AI text
- Max 2 lines. References specific data — not generic motivation.
- Example: "Tempo today. Your last tempo faded in the back half. Start at 4:18 — don't force 4:10 from the gun."
- Tapping it opens the Steady AI conversation screen with that context pre-loaded

**7-day session list**
- Vertical compact list (day-row pattern)
- Each day row: day name + date (left), type dot + session name (centre), status + km (right)
- Today card: receipt-style hero above the week list. Planned runs show session title, inline target, and `I finished this run`; completed runs show actual distance/pace as the hero, optional one-line note, and `FEEL · {value}` / `Review run →` footer
- Status indicator: custom run-status icon from `RunStatusIcon`: completed (forest ring/check), varied/off-target (forest partial ring/check with amber accent), unfinished/missed (clay icon)
- For completed sessions: key metric in Space Mono — e.g. "10.2km"
- Rest days: muted, no metrics

**Status badge logic:**
- `completed` — session synced, hit targets within 5%
- `off-target` — session synced, missed target by >5%; render as the `varied` run-status icon
- `missed` — planned session date passed, no sync; render as the unfinished run-status icon
- `today` — today's date, no sync yet
- `upcoming` — future dates

---

## Screen: Home Tab — Recovery State

**Purpose:** When an injury is active, the Home tab transforms to show recovery progress instead of normal training. This is NOT a separate screen — the Home tab itself changes.

**Trigger:** Runner marks an injury via Settings > Plan > Mark Injury. Steady AI suggestions are frozen.

**Key components:**

**Injury banner** (replaces week header + load bar)
- Full-width card with clay-tinted background (`clayBg`)
- "INJURY" chip (white on clay, uppercase)
- Injury name in `Playfair Display 600 22px` (e.g. "Calf Strain")
- Date: "Marked Apr 2 · Week 14 of marathon plan" in muted
- "Recovering" status pill in forest green

**Goal reassessment**
- "GOAL UPDATE" label
- Original target struck through (muted) → reassessed target (clay, bold)
- Example: ~~sub-3:30~~ → sub-3:45 reassessed

**Cross-training log**
- "CROSS-TRAINING THIS WEEK" label
- Compact day-rows showing non-running activities
- Navy dots for cross-training type, green checks for completed
- Example: "Cycling — 45min", "Swimming — 30min", "Upper Body — 40min"

**Return-to-running progression**
- "RETURN TO RUNNING" label
- Stepped card with 4 progression weeks
- Current step highlighted (clay), future steps muted
- Steps connected by a vertical line
- Example: Week 1 "Walk/Jog 3km" → Week 2 "Easy 5km" → Week 3 "Easy 8km" → Week 4 "Resume plan — Build W15"

**Exit criteria:** When the runner completes the return-to-running progression and resumes the plan, the Home tab reverts to its normal state. The injury period is preserved in the Block view as a visible phase.

---

## Screen: Block Tab

**Purpose:** Zoom out. See the whole training cycle. Understand where you are in the phase structure.

**Prototype reference:** `BlockTab` in `steady-app.jsx`

**Key components:**

**Race header**
- Race name: `Playfair Display 600 22px`
- Three metrics in `Space Mono 11px`: date (clay), weeks out (muted), target time (navy)

**Phase strip**
- Full-width horizontal bar, 26px height, 6px border-radius
- Segments proportional to phase week counts (BASE / BUILD / RECOVERY / PEAK / TAPER)
- When injury is active: an INJURY phase appears in the strip (clay colour, distinct from normal recovery)
- Current week marked with a thin vertical line indicator
- Sub-label: "Build phase · Week 5 of 8 · Peak volume approaching"

**Week list**
- Each row: `padding: 10px 14px, borderRadius: 12px, border: 1px solid C.border`
- Left: `W{n}` in Space Mono 11px + date range
- Middle: 7 session dots (8px) colour-coded
- Right: `{actual}km / {planned}km` in Space Mono 11px + phase tag pill
- Below: 2px volume bar, width proportional to km as % of max week
- Past weeks show actual vs planned; future weeks show planned only (lighter)
- Injury weeks show cross-training instead of running sessions
- Tapping a week expands inline (same UX as Step 3 of plan builder)

**Implementation boundaries**
- Keep `packages/app/app/(tabs)/block.tsx` as a screen shell for auth/loading, scroll, and rendering composition.
- Derive shared review data via `packages/app/features/block-review/live-block-review-model.ts` and `packages/types/src/lib/block-review.ts`.
- Keep chart geometry in `packages/app/features/block-review/review-volume-chart-model.ts`.
- Keep live reschedule application in `packages/app/features/block-review/block-reschedule-controller.ts`; completed or matched sessions must remain locked through `block-week-resolution`.

---

## Screen: Sync Run Detail

Keep `packages/app/app/sync-run/[activityId].tsx` as a rendering shell for the route, nav, modals, and run-detail presentation. Load/reload, draft seeding, save lifecycle, stale Strava split refresh, fuelling history suggestions, and plan refresh after save belong in `packages/app/features/sync/use-run-detail-controller.ts`. Pure matching and split predicates belong in `packages/app/features/sync/sync-run-detail.ts`.

---

## Screen: Steady AI Conversation

**Current status:** Frozen. Do not expose this screen as a live user flow, accept input, call the LLM, or show proactive messages while the AI freeze is active.

**Future purpose:** The AI conversation. Proactive — Steady AI always has an opening message. A paid feature.

**Future access:** From Settings > Steady AI, or by tapping the nudge on the Home tab, or via push notification deep link.

**Prototype reference:** `CoachTab` in `steady-app.jsx` for future conversation UI only. In the current app, Steady AI is frozen and not a visible tab; hidden/deep-linked access should show a paused state. See also `AI_COACH.md` for full future specification.

**Key components:**

**Header**
- Avatar: 38px circle, `background: C.ink`, letter "S" in `Playfair Display 17px cream`
- Name: "Steady" in `DM Sans 600 15px`
- Status: green dot + "Active · reading your full plan"

**Conversation thread**
- Day label dividers: `DM Sans 10.5px muted centred`
- Steady messages: left-aligned, `background: C.card (#F0EAE0)`, `borderRadius: 5px 14px 14px 14px`, no bubble border
- User messages: right-aligned, `background: C.surface`, `borderRadius: 14px 5px 14px 14px`
- Text: `DM Sans 400 13.5px, lineHeight: 1.58`
- Timestamp: `DM Sans 9.5px muted` below each message

**Plan Edit Proposal card** (see `AI_COACH.md` for full spec)
- Appears inline in conversation when Steady AI proposes a change
- Before/after layout with amber highlight
- "Apply change" and "Discuss more" buttons
- On apply: collapses to confirmation with 10s undo

**Input bar**
- `borderRadius: 22px, background: C.cream`
- Placeholder: "Message Steady…"
- Send button (clay circle with ↑) appears only when input has text

---

## Screen: Settings Tab

**Purpose:** Manage integrations, plan, and account. Future coach and Steady AI subscription areas must stay hidden while those features are frozen/not live. Settings should feel like the least important screen in the app.

**Sections:**

**PLAN** — current training plan details, goal race, mark injury action

**YOUR COACH** — future: invite a real human coach by email, show connected coach name and status. Coach can view the full plan, all sessions (planned vs actual), and make changes directly. This section only appears if a coach is connected or the runner taps "Invite coach".

**STEADY AI** — frozen. Do not show an entry point, subscription status, or upgrade prompt while the AI freeze is active.

**INTEGRATIONS** — Strava (connected/disconnected), Apple Health, Garmin

**ACCOUNT** — email, subscription tier

Each section is a grouped card (`borderRadius: 12px, border: C.border`). Rows separated by 1px borders. Right side shows status or value.

Integration rows:
- Connected: `● Connected` in C.forest
- Disconnected: `○ Connect` in C.muted, tapping initiates OAuth

---

## Screen: Session Detail (bottom sheet)

**Purpose:** Deep understanding of one session — what was planned, what happened, what Steady thinks.

**Prototype reference:** `SessionSheet` in `steady-app.jsx`

**Sections:**

1. **Header** — type tag (uppercase, type colour), session name (Playfair 22px), date (muted), status badge (top-right)

2. **Planned** — metrics row in Space Mono: distance, target pace, HR zone. Labels in muted DM Sans 10px below each value.

3. **Actual** (only if run synced) — same layout: distance, avg pace, avg HR, elapsed time

4. **Pace trace** (only if synced + splits available) — `PaceTrace` SVG component. Dashed line = planned pace, solid line = actual pace in type colour. Legend above (two small line samples with labels). No axes — the shape tells the story. Tap to show axes.

5. **Split breakdown** (interval sessions only) — each rep as a row: planned target / actual result. Green if within 3%, amber if within 8%, red if missed by more.

6. **Steady's read** — frozen. Do not render AI analysis while the AI freeze is active. Future implementation should be 3–5 sentences and reference specific numbers.

7. **Upcoming sessions** — for future sessions with no actual, show: contextual explanation + "Check back after your run"

---

## Empty states

These must be designed, not left blank:

- **No plan created:** Illustration + "You haven't created a plan yet." + CTA to plan builder
- **No run synced today:** "No run yet today. Your {session name} is planned — it'll appear here once it syncs."
- **Steady AI — frozen:** if a hidden/deep-linked route is reached, show a paused state and no input
- **Block tab — plan just created:** Week list shows with all sessions in "upcoming" state

---

## Notifications (push)

Steady AI notifications are frozen. Do not add post-run debrief, weekly preview, missed-session, or other AI-initiated notifications until the freeze is deliberately lifted.

Future notification types, once the freeze is lifted:

1. **Post-run debrief:** "Your {session name} is ready to debrief. Steady has thoughts." — triggers within 15 minutes of a run syncing. Opens Steady AI conversation with debrief pre-loaded.

2. **Monday preview:** "Week {n} starts today. Steady has your preview ready." — triggers Monday 7am local time. Opens Steady AI conversation with week preview.

No other notification types in the future AI MVP.
