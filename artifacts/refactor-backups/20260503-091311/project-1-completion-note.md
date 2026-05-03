# Project 1 Completion Note

- Project: Plan persistence/workflow boundary
- Work branch: `codex/plan-persistence-run-detail-refactor`
- Safety branch: `codex/rollback-before-plan-run-refactor-20260503-091311`
- Project 1 commit: this commit (`Extract plan persistence workflow boundary`); use `git log -1 --oneline` after checkout for the exact hash.
- Patch backup: `artifacts/refactor-backups/20260503-091311/project-1-plan-persistence-workflow-boundary.patch`

## Changed Files

- `.codex/skills/steady-feature-guardrails/references/hotspots.md`
- `.codex/skills/tests/SKILL.md`
- `packages/app/app/(tabs)/home.tsx`
- `packages/app/lib/plan-api.ts`
- `packages/app/tests/plan-api.test.ts`
- `packages/server/src/services/plan-workflow-service.ts`
- `packages/server/src/trpc/plan.ts`
- `packages/server/src/trpc/router.ts`
- `packages/server/tests/plan-workflow-service.test.ts`

## New/Rewritten Tests

- Rewrote `packages/app/tests/plan-api.test.ts` around the thin tRPC/demo transport boundary and dev/release equivalence.
- Added `packages/server/tests/plan-workflow-service.test.ts` for active plan load/annotations, save preservation, validation, week normalization, and training pace propagation behavior.

## Behavior Preserved

- Screenshot demo behavior remains app-local.
- Real dev and release plan loading/saving/profile/week writes now use the same tRPC/server workflow.
- Server annotations remain the non-demo source of truth.
- Existing active plan id, `createdAt`, training pace profile, and active injury state are preserved on save when input omits profile/injury.
- Training pace profile updates still propagate only to future profile-linked sessions and preserve manual, legacy, matched, and completed sessions.

## Known Risks

- `updateWeeks` remains a whole-plan-week replacement bridge for Home/Block. It now flows through one server workflow, but a narrower intent API should eventually replace it.
- Recovery plan mutations still call tRPC directly from `use-recovery-action-controller`; they delegate to the same server workflow but are not yet wrapped by `plan-api.ts`.
- No data-shape or migration change was made.

## Rollback Instructions

- Revert only Project 1 with `git revert <PROJECT_1_COMMIT>`.
- Scope affected by rollback: app, server, tests, and skills. Types and database schema are unaffected.
- If rollback is needed after Project 2, revert Project 2 first, then Project 1.
- Repeat manual verification for plan creation/replacement, training pace edits, app refresh, Home annotations, and Home/Block week agreement after rollback.

## Manual App Risk Paragraph for Cyprian

Build a new plan, replace an existing plan, edit training paces, restart/refresh the app, confirm Home loads the expected plan, confirm annotations still appear where expected, and confirm Block/Home still agree on current week and weekly volume.
