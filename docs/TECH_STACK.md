# Steady — Tech Stack & Build Order

---

## Stack

### Frontend — React Native (Expo)

**Why Expo:** Cross-platform path to Android when needed. Expo SDK 51+ handles Apple HealthKit, push notifications, and secure storage. Large ecosystem. TypeScript support is first-class.

**Alternative considered:** SwiftUI native — better performance ceiling, but Android later becomes very expensive. Expo's performance is sufficient for this use case.

**Key Expo packages:**
- `expo-health` — Apple HealthKit access (iOS only)
- `expo-notifications` — push notifications
- `expo-secure-store` — for storing OAuth tokens
- `expo-linking` — OAuth redirect handling
- `@react-navigation/bottom-tabs` — tab navigation
- `@react-navigation/native-stack` — stack navigation within tabs

**State management:** React Context + `useReducer` for plan state. No Redux — the data model is not complex enough. Supabase Realtime handles live updates.

### Backend — Node.js + Fastify on Fly.io

**Why Fastify over Express:** Faster, better TypeScript types, schema validation built in.

**Why Fly.io:** Closer to free-tier than Railway for small apps. Global regions matter for push notification latency.

**Key packages:**
- `@anthropic-ai/sdk` — Claude API calls
- `@supabase/supabase-js` — Supabase client
- `strava-v3` or raw fetch — Strava API calls
- `node-cron` — scheduled jobs (Monday previews, missed session checks)

### Database — Supabase

**Why Supabase:** Postgres + Auth + Realtime in one service. The Realtime feature is needed for plan edit proposals to update the UI without polling. Auth is straightforward. RLS handles data isolation.

### AI — Anthropic Claude API

**Model:** `claude-sonnet-4-20250514` — fast enough for conversational use (<3s response), smart enough for genuine coaching quality.

**Two use cases:**
1. **Plan parser** (future feature) — structured JSON extraction from free-text training plans
2. **Coach conversations** — full context injection on every turn

See `AI_COACH.md` for full API integration spec.

---

## Folder structure

```
steady-v2-app/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/
│   │   ├── week.tsx              # Week tab
│   │   ├── block.tsx             # Block tab
│   │   └── settings.tsx          # Settings tab (includes Steady AI entry point)
│   ├── onboarding/
│   │   ├── welcome.tsx
│   │   ├── plan-builder/
│   │   │   ├── step-goal.tsx
│   │   │   ├── step-template.tsx
│   │   │   └── step-plan.tsx
│   │   └── connect.tsx           # Integration connection
│   └── _layout.tsx
│
├── components/
│   ├── plan-builder/
│   │   ├── ScrollPicker.tsx      # Drum picker where explicitly needed
│   │   ├── SessionEditor.tsx     # Notebook-row session editor
│   │   ├── SessionEditorScreen.tsx # Full-screen editor shell shared by Block + plan builder
│   │   ├── PhaseEditor.tsx       # Phase bar + steppers
│   │   └── PropagateModal.tsx    # Scope selection modal
│   ├── week/
│   │   ├── WeekHeader.tsx
│   │   ├── LoadBar.tsx
│   │   ├── SteadyNudge.tsx
│   │   ├── SessionGrid.tsx       # 7-day grid
│   │   └── DayCard.tsx           # Individual day in grid
│   ├── coach/
│   │   ├── CoachHeader.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── PlanEditCard.tsx      # Before/after proposal card
│   │   └── CoachInput.tsx
│   ├── block/
│   │   ├── PhaseStrip.tsx
│   │   └── WeekRow.tsx
│   └── ui/
│       ├── ChipRow.tsx
│       ├── ChipStripEditor.tsx
│       ├── EditableChipStrip.tsx
│       ├── NotebookRow.tsx
│       ├── RepStepper.tsx
│       ├── SectionLabel.tsx
│       ├── UnitTogglePill.tsx
│       ├── Btn.tsx
│       └── SessionDot.tsx
│
├── lib/
│   ├── supabase.ts               # Supabase client singleton
│   ├── anthropic.ts              # Claude API wrapper
│   ├── strava.ts                 # Strava OAuth + API
│   ├── apple-health.ts           # HealthKit reads
│   ├── plan-generator.ts         # generatePlan() function
│   ├── session-km.ts             # sessionKm() volume calculator
│   ├── activity-matcher.ts       # Match activities to sessions
│   └── pace-utils.ts             # Pace string conversions
│
├── constants/
│   ├── colours.ts                # Full colour token map (from DESIGN_SYSTEM.md)
│   ├── typography.ts             # Font + size constants
│   ├── session-types.ts          # TYPE metadata object
│   ├── phase-meta.ts             # PHASE_META object
│   └── recovery-km.ts            # RECOVERY_KM lookup table
│
├── hooks/
│   ├── usePlan.ts                # Plan state + CRUD
│   ├── useActivities.ts          # Activity fetching + matching
│   ├── useCoach.ts               # Conversation state
│   └── useStravaSync.ts          # Sync polling/webhook
│
├── server/                       # Fastify backend (separate repo or monorepo)
│   ├── routes/
│   │   ├── strava.ts             # OAuth callback, webhook handler
│   │   ├── coach.ts              # Claude API proxy
│   │   └── plan.ts               # Plan CRUD
│   ├── jobs/
│   │   ├── monday-preview.ts     # Cron: weekly preview generation
│   │   └── missed-session.ts     # Cron: 9pm missed session check
│   └── lib/
│       ├── context-builder.ts    # Builds Claude system prompt
│       └── activity-sync.ts      # Strava webhook processor
│
├── docs/                         # These markdown files
├── steady-app.jsx                # UI prototype — source of truth for main app
└── steady-plan-builder.jsx       # UI prototype — source of truth for plan builder
```

---

## Build order

> **Before starting any phase:** follow the skill workflow — `grill-me` to stress-test the design, `write-a-prd` to document it, `prd-to-issues` to break it into vertical tracer-bullet slices, then `tdd` to implement one slice at a time. Do not write implementation code without a PRD for anything larger than a single component. See `ENGINEERING.md` for the full workflow.

### Phase 1 — Infrastructure (Week 1–2)

1. Expo project setup with TypeScript
2. Supabase project + schema from `DATA_MODEL.md`
3. Auth flow (Supabase email auth + magic link)
4. Colour tokens, typography, base UI components (`Btn`, `SectionLabel`, `SessionDot`, `ChipRow`)
5. Strava OAuth integration (web flow via `expo-linking`)
6. Apple HealthKit read setup (`expo-health`)
7. Fastify server scaffold on Fly.io

### Phase 2 — Plan Builder (Week 3–4)

This is the highest priority UI feature. Build it first so you have data to populate everything else.

1. Base editor primitives: `EditableChipStrip`, `ChipStripEditor`, `NotebookRow`, `UnitTogglePill`, `RepStepper`
2. `StepGoal` screen with `PhaseEditor`
3. `SessionEditor` — notebook-row controls for all session types and all fields
4. `StepTemplate` screen
5. `generatePlan()` function in `lib/plan-generator.ts`
6. `PropagateModal`
7. `SessionEditorScreen` for Block and plan-builder edit flows
8. `StepPlan` screen with accordion week list
9. Plan persistence to Supabase

**Reference:** `packages/app/components/plan-builder/SessionEditor.tsx` is the current source of truth for session editing. Do not reintroduce the older separate interval controls or scroll drums inside the session editor.

### Phase 3 — Core App Screens (Week 5–6)

1. Bottom tab navigation
2. `WeekTab` with `SessionGrid`, `LoadBar`, `SteadyNudge`
3. Full-screen run detail at `app/sync-run/[activityId].tsx`
4. `BlockTab` with `PhaseStrip` and `WeekRow` list
5. `SettingsTab` with integration status
6. Activity sync from Strava (webhook handler in server)
7. Activity matching to planned sessions
8. Planned vs actual data flowing into the shared run-detail screen

**Reference:** `steady-app.jsx` is the complete working prototype.

### Phase 4 — Steady AI (Week 7–8)

1. Steady AI conversation UI (`MessageBubble`, `SteadyAIHeader`, `SteadyAIInput`)
2. `PlanEditCard` component (before/after, apply/reject)
3. Context builder in server (`lib/context-builder.ts`)
4. Claude API proxy route in server
5. Post-run debrief trigger (after activity sync detected)
6. Monday weekly preview cron job
7. Missed session cron job
8. Plan edit apply flow (optimistic update + API persist + undo)

### Phase 5 — Polish & Launch (Week 9–10)

1. Push notifications (post-run + Monday preview)
2. Empty states for all screens
3. Loading states and skeletons
4. Error handling (no internet, sync failed, API error)
5. Subscription / paywall (Steady AI gating in Settings)
6. App Store assets and submission

---

## Strava integration

### OAuth flow

```
1. User taps "Connect Strava" in Settings
2. Open Strava OAuth URL in browser:
   https://www.strava.com/oauth/authorize
   ?client_id={CLIENT_ID}
   &redirect_uri={REDIRECT_URI}
   &response_type=code
   &scope=activity:read_all
3. User authorises in browser
4. Strava redirects to app with ?code=xxx
5. App sends code to server
6. Server exchanges code for access_token + refresh_token
7. Server stores encrypted tokens in Supabase users table
8. Server fetches recent activities to populate history
```

Local development uses Strava's localhost callback-domain whitelist:

- Expo Go: `exp://localhost/--/strava-callback`
- Native development build: `steady://localhost/strava-callback`

For local testing, set the Strava app's Authorization Callback Domain to `localhost`.

Release builds must set `EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN` and use an app/API domain, not the landing-page domain. Release redirect URIs are:

- Production: `steady://<EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN>/strava-callback`
- Preview: `steady-preview://<EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN>/strava-callback`

### Webhook (new activities)

```
1. Register Strava webhook: POST /push_subscriptions with callback URL
2. Server receives POST to /webhooks/strava when activity created
3. Server fetches full activity data
4. Runs activity matcher against user's plan
5. Stores in activities table
6. If match found: triggers post-run debrief flow
7. Generates debrief message via Claude
8. Sends push notification to user
```

### Token refresh

Strava tokens expire every 6 hours. Refresh proactively on server before expiry. Store both `access_token` and `refresh_token` encrypted. Refresh endpoint: `POST https://www.strava.com/oauth/token` with `grant_type=refresh_token`.

---

## Apple HealthKit integration

```javascript
import * as Health from 'expo-health'

// Request permissions on setup
await Health.requestPermissionsAsync([
  Health.HealthDataType.Workout,
  Health.HealthDataType.HeartRate,
  Health.HealthDataType.RunningSpeed,
])

// Fetch workouts
const workouts = await Health.getWorkoutsAsync({
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  endDate: new Date(),
})
```

HealthKit does not support webhooks. Poll on app foreground + once at app launch. Activities not matched to Strava (user doesn't have Strava) use HealthKit as primary source.

---

## Environment variables

```
# Server
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=         # Server-side only — full access
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
ENCRYPTION_KEY=               # For token encryption at rest

# App (Expo)
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_URL=          # Fastify server URL
```

Never commit any of these. Use `.env` locally and Fly.io secrets in production.

---

## Performance targets

- App cold start to Week tab ready: <2 seconds
- Session sheet open: <200ms
- Plan builder step transitions: <150ms
- Steady AI response (Claude API): <4 seconds (show typing indicator)
- Strava sync to debrief notification: <15 minutes after run ends

---

## Skills in this project

Read all 8 skill files before writing any code. Full descriptions are in `README.md`.

**Workflow skills** (govern how you work):
```
/Users/cyprianbrytan/Projects/steady-v2-app/grill-me/SKILL.md
/Users/cyprianbrytan/Projects/steady-v2-app/write-a-prd/SKILL.md
/Users/cyprianbrytan/Projects/steady-v2-app/prd-to-issues/SKILL.md
/Users/cyprianbrytan/Projects/steady-v2-app/tdd/SKILL.md
/Users/cyprianbrytan/Projects/steady-v2-app/improve-codebase-architecture/SKILL.md
```

**Reference skills** (govern how you design):
```
/Users/cyprianbrytan/Projects/steady-v2-app/deep-modules.md
/Users/cyprianbrytan/Projects/steady-v2-app/interface-design.md
/Users/cyprianbrytan/Projects/steady-v2-app/mocking.md
/Users/cyprianbrytan/Projects/steady-v2-app/tests.md
/Users/cyprianbrytan/Projects/steady-v2-app/refactoring.md
/Users/cyprianbrytan/Projects/steady-v2-app/REFERENCE.md
```

See `ENGINEERING.md` for how these skills translate into Steady-specific rules.
