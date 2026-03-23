# Steady — Data Model

---

## Session types

Every session in the plan has one of five types. These are the core primitive of the data model. Everything — colours, controls, AI context, volume calculation — derives from session type.

```typescript
type SessionType = 'EASY' | 'INTERVAL' | 'TEMPO' | 'LONG' | 'REST'
```

| Type | Meaning | Has pace | Has distance | Has reps | Has warmup/cooldown | Has recovery |
|---|---|---|---|---|---|---|
| EASY | Easy aerobic run | ✓ | ✓ | ✗ | ✗ | ✗ |
| INTERVAL | Repetition session | ✓ (per rep) | ✗ | ✓ | ✓ | ✓ |
| TEMPO | Sustained threshold run | ✓ | ✓ | ✗ | ✓ | ✗ |
| LONG | Long slow run | ✓ | ✓ | ✗ | ✗ | ✗ |
| REST | Rest or cross-train day | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## Session object

```typescript
interface PlannedSession {
  id: string
  type: SessionType
  date: string                    // ISO date, 'YYYY-MM-DD'
  
  // EASY, TEMPO, LONG
  distance?: number               // km
  pace?: string                   // 'M:SS' format e.g. '4:20'
  
  // INTERVAL
  reps?: number                   // count
  repDist?: number                // metres e.g. 800
  recovery?: string               // '45s' | '60s' | '90s' | '2min' | '3min' | '4min' | '5min'
  
  // INTERVAL + TEMPO
  warmup?: number                 // km e.g. 1.5
  cooldown?: number               // km e.g. 1.0
  
  // Computed — do not store, calculate on read
  estimatedKm?: number            // from sessionKm() function
  
  // Linked actual activity
  actualActivityId?: string       // FK to Activity
}
```

---

## Training plan object

```typescript
interface TrainingPlan {
  id: string
  userId: string
  createdAt: string
  
  // Goal
  raceName: string                // e.g. 'San Sebastián Marathon'
  raceDate: string                // ISO date
  raceDistance: '5K' | '10K' | 'Half Marathon' | 'Marathon'
  targetTime: string              // e.g. 'sub-3:30'
  
  // Phase structure
  phases: {
    BASE: number                  // weeks
    BUILD: number
    RECOVERY: number
    PEAK: number
    TAPER: number
  }
  
  // Progression
  progressionPct: number          // 0 = flat, 7 = +7% every 2 weeks
  
  // Template week (7 elements, index 0 = Monday)
  templateWeek: (PlannedSession | null)[]
  
  // Generated weeks
  weeks: PlanWeek[]
}

interface PlanWeek {
  weekNumber: number              // 1-indexed
  phase: 'BASE' | 'BUILD' | 'RECOVERY' | 'PEAK' | 'TAPER'
  sessions: (PlannedSession | null)[]  // 7 elements, Mon–Sun
  plannedKm: number               // calculated from sessions
}
```

---

## Activity (synced run)

```typescript
interface Activity {
  id: string
  userId: string
  source: 'strava' | 'apple_health' | 'garmin' | 'manual'
  externalId: string              // Strava activity ID or HealthKit UUID
  
  startTime: string               // ISO datetime
  distance: number                // km
  duration: number                // seconds
  elevationGain?: number          // metres
  
  avgPace: number                 // seconds per km
  avgHR?: number                  // bpm
  maxHR?: number                  // bpm
  
  splits: ActivitySplit[]         // per-km splits
  
  // Matched session (set by matching algorithm)
  matchedSessionId?: string
}

interface ActivitySplit {
  km: number                      // 1-indexed
  pace: number                    // seconds per km
  hr?: number                     // bpm at end of split
  elevation?: number              // m gain in this km
}
```

---

## Coach conversation

```typescript
interface CoachConversation {
  id: string
  userId: string
  type: 'post_run_debrief' | 'weekly_preview' | 'missed_session' | 'free_form'
  
  // Context link (optional)
  relatedSessionId?: string
  relatedWeekNumber?: number
  
  createdAt: string
  title: string                   // e.g. 'Tuesday intervals debrief'
  
  messages: CoachMessage[]
  planEdits: PlanEdit[]
}

interface CoachMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  
  // Optional attachment
  attachedSessionId?: string      // renders session chip in UI
  planEditId?: string             // renders plan edit proposal card
}

interface PlanEdit {
  id: string
  conversationId: string
  messageId: string               // the coach message that proposed this
  
  sessionId: string               // which planned session
  
  before: Partial<PlannedSession> // snapshot before change
  after: Partial<PlannedSession>  // proposed new values
  
  status: 'proposed' | 'applied' | 'rejected'
  appliedAt?: string
}
```

---

## User

```typescript
interface User {
  id: string
  email: string
  createdAt: string
  
  // Integrations
  stravaAccessToken?: string      // encrypted at rest
  stravaRefreshToken?: string
  stravaAthleteId?: string
  
  appleHealthConnected: boolean
  
  garminAccessToken?: string
  garminAthleteId?: string
  
  // Subscription
  subscriptionTier: 'free' | 'pro'
  subscriptionExpiresAt?: string
  
  // Preferences
  timezone: string                // IANA e.g. 'Europe/London'
  units: 'metric' | 'imperial'   // distance units
}
```

---

## Supabase schema

### Tables

```sql
users
  id uuid primary key
  email text unique not null
  created_at timestamptz
  strava_athlete_id text
  apple_health_connected boolean default false
  garmin_athlete_id text
  subscription_tier text default 'free'
  subscription_expires_at timestamptz
  timezone text default 'UTC'
  units text default 'metric'

training_plans
  id uuid primary key
  user_id uuid references users
  race_name text
  race_date date
  race_distance text
  target_time text
  phases jsonb              -- {BASE: n, BUILD: n, RECOVERY: n, PEAK: n, TAPER: n}
  progression_pct integer default 0
  template_week jsonb       -- array of 7 session objects or null
  weeks jsonb               -- array of PlanWeek objects
  created_at timestamptz
  updated_at timestamptz

activities
  id uuid primary key
  user_id uuid references users
  source text
  external_id text
  start_time timestamptz
  distance numeric
  duration integer
  elevation_gain numeric
  avg_pace numeric
  avg_hr numeric
  max_hr numeric
  splits jsonb
  matched_session_id text   -- references session within plan weeks
  created_at timestamptz

coach_conversations
  id uuid primary key
  user_id uuid references users
  type text
  related_session_id text
  related_week_number integer
  title text
  created_at timestamptz

coach_messages
  id uuid primary key
  conversation_id uuid references coach_conversations
  role text
  content text
  attached_session_id text
  plan_edit_id uuid
  created_at timestamptz

plan_edits
  id uuid primary key
  conversation_id uuid references coach_conversations
  message_id uuid references coach_messages
  session_id text
  before_state jsonb
  after_state jsonb
  status text default 'proposed'
  applied_at timestamptz
  created_at timestamptz
```

### Row-level security

All tables: `user_id = auth.uid()`. Users can only read and write their own data. No exceptions.

---

## Volume calculation

`sessionKm` is a **pure in-process function** — no I/O, no dependencies to inject. Test it directly. It is the canonical volume calculator; use it everywhere km counts appear: plan display, load bars, week totals, progression calculations.

The `sessionKm` function is the canonical volume calculator. Use it everywhere — plan display, totals, progress bars.

```javascript
const RECOVERY_KM = {
  '45s': 0.14, '60s': 0.18, '90s': 0.27,
  '2min': 0.36, '3min': 0.55, '4min': 0.73, '5min': 0.91
}

function sessionKm(session) {
  if (!session || session.type === 'REST') return 0
  
  const warmup   = session.warmup   ? Number(session.warmup)   : 0
  const cooldown = session.cooldown ? Number(session.cooldown) : 0
  const recKm    = session.recovery
    ? (RECOVERY_KM[session.recovery] || 0) * (session.reps || 1)
    : 0

  if (session.type === 'INTERVAL' && session.reps && session.repDist) {
    return Math.round(
      (session.reps * session.repDist / 1000 + recKm + warmup + cooldown) * 10
    ) / 10
  }

  if (session.distance) return session.distance + warmup + cooldown
  
  return 8 // fallback for malformed sessions
}
```

---

## Activity matching

`matchActivity` is a **pure in-process function** — accepts an activity and plan weeks, returns a matched session or null. No I/O. Test it directly with a range of activity shapes. See `ENGINEERING.md` for the interface design.

When a new activity syncs, match it to a planned session using:

1. Date match: activity start date === session date
2. Type inference: match activity duration/distance to session type
   - <20 min → REST/recovery (skip)
   - Contains intervals (HR spikes + pace variation) → INTERVAL
   - HR sustained >165 for >60% of duration → TEMPO
   - Distance >16km → LONG
   - Otherwise → EASY
3. If multiple sessions on same date, match by closest distance/duration

Store `matched_session_id` on the activity. This enables planned vs actual comparison in the UI.

---

## Pace format

All paces stored as `'M:SS'` strings (e.g. `'4:20'`). For display, always show as-is. For calculation, convert:

```javascript
function paceToSeconds(pace) {
  const [m, s] = pace.split(':').map(Number)
  return m * 60 + s
}

function secondsToPace(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
```
