# Hotspots

Use this file when a feature touches an area that historically attracted debt.

## Current hotspot files

- `packages/app/app/(tabs)/block.tsx` — `1523` lines. Highest-risk controller screen. Avoid adding more orchestration here; direct-reschedule state now belongs in `packages/app/features/plan-builder/use-direct-week-reschedule.ts`.
- `packages/app/app/sync-run/[activityId].tsx` — `1056` lines. Manual run resolution still mixes fetch, staged form state, and save orchestration even after the modal extraction. Keep pushing picker UIs and pure selection rules into sync feature modules/components.
- `packages/app/app/(tabs)/settings.tsx` — `718` lines. Settings, auth, Strava actions, and recovery actions are easy to sprawl here.
- `packages/app/app/onboarding/plan-builder/step-goal.tsx` — `562` lines. Plan-builder rules should land in shared plan-builder modules or shared domain helpers, not in the screen.
- `packages/app/app/onboarding/plan-builder/step-plan.tsx` — `488` lines. Keep generated-plan editing rules out of the onboarding screen shell.
- `packages/app/app/onboarding/plan-builder/step-template.tsx` — `914` lines. Template-week logic should prefer shared plan-builder modules over screen-local logic.
- `packages/app/app/(tabs)/home.tsx` — `452` lines. Home should stay a composition surface, not a new business-logic sink.
- `packages/server/src/services/strava-workflow-service.ts` — `570` lines. High-impact workflow boundary. Keep new behavior cohesive and avoid leaking orchestration back into routers or screens.
- `packages/server/src/trpc/plan.ts` — `261` lines. Plan validation and annotation logic are starting to concentrate here. Keep workflow logic out of the router.
- `packages/server/src/services/activity-workflow-service.ts` — `250` lines. Shared activity save/list workflow now carries niggle enrichment plus match/shoe persistence. Keep UI-specific shaping out of this service.

## Preferred landing zones

### App behavior shared across screens

If the same behavior appears in `Home`, `Week`, `Block`, `Settings`, or `sync-run`, prefer:

- `packages/app/features/*` for cross-screen orchestration, derived state, and shared hooks
- `packages/app/lib/*` for app-side helpers, environment-sensitive setup, and client utilities
- focused feature components under `packages/app/components/<feature>/` for UI-specific shared behavior

Do not independently patch each screen unless the change is tiny and presentation-only.

### Home follow-up work

Start by looking in:

- `packages/app/features/home/*` for Home-only interaction controllers such as session-detail state and note-driven navigation
- `packages/app/components/home/*` for Home card/list presentation work
- `packages/app/features/run/*` when a Home row status rule should remain shared with activity-resolution boundaries

Keep `packages/app/app/(tabs)/home.tsx` focused on composition. Do not move row-status heuristics or sheet orchestration back into the screen.

### Recovery-related work

Start by looking in:

- `packages/app/features/recovery/recovery-ui-gate.ts` for the shared MVP suppression switch that parks or re-enables injury UI across Home, Week, Block, and Settings
- `packages/app/features/recovery/*`
- `packages/app/components/recovery/*`
- `packages/app/lib/resume-week.ts`

Keep recovery rules shared. Do not re-encode them separately in `Home` and `Settings`.

### Plan-builder work

Start by looking in:

- `packages/app/features/plan-builder/*` for Step 2 starter-mode rules, shared client-side reorder state, staged reschedule drafts, onboarding template orchestration, and other interaction controllers that should stay out of hotspot screens
- `packages/app/components/plan-builder/*`
- `packages/types/src/lib/*` for plan-generation or plan-shaping logic
- `packages/app/features/*` if shared client-side onboarding orchestration emerges across steps

Do not let onboarding screens become the only place where plan rules live.

### Activity and sync work

Start by looking in:

- `packages/app/features/run/*`
- `packages/app/features/sync/*`
- `packages/app/components/sync-run/*`
- `packages/server/src/services/*`
- `packages/server/src/repos/*`

Keep transport, workflow, and persistence concerns separated.

### Server workflow changes

Start by looking in:

- `packages/server/src/services/*` for services and workflow modules
- `packages/server/src/repos/*` for persistence boundaries
- `packages/server/src/trpc/*` only for validation and delegation

## Anti-patterns to avoid

- adding new business logic directly to `block.tsx` because it is already open
- adding new business logic directly to `sync-run/[activityId].tsx` because it is already open
- duplicating the same recovery or sync fix across multiple screens
- extracting shared logic but leaving the old copy and old tests behind
- importing `@steady/server/src/**` from the app
- putting environment detection or native-module setup into screen files
- shipping a shortcut without leaving a Linear follow-up
