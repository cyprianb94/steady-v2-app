---
name: steady-feature-guardrails
description: Use when implementing Steady product features or UX changes to preserve the post-refactor architecture. Routes work to the right supporting skills and enforces repo-specific guardrails around giant screens, shared modules, routers, imports, and tests.
---

# Steady Feature Guardrails

Use this skill for product work in Steady before you start coding.

Its job is simple:

1. classify the feature
2. load the right supporting skills
3. keep the change out of the architectural debt traps we already know about

Read [references/hotspots.md](references/hotspots.md) before touching any hotspot file.

## Load these companion skills

Always load:

- `engineering`
- `product`
- `tests`

Then load the area-specific skills:

- screen or navigation work: `screens`
- onboarding or plan-builder work: `plan-builder`
- cross-screen state, orchestration, or shared logic: `interface-design`, `deep-modules`
- AI coach or conversational UX: `ai-coach`
- deliberate cleanup or debt paydown: `improve-codebase-architecture`

## Guardrails

### 1. Do not patch the same behavior into multiple screens

If the feature touches two or more of these:

- `Home`
- `Week`
- `Block`
- `Settings`
- `sync-run`

then do not copy logic into each screen. Create or extend a shared module first, then wire the screens to it.

### 2. Keep giant screens shallow

Hotspot screens are allowed to compose data and UI, but they should not absorb new non-trivial business rules.

If the change is larger than a small presentation tweak:

- move logic into a shared helper, hook, controller, or feature module
- keep the screen as the composition layer

### 3. Keep routers thin

In `packages/server/src/trpc/*`:

- validate input
- enforce auth
- delegate to a service or workflow module

Do not add multi-step orchestration directly into routers unless the change is truly tiny.

### 4. Respect package boundaries

The app must not import sibling package internals such as:

- `@steady/server/src/**`

Use package exports only. If the export you need does not exist, add the export instead of reaching into `src`.

### 5. Keep environment-sensitive setup out of screens

Anything that depends on environment detection, native modules, Supabase setup, or platform-specific loading belongs in:

- `packages/app/lib/*`
- dedicated setup utilities
- test harness files

Do not push that logic down into screen or component files.

### 6. Prefer behavioural tests

For changed features, test the user-visible flow or public module boundary.

Do not rely only on implementation-coupled tests.

When a change crosses screens or layers, add or update the shared boundary test that proves the behavior still works.

### 7. If you knowingly add debt, say so before finishing

If speed forces a shortcut:

- call it out explicitly
- explain why it was taken
- create a follow-up Linear issue before you finish

## Quick decision check

Before coding, answer these:

1. Is this a single-screen presentation change, or shared behavior?
2. If shared behavior, where is the narrowest shared module boundary?
3. Am I adding logic to a hotspot file that should live somewhere else?
4. Am I crossing a package boundary the wrong way?
5. What behavioural test will prove this change is safe?

If those answers are fuzzy, stop and design the boundary first.
