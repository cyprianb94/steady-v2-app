# Steady — Screens & Information Architecture

---

## Navigation model

Bottom tab bar with 4 tabs. No hamburger menus. No deep nesting. Everything reachable in at most 2 taps.

```
Tab 1: Week    (calendar icon)
Tab 2: Block   (three bars icon)
Tab 3: Coach   (chat bubble icon)
Tab 4: Settings (gear icon)
```

Active tab: `C.clay`. Inactive: `C.muted`. Tab labels capitalised. Icons are inline SVG — see `TabIcon` in `steady-app.jsx`.

The Week tab is the default home screen. The app always opens here.

---

## Information architecture

```
App
├── Week Tab  ← DEFAULT HOME
│   ├── Week header (week number, phase label, date range)
│   ├── Load bar (planned km vs actual km so far)
│   ├── Steady nudge (AI-generated, context-aware, 2 lines max)
│   ├── 7-day session grid (Mon–Sun)
│   │   └── Each day: type dot, session name, status badge, key metric
│   ├── Legend (session type colour key)
│   └── [Tap any session] → SessionSheet (bottom sheet)
│       ├── Session header (type tag, name, date, status badge)
│       ├── Planned section (distance, pace target, HR zone)
│       ├── Actual section (distance, avg pace, avg HR, elapsed)
│       ├── Pace trace (planned dashed vs actual solid SVG)
│       ├── Split breakdown (interval sessions: per-rep planned vs actual)
│       └── Steady's read (AI analysis of this specific session)
│
├── Block Tab
│   ├── Race header (name, date, countdown, target time)
│   ├── Phase strip (colour-banded horizontal bar, current position marked)
│   ├── Scrollable week list
│   │   └── Each week row: number, date, 7 session dots, km, phase tag, adherence bar
│   └── [Tap any week] → expands inline (same dot grid, more detail)
│
├── Coach Tab
│   ├── Steady header (avatar mark, name, status indicator)
│   ├── Conversation thread
│   │   ├── Coach messages (left, warm card background)
│   │   ├── User messages (right, lighter background)
│   │   ├── Session chips (inline reference to a specific session)
│   │   └── Plan Edit Proposal cards (before/after, apply/discuss buttons)
│   └── Input bar ("Message Steady…" + send button)
│
└── Settings Tab
    ├── PLAN section (training plan, goal race)
    ├── INTEGRATIONS section (Strava, Apple Health, Garmin)
    └── SUBSCRIPTION section (plan tier, account)
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
→ Week tab (populated with plan data)
```

---

## Screen: Week Tab

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

**Steady nudge**
- Small card: `background: ${C.clay}0C, border: 1px solid ${C.clay}28`
- 6px dot bullet (clay), then AI text
- Max 2 lines. References specific data — not generic motivation.
- Example: "Tempo today. Your last tempo faded in the back half. Start at 4:18 — don't force 4:10 from the gun."
- Tapping it opens the Coach tab with that context pre-loaded

**7-day session grid**
- 7 columns, `gap: 5px`
- Each day card: `minHeight: 68px (rest) / 86px (session)`
- Today card: `border: 1.5px solid C.clay, background: #FFFDF8, boxShadow: clay glow`
- Day initial top: "M T W T F S S" — clay if today, muted otherwise
- Session type dot (8px) in type colour
- Session name (truncated at ~10 chars)
- Status indicator: `✓` (completed, forest), `⚠` (off-target, amber)
- For completed sessions: key metric in Space Mono 8px — e.g. "10.2km"
- Rest days: thin card, no content, "rest" label in muted

**Status badge logic:**
- `completed` — session synced, hit targets within 5%
- `off-target` — session synced, missed target by >5%
- `missed` — planned session date passed, no sync
- `today` — today's date, no sync yet
- `upcoming` — future dates

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
- Each segment: phase colour background, white uppercase label if segment wide enough
- Current week marked with a thin vertical line indicator
- Sub-label: "Build phase · Week 5 of 8 · Peak volume approaching"

**Week list**
- Each row: `padding: 10px 14px, borderRadius: 12px, border: 1px solid C.border`
- Left: `W{n}` in Space Mono 11px + date range
- Middle: 7 session dots (8px) colour-coded
- Right: `{actual}km / {planned}km` in Space Mono 11px + phase tag pill
- Below: 2px volume bar, width proportional to km as % of max week
- Past weeks show actual vs planned; future weeks show planned only (lighter)
- Tapping a week expands inline (same UX as Step 3 of plan builder)

---

## Screen: Coach Tab

**Purpose:** The AI coaching conversation. Proactive — coach always has an opening message. The differentiating feature of the product.

**Prototype reference:** `CoachTab` in `steady-app.jsx`. See also `AI_COACH.md` for full specification.

**Key components:**

**Coach header**
- Avatar: 38px circle, `background: C.ink`, letter "S" in `Playfair Display 17px cream`
- Name: "Steady" in `DM Sans 600 15px`
- Status: green dot + "Active · reading your full plan"

**Conversation thread**
- Day label dividers: `DM Sans 10.5px muted centred`
- Coach messages: left-aligned, `background: C.card (#F0EAE0)`, `borderRadius: 5px 14px 14px 14px`, no bubble border
- User messages: right-aligned, `background: C.surface`, `borderRadius: 14px 5px 14px 14px`
- Text: `DM Sans 400 13.5px, lineHeight: 1.58`
- Timestamp: `DM Sans 9.5px muted` below each message
- Messages support `\n` line breaks
- Coach messages slightly wider max-width than user messages

**Plan Edit Proposal card** (see `AI_COACH.md` for full spec)
- Appears inline in conversation when coach proposes a change
- Before/after layout with amber highlight
- "Apply change" and "Discuss more" buttons
- On apply: collapses to confirmation with 10s undo

**Input bar**
- `borderRadius: 22px, background: C.cream`
- Placeholder: "Message Steady…"
- Send button (clay circle with ↑) appears only when input has text

---

## Screen: Settings Tab

**Purpose:** Manage integrations, plan, subscription. Should feel like the least important screen in the app.

**Prototype reference:** `SettingsTab` in `steady-app.jsx`

**Sections:**
- PLAN — current training plan details, goal race
- INTEGRATIONS — Strava (connected/disconnected), Apple Health, Garmin
- SUBSCRIPTION — current plan tier, account email

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

6. **Steady's read** — 3–5 sentence AI analysis. Must reference specific numbers. Not generic. Example: "You hit the first 2 intervals on target but faded in intervals 4–6. Given your HR was already at 178 before interval 4, this looks like accumulated fatigue rather than poor pacing."

7. **Upcoming sessions** — for future sessions with no actual, show: contextual explanation + "Check back after your run"

---

## Empty states

These must be designed, not left blank:

- **No plan created:** Illustration + "You haven't created a plan yet." + CTA to plan builder
- **No run synced today:** "No run yet today. Your {session name} is planned — it'll appear here once it syncs."
- **Coach tab — no messages:** Steady introduces itself with a first message automatically
- **Block tab — plan just created:** Week list shows with all sessions in "upcoming" state

---

## Notifications (push)

Two notification types, both initiated by the app:

1. **Post-run debrief:** "Your {session name} is ready to debrief. Steady has thoughts." — triggers within 15 minutes of a run syncing. Opens Coach tab with debrief pre-loaded.

2. **Monday preview:** "Week {n} starts today. Steady has your preview ready." — triggers Monday 7am local time. Opens Coach tab with week preview.

No other notification types in MVP.
