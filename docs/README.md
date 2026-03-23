# Steady v2 — Claude Code Brief

## What this is

Steady is a iOS running app for self-coached runners who bring their own training plan. It sits in the gap between Strava (tracking only, no planning) and Runna (AI-generated plans, no flexibility). The core premise: the user already has a plan they trust — from a book, a coach, or an LLM — and Steady helps them execute it, track it against reality, and adapt it with an AI coach named Steady.

This is v2. A previous attempt exists. This is a clean rebuild with a clearer product vision, a fully designed UI system, and a working React prototype of the two most complex flows already built.

---

## How to use these documents

Read them in this order before writing a single line of code:

1. `PRODUCT.md` — why this exists, who it's for, what problem it solves
2. `DESIGN_SYSTEM.md` — colours, typography, component patterns. Do not deviate.
3. `SCREENS.md` — information architecture, navigation, all screens
4. `PLAN_BUILDER.md` — the 3-step plan creation flow (most complex UI in the app)
5. `AI_COACH.md` — the Steady coach, conversation design, plan edit proposals
6. `DATA_MODEL.md` — data structures, session types, plan schema
7. `TECH_STACK.md` — stack, folder structure, build order, integrations

---

## Skills — read before starting

This project folder contains 8 skills. **Read all of them before writing any code.** They define both the engineering philosophy and the workflow.

Skills are located at: `/Users/cyprianbrytan/Projects/steady-v2-app/`

### Workflow skills — these govern HOW you work

**`grill-me/SKILL.md`**
Use this when stress-testing a design or plan. Interview relentlessly down every branch of the decision tree, resolving dependencies one by one. Use it before committing to any module interface or data model decision.

**`write-a-prd/SKILL.md`**
Use this when planning any significant new feature. Interview → explore codebase → design modules → write PRD → submit to Notion. Do not start implementing until a PRD exists for features larger than a single component.

**`prd-to-issues/SKILL.md`**
Use this after a PRD is written. Break it into independently-grabbable GitHub issues using vertical tracer-bullet slices. Each issue must cut through ALL layers end-to-end. Never create horizontal-slice issues (all schema, then all API, then all UI).

**`tdd/SKILL.md`**
Use this for all feature implementation. Red-green-refactor, one test at a time, vertical slices only. Read it before writing a single line of implementation code.

**`improve-codebase-architecture/SKILL.md`**
Use this when a part of the codebase feels hard to navigate or test. Explore organically for friction, surface deepening candidates, spawn parallel sub-agents to design interfaces, create GitHub RFC issues.

### Reference skills — these govern HOW you design

**`deep-modules.md`** — The core design principle. Every module should have a small interface and deep implementation. If the interface is as complex as the implementation, the module is too shallow. Ask on every module: can I reduce the methods? Simplify the params? Hide more complexity inside?

**`interface-design.md`** — Accept dependencies, don't create them. Return results, don't produce side effects. Small surface area. Apply this to every function signature.

**`mocking.md`** — Mock ONLY at true system boundaries: Strava API, Anthropic API, Apple Health, Supabase. Never mock your own modules or internal collaborators. Use dependency injection so boundaries are mockable. Design SDK-style interfaces (one function per operation) not generic fetchers.

**`tests.md`** + **`refactoring.md`** + **`REFERENCE.md`** — Good vs bad test examples, post-green refactor checklist, dependency category classification for architecture decisions.

### Recommended workflow order for any new Steady feature

```
1. grill-me     → stress-test the design
2. write-a-prd  → document it properly
3. prd-to-issues → break into tracer bullet issues
4. tdd          → implement one vertical slice at a time
```

---

## Prototype files — read these too

Two working React prototypes exist in this project. Read them before building anything.

**`steady-app.jsx`** — The main app shell with 4 tabs:
- `WeekTab` — current week view with session grid, load bar, AI nudge
- `BlockTab` — full training block with phase strip and all weeks
- `CoachTab` — AI coach conversation with plan edit proposal cards
- `SettingsTab` — integrations, plan management, subscription
- `SessionSheet` — bottom sheet detail for any session (planned + actual + pace trace)
- `PaceTrace` — SVG component overlaying planned vs actual pace splits

**`steady-plan-builder.jsx`** — The 3-step plan creation flow:
- `StepGoal` — race distance, time target, weeks, phase customisation
- `StepTemplate` — 7-day template week builder with full session editor
- `StepPlan` — 16-week plan review with per-week inline editing
- `ScrollPicker` — iOS-style scroll drum for pace and distance selection
- `SessionEditor` — full bottom sheet session editor with all fields
- `PhaseEditor` — visual phase bar with per-phase steppers
- `PropagateModal` — scope selection for applying changes across weeks
- `SessionRow` — inline session editor within expanded week rows
- `generatePlan()` — plan generation logic with progression and phase support

These prototypes are the design source of truth. The actual React Native implementation must faithfully reproduce what they show.

---

## Tech target

- **Platform:** iOS first (React Native + Expo)
- **Backend:** Node.js + Supabase
- **AI:** Anthropic Claude API
- **See `TECH_STACK.md` for full detail**

---

## The one thing that must never be compromised

The app name is Steady. The AI coach is also called Steady. The coach initiates conversations — it does not wait to be asked. After every run it sends a debrief. Every Monday it sends a week preview. This proactive behaviour is the entire emotional differentiator of the product. If the coach feels passive or generic, the product fails.
