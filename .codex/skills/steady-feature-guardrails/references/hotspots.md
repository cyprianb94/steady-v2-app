# Hotspots

Use this file when a feature touches an area that historically attracted debt.

## Current hotspot files

- `packages/app/app/(tabs)/block.tsx` — `1290` lines. High-risk controller screen. Avoid adding more orchestration here.
- `packages/app/app/(tabs)/settings.tsx` — `746` lines. Settings and recovery actions are easy to sprawl here.
- `packages/app/app/(tabs)/home.tsx` — `567` lines. Home should stay a composition surface, not a new business-logic sink.
- `packages/app/app/onboarding/plan-builder/step-template.tsx` — `485` lines. Plan-builder changes should prefer shared plan-builder modules over screen-local logic.
- `packages/app/app/(tabs)/week.tsx` — `429` lines. Avoid duplicating behavior that also exists in Home or Block.
- `packages/server/src/trpc/activity.ts` — `262` lines. Keep workflow logic out of the router.
- `packages/server/src/trpc/strava.ts` — `247` lines. Keep sync orchestration out of the router.

## Preferred landing zones

### App behavior shared across screens

If the same behavior appears in `Home`, `Week`, `Block`, `Settings`, or `sync-run`, prefer:

- `packages/app/lib/*` for shared app-side orchestration and client helpers
- focused feature components under `packages/app/components/<feature>/` for UI-specific shared behavior

Do not independently patch each screen unless the change is tiny and presentation-only.

### Recovery-related work

Start by looking in:

- `packages/app/components/recovery/*`
- `packages/app/lib/resume-week.ts`

Keep recovery rules shared. Do not re-encode them separately in `Home` and `Settings`.

### Plan-builder work

Start by looking in:

- `packages/app/components/plan-builder/*`
- `packages/types/src/lib/*` for plan-generation or plan-shaping logic

Do not let onboarding screens become the only place where plan rules live.

### Activity and sync work

Start by looking in:

- `packages/app/lib/activity-api.ts`
- `packages/server/src/lib/*`
- `packages/server/src/repos/*`

Keep transport, workflow, and persistence concerns separated.

### Server workflow changes

Start by looking in:

- `packages/server/src/lib/*` for services and workflow modules
- `packages/server/src/repos/*` for persistence boundaries
- `packages/server/src/trpc/*` only for validation and delegation

## Anti-patterns to avoid

- adding new business logic directly to `block.tsx` because it is already open
- duplicating the same recovery or sync fix across multiple screens
- importing `@steady/server/src/**` from the app
- putting environment detection or native-module setup into screen files
- shipping a shortcut without leaving a Linear follow-up
