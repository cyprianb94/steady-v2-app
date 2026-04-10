# Steady — Engineering Philosophy

This document translates the project skills into concrete rules for how Steady's codebase is built. Every decision here derives from the skill files in this project folder. Read the source skills for full context and examples.

---

## Workflow hygiene

### Branching

Use `main` as the stable branch.

For each feature or fix:

1. Create a fresh short-lived branch from `main`.
2. Keep the branch scoped to one logical piece of work.
3. Commit only that work on the branch.
4. Open a PR back into `main`.
5. Merge when verified.
6. Delete the branch after merge.

Do not let one long-lived branch accumulate unrelated work across landing, app UI, backend, auth, and integrations.

### Linear and warm trace

Code changes are not a complete handoff on their own. When work is finished or paused, update Linear as part of the workflow.

Minimum expectation:

1. Move the Linear issue to the correct status.
2. Update the related Linear project status if progress changed.
3. Leave a warm trace in the issue or project update so the next human or agent can continue without reconstructing context from scratch.

A good warm trace includes:

- what was completed
- what is still pending
- branch or PR reference
- tests run
- known risks, caveats, or follow-up tasks

This is especially important when multiple LLMs or agents may touch the same work over time.

---

## Core principle: deep modules

From `deep-modules.md` and "A Philosophy of Software Design":

> **Deep module** = small interface + large implementation

Every module in Steady should hide complexity behind a simple surface. The test: if the interface is nearly as complex as the implementation, the module is too shallow and should be merged with something else.

```
GOOD: generatePlan(template, weeks, progressionPct, phases) → PlanWeek[]
  Hides: phase distribution logic, recovery week insertion,
         progression factor calculation, taper scaling, sessionKm()

BAD: 5 separate functions the caller has to orchestrate:
  distributePhases(weeks, phases)
  insertRecoveryWeeks(plan, phases)
  applyProgression(plan, pct)
  applyTaper(plan)
  calculateKm(session)
```

**Apply this to every module you create.** Before exposing a function, ask:
- Can I reduce the number of methods?
- Can I simplify the parameters?
- Can I hide more of this inside?

---

## Module design rules

From `interface-design.md`:

### 1. Accept dependencies, don't create them

```typescript
// GOOD — testable, mockable at the boundary
async function postRunDebrief(session, activity, claudeClient) { }

// BAD — creates its own dependency, untestable
async function postRunDebrief(session, activity) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}
```

Every function that touches an external system must accept that system as a parameter. This applies to: Anthropic API, Strava API, Supabase client, Apple Health, push notification service.

### 2. Return results, don't produce side effects

```typescript
// GOOD — pure, testable
function buildSystemPrompt(user, plan, activities): string { }

// BAD — side effect makes testing require verifying external state
function sendSystemPromptToAPI(user, plan, activities): void { }
```

Separate computation from I/O. The computation functions (prompt building, plan generation, activity matching, volume calculation) must be pure. I/O is injected at the edges.

### 3. Small surface area

Fewer public methods = fewer tests needed = fewer ways for callers to break.

---

## Where to mock

From `mocking.md`:

**Mock ONLY at true system boundaries — things you don't control:**
- Anthropic API (Claude)
- Strava API
- Apple HealthKit
- Push notification service (Expo)
- Supabase (use a local test DB instead where possible)

**Never mock:**
- Your own modules (plan generator, activity matcher, context builder, sessionKm)
- Internal collaborators
- Anything you wrote and control

### Steady's system boundaries and their mock strategy

| Boundary | Category | Test approach |
|---|---|---|
| Anthropic Claude API | True external | Mock at boundary. Inject `claudeClient` interface. |
| Strava API | True external | Mock at boundary. Inject `stravaClient` interface. |
| Apple HealthKit | True external | Mock at boundary. Inject `healthClient` interface. |
| Supabase | Local-substitutable | Use a local Postgres test DB (PGLite or Docker). Do not mock — test with real DB. |
| Push notifications | True external | Mock at boundary. Inject `notificationService` interface. |
| Plan generator | In-process | Test directly. No mocking. |
| Activity matcher | In-process | Test directly. No mocking. |
| Context builder | In-process | Test directly. No mocking. |
| sessionKm() | In-process | Test directly. Pure function. |

### SDK-style interfaces at boundaries

Design external-facing modules as SDK-style interfaces — one specific function per operation — not a generic fetcher:

```typescript
// GOOD — each function independently mockable, one specific shape returned
const stravaClient = {
  getRecentActivities: (userId, since) => Promise<Activity[]>,
  getActivityById: (activityId) => Promise<Activity>,
  registerWebhook: (callbackUrl) => Promise<void>,
}

// BAD — requires conditional mocking logic in tests
const stravaClient = {
  fetch: (endpoint, method, params) => Promise<unknown>,
}
```

---

## Testing strategy

From `tdd.md`, `tests.md`, and `REFERENCE.md`:

### The core rule

Tests verify **behaviour through public interfaces**, not implementation details. Code can change entirely — tests must not break unless behaviour changes.

### What a good test looks like in Steady

```typescript
// GOOD — tests observable behaviour through the public interface
test("generatePlan applies progressive overload to build weeks", () => {
  const template = [easySession(8), intervalSession(6, 800), ...];
  const plan = generatePlan(template, 16, 7, defaultPhases(16));

  const buildWeeks = plan.filter(w => w.phase === 'BUILD');
  expect(buildWeeks[4].km).toBeGreaterThan(buildWeeks[0].km);
});

// BAD — tests internal implementation
test("generatePlan calls applyProgressionFactor with correct multiplier", () => {
  const spy = jest.spyOn(planUtils, 'applyProgressionFactor');
  generatePlan(template, 16, 7, defaultPhases(16));
  expect(spy).toHaveBeenCalledWith(1.07);  // implementation detail
});
```

### Red flags in a test

- Mocking an internal module you wrote
- Asserting on how many times something was called
- Test breaks after renaming an internal function
- Test name describes HOW not WHAT
- Querying a database directly instead of using the interface

### TDD workflow — vertical slices only, never horizontal

From `tdd.md`:

```
WRONG (horizontal):
  Write all tests → Write all implementation

RIGHT (vertical tracer bullets):
  test: activity matches to planned session → impl → pass
  test: matched activity triggers debrief → impl → pass
  test: debrief message contains specific pace data → impl → pass
  test: plan edit proposal updates plan on apply → impl → pass
```

Each slice is a thin vertical cut through ALL layers. Each completed slice is demoable on its own.

### What to write tests for in Steady

Write tests for:
- `generatePlan()` — all phase, progression, taper, recovery week logic
- `sessionKm()` — all session types including warmup/cooldown/recovery jog
- `buildSystemPrompt()` — correct context included, token budget respected
- `matchActivityToSession()` — all matching heuristics
- `applyPlanEdit()` — before/after state, undo behaviour
- `propagateChange()` — all three scope modes (this / remaining / build)

Skip tests for:
- UI components (manual QA and visual inspection)
- Simple data fetching wrappers with no logic
- Configuration files

---

## Dependency classification

From `REFERENCE.md` — classify every external dependency before designing the interface:

**1. In-process** — pure computation, no I/O. Test directly.
- `generatePlan`, `sessionKm`, `buildSystemPrompt`, `matchActivityToSession`, pace utilities

**2. Local-substitutable** — has a local test stand-in. Test with the stand-in.
- Supabase → use local Postgres (Docker or PGLite)

**3. Remote but owned (Ports & Adapters)** — your own services across a network.
- Not applicable to Steady MVP (single backend service)

**4. True external (Mock)** — third-party services you don't control.
- Anthropic API → inject `ClaudeClient` interface, mock in tests
- Strava API → inject `StravaClient` interface, mock in tests
- Apple HealthKit → inject `HealthClient` interface, mock in tests

---

## Refactoring rules

From `refactoring.md` — after TDD green, look for:

- **Duplication** → extract a function
- **Long methods** → break into private helpers (keep tests on the public interface, not the helpers)
- **Shallow modules** → combine or deepen
- **Feature envy** (a function that uses another module's data more than its own) → move it
- **Primitive obsession** (raw strings/numbers where a typed value belongs) → introduce a value type. Example: `pace: string` → `Pace` type with conversion methods.

**Never refactor while RED. Get to green first.**

---

## The deep modules Steady needs

These are the modules with the right shape — small public interface, large hidden implementation.

### `planGenerator`

```typescript
generatePlan(
  template: PlannedSession[],
  totalWeeks: number,
  progressionPct: number,
  phases: PhaseConfig
): PlanWeek[]
```

Hides: phase distribution, recovery week insertion, progression factor math, taper scaling, peak amplification, `sessionKm` calculation for all session types.

### `contextBuilder`

```typescript
buildSystemPrompt(
  user: User,
  plan: TrainingPlan,
  recentActivities: Activity[],
  conversationType: 'post_run' | 'weekly_preview' | 'missed_session' | 'free_form'
): string
```

Hides: compact plan formatting, token budget management (target 4–6k tokens), activity log formatting, phase/week position calculation, conversation type-specific framing.

### `activityMatcher`

```typescript
matchActivity(activity: Activity, planWeeks: PlanWeek[]): PlannedSession | null
```

Hides: date matching, session type inference from HR/pace/duration patterns, distance proximity matching, disambiguation when multiple sessions on same day.

### `stravaClient` (interface)

```typescript
interface StravaClient {
  getRecentActivities(userId: string, since: Date): Promise<Activity[]>
  getActivityById(id: string): Promise<Activity>
  refreshTokenIfNeeded(userId: string): Promise<string>
}
```

Hides: token refresh logic, rate limiting, pagination, response shape normalisation into Steady's `Activity` type.

### `claudeClient` (interface)

```typescript
interface ClaudeClient {
  sendMessage(systemPrompt: string, messages: Message[]): Promise<string>
}
```

Hides: model selection (`claude-sonnet-4-20250514`), max_tokens (1000), retry on rate limit, content block extraction from response.

---

## Workflow for any new Steady feature

```
1. grill-me                   stress-test the design before writing anything
2. write-a-prd                interview → explore → module design → Notion PRD
3. prd-to-issues              vertical tracer-bullet GitHub issues, each demoable
4. tdd                        one test → one impl → repeat, never horizontal
5. improve-codebase-arch      if anything feels hard to navigate, RFC it first
```

---

## What to avoid

- Shallow modules where the interface is as complex as the implementation
- Creating external dependencies inside functions instead of injecting them
- Mocking your own modules or internal collaborators
- Writing all tests before all implementation (horizontal slicing)
- Tests that assert on call counts or internal method invocations
- Tests that query the database directly instead of going through the public interface
- Speculative features — only enough code to pass the current test
