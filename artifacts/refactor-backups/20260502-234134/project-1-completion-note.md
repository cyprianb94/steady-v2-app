# Project 1 Completion Note

- Rollback commit: `a8040af` (`Extract structured session editor engine`)
- Patch backup: `artifacts/refactor-backups/20260502-234134/project-1-structured-session-editor-engine.patch`
- Changed files: `.codex/skills/plan-builder/SKILL.md`, `.codex/skills/steady-feature-guardrails/references/hotspots.md`, `.codex/skills/tests/SKILL.md`, `packages/app/components/plan-builder/RunStructureEditor.tsx`, `packages/app/features/plan-builder/structured-session-editor-engine.ts`, `packages/app/tests/structured-session-editor-engine.test.ts`, `packages/types/tests/session-km.test.ts`
- New/rewritten tests: app boundary tests for `structured-session-editor-engine`; type-level `session-km` tests for exact vs estimated session/week volume.
- Behavior preserved: existing session editor and run-structure editor tests pass; structured templates, profile target hydration, simple/structured conversion, parent volume sync, and exact/estimated volume semantics are covered at the engine/type boundary.
- Known risks: `RunStructureEditor.tsx` still owns presentation summary helpers and segment UI state; simple `expectedDistance()` still intentionally differs from `sessionKm()` for interval recovery jogs.
- Rollback instructions: `git revert a8040af` reverts Project 1 code/tests/skill updates. This affects app and types code only; no data-shape or migration risk.
- Manual app test for Cyprian: Open the session editor, switch between simple and structured sessions, choose templates, edit custom volume and pace, save, reopen, and verify the session title/target/weekly volume still make sense.
