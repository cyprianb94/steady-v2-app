# Steady v2 - Skill Index

This file is the canonical guide for the project skills.

The public-facing project overview lives in [`README.MD`](/Users/cyprianbrytan/Projects/steady-v2-app/docs/README.MD). This file is for agent and contributor workflow guidance.

The skills are mirrored in two project-local locations:

- Claude Code: [`.claude/skills/`](/Users/cyprianbrytan/Projects/steady-v2-app/.claude/skills)
- Codex: [`.codex/skills/`](/Users/cyprianbrytan/Projects/steady-v2-app/.codex/skills)

Each skill lives in its own folder as `SKILL.md`, which makes it discoverable as a project-local skill by both tools.

This file is not a skill itself. It explains:

- what each skill is for
- when to reach for it
- the recommended order to load them in

## Default Order

For most product and implementation work, use this order:

1. `/product`
2. `/brand-and-content` when naming, tone, copy, or brand metaphor is involved
3. `/frontend-design` and `/design-system`
4. One or more domain skills: `/screens`, `/plan-builder`, `/ai-coach`, `/data-model`, `/tech-stack`
5. `/engineering`
6. `/branching-workflow`
7. Planning skills if the work is still being shaped: `/grill-me`, `/write-a-prd`, `/prd-to-issues`
8. Implementation and quality skills while building: `/tdd`, `/tests`, `/mocking`, `/interface-design`, `/deep-modules`, `/refactoring`, `/reference`, `/improve-codebase-architecture`
9. `/testflight` when preparing a release build or distribution

## Quick Rules

- Do not load every skill by default. Start with the smallest relevant set.
- For naming, tone, product copy, empty states, notification text, marketing copy, or the Steady metaphor, add `/brand-and-content`.
- For UI work, always start with `/brand-and-content`, `/frontend-design`, and `/design-system` when there is any user-facing copy or brand expression.
- For onboarding and training-plan creation flows, add `/plan-builder`.
- For anything involving Steady AI tone or proactive behaviour, add both `/brand-and-content` and `/ai-coach`.
- For feature planning, use `/grill-me` before `/write-a-prd`, then `/prd-to-issues`.
- For implementation, `/tdd` is the primary execution skill and the test-related skills support it.
- For repo workflow, `/branching-workflow` applies before making changes.

## Skills

### Foundation

`/product`
- Use for product context, user needs, feature boundaries, prioritization, and the overall point of Steady.

`/brand-and-content`
- Use for naming, voice, tone, vocabulary, product copy, beta-scope wording, brand positioning, and the notebook-plus-timing-display metaphor.

`/frontend-design`
- Use for high-quality UI direction, visual hierarchy, bold aesthetic choices, and polished frontend implementation.

`/design-system`
- Use for Steady colours, typography, spacing, component patterns, and visual consistency.

`/screens`
- Use for navigation, screen structure, information architecture, and what each screen should contain.

`/plan-builder`
- Use for onboarding Step 1-3, phase editing, template week design, generated plan review, and plan-builder logic.

`/ai-coach`
- Use for Steady AI behavior, proactive messaging, conversation tone, and AI-led training guidance.

`/data-model`
- Use for plan schema, session types, domain entities, data structures, and persistence-shape decisions.

`/tech-stack`
- Use for architecture, integrations, build order, package responsibilities, and stack-level tradeoffs.

`/engineering`
- Use for repo-wide engineering discipline, implementation standards, and workflow expectations.

`/branching-workflow`
- Use when creating a branch, scoping work, planning commits, and managing PR flow safely.

### Planning

`/grill-me`
- Use to stress-test a plan or design before committing to it.

`/write-a-prd`
- Use to turn a feature idea into a written PRD after exploring the codebase and clarifying the shape of the work.

`/prd-to-issues`
- Use to break a PRD into implementation issues using vertical slices rather than horizontal layers.

### Implementation And Quality

`/tdd`
- Use as the primary implementation workflow when building or fixing features with test-first vertical slices.

`/tests`
- Use to evaluate whether tests are meaningful, integration-style, and behavior-focused.

`/mocking`
- Use when deciding what to mock and where the real system boundaries are.

`/interface-design`
- Use when designing functions, modules, APIs, and dependency injection boundaries for testability.

`/deep-modules`
- Use when evaluating whether a module hides enough complexity behind a small surface area.

`/refactoring`
- Use after code is green to identify cleanup and simplification opportunities.

`/reference`
- Use for architecture heuristics and dependency-category guidance that supports deeper module and testability decisions.

`/improve-codebase-architecture`
- Use when the codebase feels hard to navigate or test and you want a focused architecture-improvement pass.

### Delivery

`/testflight`
- Use when preparing a production mobile build, release configuration, or TestFlight handoff.

## Recommended Sequences

### UI Feature

1. `/product`
2. `/brand-and-content`
3. `/frontend-design`
4. `/design-system`
5. `/screens` or `/plan-builder`
6. `/branching-workflow`
7. `/tdd`
8. `/tests`, `/interface-design`, `/refactoring` as needed

### AI Feature

1. `/product`
2. `/brand-and-content`
3. `/ai-coach`
4. `/data-model`
5. `/tech-stack`
6. `/branching-workflow`
7. `/tdd`
8. `/tests`, `/mocking`, `/reference`

### New Feature Definition

1. `/product`
2. `/brand-and-content` if naming, tone, copy, or brand promise is involved
3. `/grill-me`
4. Any relevant domain skill, such as `/screens`, `/plan-builder`, `/ai-coach`, or `/data-model`
5. `/write-a-prd`
6. `/prd-to-issues`

### Refactor Or Architecture Pass

1. `/engineering`
2. `/deep-modules`
3. `/interface-design`
4. `/reference`
5. `/improve-codebase-architecture`
6. `/refactoring`

## Source Docs To Skill Mapping

Every doc except this file and [`README.MD`](/Users/cyprianbrytan/Projects/steady-v2-app/docs/README.MD) is mirrored as a skill:

- `AI_COACH.md` -> `/ai-coach`
- `BRAND_AND_CONTENT.md` -> `/brand-and-content`
- `BRANCHING_WORKFLOW.md` -> `/branching-workflow`
- `DATA_MODEL.md` -> `/data-model`
- `DESIGN_SYSTEM.md` -> `/design-system`
- `ENGINEERING.md` -> `/engineering`
- `FRONTEND-DESIGN.md` -> `/frontend-design`
- `GRILLME.md` -> `/grill-me`
- `IMPROVECODEBASEARCHITECTURE.md` -> `/improve-codebase-architecture`
- `PLAN_BUILDER.md` -> `/plan-builder`
- `PRDTOISSUES.md` -> `/prd-to-issues`
- `PRODUCT.md` -> `/product`
- `REFERENCE.md` -> `/reference`
- `SCREENS.md` -> `/screens`
- `TDD.md` -> `/tdd`
- `TECH_STACK.md` -> `/tech-stack`
- `TESTFLIGHT.md` -> `/testflight`
- `WRITEPRD.md` -> `/write-a-prd`
- `deep-modules.md` -> `/deep-modules`
- `interface-design.md` -> `/interface-design`
- `mocking.md` -> `/mocking`
- `refactoring.md` -> `/refactoring`
- `tests.md` -> `/tests`
