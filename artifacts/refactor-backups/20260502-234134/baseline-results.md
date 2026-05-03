# Baseline Results

- Branch before work: main
- Work branch: codex/structured-session-block-refactor-20260502-234134
- Safety branch: codex/refactor-safety-20260502-234134
- npm run test:boundaries: passed
- npm run typecheck: passed
- npm run test --workspaces --if-present: passed

Pre-existing warnings observed:
- React act(...) warnings in packages/app/tests/block-rearrange.test.tsx around BlockTab state updates.

Previously audited failure not reproduced:
- packages/app/tests/live-block-review-model.test.ts passed; the plannedKm 46 vs 50.4 failure did not reproduce in this baseline run.
