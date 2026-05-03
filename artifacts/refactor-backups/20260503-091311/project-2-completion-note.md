# Project 2 Completion Note: Run Detail Controller

Timestamp: 20260503-0945
Branch: codex/plan-persistence-run-detail-refactor
Base rollback branch: codex/rollback-before-plan-run-refactor-20260503-091311
Project patch backup: artifacts/refactor-backups/20260503-091311/project-2-run-detail-controller.patch

## Changed Files

- packages/app/app/sync-run/[activityId].tsx
- packages/app/features/sync/use-run-detail-controller.ts
- packages/app/tests/home.test.tsx
- packages/app/tests/use-run-detail-controller.test.tsx
- .codex/skills/screens/SKILL.md
- .codex/skills/steady-feature-guardrails/references/hotspots.md
- .codex/skills/tests/SKILL.md
- artifacts/refactor-backups/20260503-091311/project-2-current-branch.txt
- artifacts/refactor-backups/20260503-091311/project-2-run-detail-controller.patch
- artifacts/refactor-backups/20260503-091311/project-2-timestamp.txt
- artifacts/refactor-backups/20260503-091311/project-2-untracked-files.txt

## Summary

The sync-run detail route now delegates load, draft state, match replacement intent, shoe/niggle/subjective/fuelling staging, stale split refresh, save orchestration, save error copy, and plan refresh after save to `useRunDetailController`.

The screen still owns route parameters, modal visibility, scroll positioning, selected split rail UI state, and rendering composition. Server `activity.saveRunDetail` remains the persistence source of truth for the multi-step save.

## New Or Rewritten Tests

- Added `packages/app/tests/use-run-detail-controller.test.tsx` for loading and draft seeding, save payload and plan-refresh ordering, fuelling migration error copy, replacement match intent, and stale Strava split refresh.
- Tightened one async assertion in `packages/app/tests/home.test.tsx` so the saved-feel test waits for the loaded activity value instead of an intermediate completed-card footer label.
- Existing `packages/app/tests/sync-run-detail.test.tsx` continues to cover the rendered screen behavior through the extracted controller.

## Behavior Preserved

- Existing activity-plan matching semantics are preserved.
- Saving subjective input, notes, shoes, niggles, and fuel events still goes through server workflow persistence.
- Fuelling migration-specific error copy is preserved.
- Stale Strava splits still refresh once for the loaded activity.
- Plan refresh still happens after a successful save before returning to the caller.
- No visual redesign was performed.

## Known Risks

- `packages/app/app/sync-run/[activityId].tsx` is smaller but still a large render surface at 1308 lines.
- The app-side controller still imports `trpc` directly; a narrower injected gateway could be introduced later if run-detail behavior grows again.
- Split refresh remains a one-shot per activity id while the controller is mounted.
- No data-shape or migration changes were made.

## Rollback Instructions

To revert only Project 2 after this is committed, run:

```sh
git revert <project-2-commit>
```

Or, before commit, apply the inverse of:

```sh
git apply -R artifacts/refactor-backups/20260503-091311/project-2-run-detail-controller.patch
```

Rollback affects the app package and local skills only. It does not affect server code, type schemas, or database/data shape. After rollback, repeat manual app checks for opening a run from Home and Block, saving run detail fields, and confirming Home/Block completion state.

## Manual App Risk For Cyprian

Open a synced run from Home and Block, change the matched session, save subjective inputs, notes, niggles, shoe, and fuelling, refresh stale Strava splits where available, verify the run remains matched after app refresh, and verify Home/Block completion state updates correctly.
