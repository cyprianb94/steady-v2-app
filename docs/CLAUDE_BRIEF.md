# Steady v2 — Claude Code Brief

## What this is

Steady is an iOS plan manager for runners with their own plans replacing multiple tools in one app. It recognises that training isn't always going to plan, niggles and injuries happen and lets runners easily adapt to that. Whether you manage your plan on your own, with a real coach, or with Steady AI, it supports those scenarios and helps physio visits be more efficient through customised injury timeline reports. It sits in the gap between Strava (tracking only, no planning) and Runna (AI-generated plans, no flexibility). The core premise: the user already has a plan they trust — from a book, a coach, or an LLM — and Steady helps them execute it, track it against reality, and adapt it with Steady AI.

This is v2. A previous attempt exists. This is a clean rebuild with a clearer product vision, a fully designed UI system, and a working React prototype of the two most complex flows already built.

---

## How to use these documents

Read them in this order before writing a single line of code:

1. `PRODUCT.md` — why this exists, who it's for, what problem it solves
2. `BRAND_AND_CONTENT.md` — naming, tone, vocabulary, product copy, and brand metaphor
3. `DESIGN_SYSTEM.md` — colours, typography, component patterns. Do not deviate.
4. `SCREENS.md` — information architecture, navigation, all screens
5. `PLAN_BUILDER.md` — the 3-step plan creation flow (most complex UI in the app)
6. `AI_COACH.md` — Steady AI behaviour, conversation design, plan edit proposals
7. `DATA_MODEL.md` — data structures, session types, plan schema
8. `TECH_STACK.md` — stack, folder structure, build order, integrations
9. `BRANCHING_WORKFLOW.md` — how to work safely with feature branches, PRs, and merge cleanup

---

## Skills — read before starting

This project folder contains 8 skills. **Read all of them before writing any code.** They define both the engineering philosophy and the workflow.

Skills are located at: `/Users/cyprianbrytan/Projects/steady-v2-app/`

### Workflow skills — these govern HOW you work

**`grill-me/GRILLME.md`**
Use this when stress-testing a design or plan. Interview relentlessly down every branch of the decision tree, resolving dependencies one by one. Use it before committing to any module interface or data model decision.

**`write-a-prd/WRITEPRD.md`**
Use this when planning any significant new feature. Interview → explore codebase → design modules → write PRD → submit to Notion. Do not start implementing until a PRD exists for features larger than a single component.

**`prd-to-issues/PRDTOISSUE.md`**
Use this after a PRD is written. Break it into independently-grabbable GitHub issues using vertical tracer-bullet slices. Each issue must cut through ALL layers end-to-end. Never create horizontal-slice issues (all schema, then all API, then all UI).

**`tdd/TDD.md`**
Use this for all feature implementation. Red-green-refactor, one test at a time, vertical slices only. Read it before writing a single line of implementation code.

**`improve-codebase-architecture/IMPROVECODEBASEARCHITECTURE.md`**
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
5. update Linear → move issue/project status and leave a warm trace for the next human or agent
```

### Branch workflow for humans and agents

Unless there is a very good reason not to, work like this:

1. Start from `main`.
2. Create a fresh short-lived branch for the feature or fix.
3. Keep the branch scoped to one logical piece of work.
4. Commit on that branch only.
5. Open a PR back into `main`.
6. Merge to `main` when verified.
7. Delete the feature branch after merge.

See `BRANCHING_WORKFLOW.md` for the default branching rules.

### Linear update and warm-trace rule

When a feature or fix is worked on, Linear must be updated before stopping.

Minimum expectation:

1. Move the issue to the correct status.
2. Update the related Linear project status if the feature changes project progress.
3. Leave a warm trace in the Linear issue or project update so the next human, LLM, or agent can pick up quickly.

A good warm trace should include:

- what was completed
- what is still pending
- branch or PR link
- tests run
- known risks, caveats, or follow-up tasks

Do not finish a work session with code changes only. Leave the project-management trace as well.

---

## Prototype files — read these too

Two working React prototypes exist in this project. Read them before building anything.

**`steady-app.jsx`** — The prototype main app shell. The current React Native app has 3 visible tabs:
- `WeekTab` — current week view with session grid, load bar, AI nudge
- `BlockTab` — full training block with phase strip and all weeks
- `SettingsTab` — integrations, plan management, subscription
- Steady AI conversation is reached from Settings or a Steady nudge, not as a visible tab
- `app/sync-run/[activityId].tsx` — shared full-screen run detail for matched/saved runs
- `PaceTrace` — SVG component overlaying planned vs actual pace splits

**`steady-plan-builder.jsx`** — The 3-step plan creation flow:
- `StepGoal` — race distance, time target, weeks, phase customisation
- `StepTemplate` — 7-day template week builder with full session editor
- `StepPlan` — 16-week plan review; expanded day rows open the shared full-screen session editor
- `ScrollPicker` — legacy/prototype iOS-style scroll drum for flows that still explicitly need it
- `SessionEditor` — current React Native source of truth is `packages/app/components/plan-builder/SessionEditor.tsx`; it uses expandable notebook rows, `EditableChipStrip`, `ChipStripEditor`, `UnitTogglePill`, and inline `Custom...` chips
- `SessionEditorScreen` — full-screen shell shared by Block and plan-builder edit flows
- `PhaseEditor` — visual phase bar with per-phase steppers
- `PropagateModal` — scope selection for applying changes across weeks
- `generatePlan()` — plan generation logic with progression and phase support

The prototypes are still useful references, but current React Native source wins when it differs. In particular, do not reintroduce separate above-row interval controls, inline `SessionRow`/`TypeStrip` editing, or scroll drums inside the session editor.

---

## Tech target

- **Platform:** iOS first (React Native + Expo)
- **Backend:** Node.js + Supabase
- **AI:** Anthropic Claude API
- **See `TECH_STACK.md` for full detail**

---

## The one thing that must never be compromised

The app name is Steady. The AI feature is Steady AI, and its conversational persona is called Steady. Steady AI initiates conversations — it does not wait to be asked. After every run it sends a debrief. Every Monday it sends a week preview. This proactive behaviour is the entire emotional differentiator of the product. If Steady AI feels passive or generic, the product fails.
