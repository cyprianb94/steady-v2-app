# Hotspots

Use this file when a feature touches an area that historically attracted debt.

## Current hotspot files

- `packages/app/app/(tabs)/block.tsx` — `1748` lines. Highest-risk controller screen. Avoid adding more orchestration here; direct-reschedule state belongs in `packages/app/features/plan-builder/use-direct-week-reschedule.ts`, and live Block reschedule application belongs in `packages/app/features/block-review/block-reschedule-controller.ts`.
- `packages/app/components/block-review/BlockReviewSurface.tsx` — `1714` lines. Large review presentation surface. Keep chart geometry in `packages/app/features/block-review/review-volume-chart-model.ts`; keep this component focused on responder state and rendering.
- `packages/app/components/block/BlockWeekList.tsx` — `722` lines. Shared review-week list and drag presentation. Keep day-order draft logic in `use-direct-week-reschedule.ts`; do not fork week-row behavior into onboarding and live Block copies.
- `packages/app/components/plan-builder/RunStructureEditor.tsx` — `1772` lines. Large presentation surface for structured session editing. Structured template/materialization/volume-sync rules now belong in `packages/app/features/plan-builder/structured-session-editor-engine.ts`; keep this component focused on rendering, transient form state, and dispatching engine actions.
- `packages/app/components/plan-builder/SessionEditor.tsx` — `1801` lines. Large simple-session editor. Keep simple field rendering and transient UI state here; shared target/profile and materialization behavior should stay in `packages/app/features/plan-builder/session-editing.ts` or the structured editor engine.
- `packages/types/src/lib/block-review.ts` — `433` lines. Shared block-review source of truth. Planned volume must come from `weekKmBreakdown`, including exact/estimated semantics, not persisted `PlanWeek.plannedKm`.
- `packages/app/app/sync-run/[activityId].tsx` — `1080` lines. Manual run resolution still mixes fetch, staged form state, and save orchestration even after the modal extraction. Keep pushing picker UIs and pure selection rules into sync feature modules/components.
- `packages/app/app/(tabs)/settings.tsx` — `721` lines. Settings, auth, Strava actions, and recovery actions are easy to sprawl here.
- `packages/app/app/onboarding/plan-builder/step-goal.tsx` — `562` lines. Plan-builder rules should land in shared plan-builder modules or shared domain helpers, not in the screen.
- `packages/app/app/onboarding/plan-builder/step-plan.tsx` — `622` lines. Keep generated-plan editing rules out of the onboarding screen shell.
- `packages/app/app/onboarding/plan-builder/step-template.tsx` — `949` lines. Template-week logic should prefer shared plan-builder modules over screen-local logic.
- `packages/app/app/(tabs)/home.tsx` — `418` lines. Home should stay a composition surface, not a new business-logic sink.
- `packages/server/src/services/strava-workflow-service.ts` — `525` lines. High-impact workflow boundary. Keep new behavior cohesive and avoid leaking orchestration back into routers or screens.
- `packages/server/src/trpc/plan.ts` — `283` lines. Plan validation and annotation logic are starting to concentrate here. Keep workflow logic out of the router.
- `packages/server/src/services/activity-workflow-service.ts` — `274` lines. Shared activity save/list workflow now carries niggle enrichment plus match/shoe persistence. Keep UI-specific shaping out of this service.

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

- `packages/app/features/plan-builder/structured-session-editor-engine.ts` for structured session template selection, simple-to-structured conversion, structured save materialization, parent volume sync, and structured-to-simple conversion
- `packages/app/features/plan-builder/*` for Step 2 starter-mode rules, shared client-side reorder state, staged reschedule drafts, onboarding template orchestration, and other interaction controllers that should stay out of hotspot screens
- `packages/app/components/plan-builder/*`
- `packages/types/src/lib/*` for plan-generation or plan-shaping logic
- `packages/app/features/*` if shared client-side onboarding orchestration emerges across steps

Do not let onboarding screens become the only place where plan rules live.

### Block review and live Block work

Start by looking in:

- `packages/types/src/lib/block-review.ts` for shared review model derivation, plannedKm/source-of-truth semantics, phase grouping, and volume stats
- `packages/app/features/block-review/live-block-review-model.ts` for adapting a persisted live plan to the shared model
- `packages/app/features/block-review/review-volume-chart-model.ts` for chart geometry, ticks, paths, markers, scrub selection, and gradient stops
- `packages/app/features/block-review/block-reschedule-controller.ts` for applying live Block reschedule drafts with completed/matched session preservation
- `packages/app/features/run/block-week-resolution.ts` for actual/completed overlays and resolved locked-week behavior
- `packages/app/features/plan-builder/use-direct-week-reschedule.ts` for drag draft state
- `packages/app/components/block-review/*` and `packages/app/components/block/*` for rendering

Do not add chart math, plannedKm derivation, or reschedule propagation directly to `block.tsx` or `BlockReviewSurface.tsx`.

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
