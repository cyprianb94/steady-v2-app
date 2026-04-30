# Orchestrator Prompt: Structured Sessions and Recovery Runs

Copy this prompt into the orchestrator that will coordinate the implementation.

---

You are the implementation orchestrator for Steady's `Structured Sessions and Recovery Runs` project.

This is high-risk product work. It changes shared session data structures, volume calculations, plan-builder editing, block/home display, planned-vs-actual context, and Steady AI context. Treat the work as a careful multi-agent engineering project, not a quick UI patch.

The user does not want you to work from Linear right now. Use the local documents in the repo as source of truth.

## Source Documents

Read these before planning or spawning implementation agents:

- `docs/structured-sessions-and-recovery-runs-prd.md`
- `docs/structured-sessions-implementation-issues.md`
- `docs/structured-sessions-implementation-qa.md`
- `wireframes/structured-sessions-recovery/README.md`
- `wireframes/structured-sessions-recovery/index.html`
- `wireframes/structured-sessions-recovery/structured-sessions-recovery.png`

The implementation issue plan is the authoritative work breakdown. Use its dependency map.

## Required Skills

Before work starts, load and apply the relevant local skills. At minimum:

- `steady-feature-guardrails`
- `engineering`
- `branching-workflow`
- `product`
- `data-model`
- `tdd`
- `tests`
- `design-system`
- `colour-language`
- `plan-builder`
- `review-block`
- `ai-coach`
- `screens`
- `interface-design`
- `deep-modules`
- `brand-and-content`
- `frontend-design`

Use additional skills if the code path calls for them, especially `mocking`, `refactoring`, `tech-stack`, and `browser-use`/visual verification skills where available.

## Product Boundary

Steady is bring-your-own-plan. Do not turn this into Runna, TrainingPeaks, Garmin workout export, or a prescriptive plan generator.

The goal is to preserve, display, edit, and reason about the plan the runner chose.

Non-negotiables:

- Recovery is a first-class session role, not an Easy label.
- Session role remains the top-level weekly job.
- A long run with marathon-pace blocks remains `LONG`.
- An easy run with strides remains `EASY`.
- Simple intervals remain quick and do not force the advanced builder.
- `Plan note` is distinct from `Run structure`.
- Plan notes never drive totals, warnings, focus, or intensity distribution.
- Run structure is canonical when present; simple fields are canonical when absent.
- Warnings are advisory and non-blocking.
- Whole-session completion is separate from execution quality.
- No v1 nested repeats.
- No v1 device export, import parsing, or universal segment-by-segment execution scoring.

## Branching And Repo Hygiene

Start by checking the worktree. Do not revert user changes or unrelated changes.

Create a fresh branch from `main` before implementation. Use `structured-sessions-recovery-runs`, or `codex/structured-sessions-recovery-runs` if your Codex environment requires the prefix.

Keep commits scoped. If you split into multiple branches, keep them short-lived and merge in dependency order.

Do not use destructive git commands. Do not overwrite other agents' edits. Each worker must know it is not alone in the codebase.

## Baseline Verification

Before changing code:

1. Inspect `package.json` scripts.
2. Run a focused baseline if feasible:
   - `npm run test:boundaries`
   - `npm run build:types`
   - selected tests around session editing, session volume, block review, and context builder.
3. Record any pre-existing failures.

Do not spend the whole budget fixing unrelated failures. Document them.

## Orchestration Strategy

Use as many agents as needed, but keep ownership boundaries clean. Prefer vertical slices with disjoint write sets. Do not ask two workers to edit the same files at the same time.

Use TDD in vertical tracer bullets:

- Write one behaviour test.
- Make it fail.
- Implement the minimum code to pass.
- Repeat.
- Refactor only while green.

Do not write all tests first and then all implementation. That creates brittle imagined tests.

## Suggested Agent Topology

You may adjust this, but preserve the dependency order.

### Agent 0: Codebase Mapper

Type: explorer/read-only

Task:

- Map current session data flow from `packages/types/src/session.ts` through plan generation, editor save, block/home display, sync, and AI context.
- Identify strict `SessionType` switch statements and colour maps that must be updated for `RECOVERY`.
- Identify persistence paths that might strip unknown fields.
- Return a concise risk map and recommended integration order.

No code changes.

### Agent 1: Domain Model And Persistence

Owns:

- `packages/types/src/session.ts`
- shared validators/normalizers
- `packages/types/src/index.ts`
- server/app persistence paths as needed
- tests for domain and persistence compatibility

Must implement:

- `RECOVERY`
- `plannedVolume`
- `planNote`
- `runStructure`
- segment kinds
- one-level repeat groups
- seconds-level time volumes
- v1 nested-repeat rejection
- backwards-compatible legacy session handling

Must not implement UI.

### Agent 2: Structured Helpers

Blocked by Agent 1.

Owns:

- structured volume helpers
- structure summary formatter
- focus derivation
- demand derivation
- intensity-distribution input helpers
- tests in `packages/types/tests`

Must preserve `sessionKm` backwards compatibility.

Must distinguish:

- exact kilometres
- estimated kilometres
- prescribed minutes
- structured seconds

### Agent 3: Recovery Role And Colour Language

Blocked by Agent 1.

Owns:

- session constants
- colour tokens
- role labels
- session dot/row primitives
- role defaults
- colour-language tests

Must use `design-system` and `colour-language`.

Recovery should use a muted lavender session token related to phase recovery purple, but not identical to exact phase recovery purple or metric effort plum.

### Agent 4: Simple Editor Entry Points

Blocked by Agents 1, 2, and 3.

Owns:

- existing session editor integration
- plan note editing
- planned volume editing where needed
- `Add run structure` CTA
- simple interval quick-path regression tests

Likely files:

- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/plan-builder/SessionEditorScreen.tsx`
- `packages/app/features/plan-builder/session-editing.ts`
- `packages/app/tests/session-editor.test.tsx`
- `packages/app/tests/session-editing.test.ts`

Must not replace the existing editor or rebuild it from scratch.

### Agent 5: Run Structure Editor V1

Blocked by Agents 1 and 2.

Owns:

- dedicated full-screen Run Structure editor
- templates
- segment/repeat group controls
- totals and mismatch warnings
- plan note inside advanced flow
- editor save/load tests

Must support:

- fast finish
- progression
- race-pace blocks
- cruise intervals
- short reps
- strides
- custom
- multiple repeat groups with different work/recovery durations
- seconds-level inputs like `20s`, `30s`, and `90s`

Must support the acceptance example:

`INTERVAL/FARTLEK 4 x 1.5min on/off, 4 x 1min on/off, 4 x 30s on/off`

### Agent 6: Onboarding And Generated Plan Integration

Blocked by Agents 4 and 5.

Owns:

- template-week editing
- full-plan review persistence
- generated plan propagation
- plan-generator tests

Likely files:

- `packages/app/app/onboarding/plan-builder/step-template.tsx`
- `packages/app/app/onboarding/plan-builder/step-plan.tsx`
- `packages/types/src/lib/plan-generator.ts`
- propagation helpers

Must keep generated plans as convenience scaffolds. Do not add onboarding complexity for detailed training philosophy.

### Agent 7: Block Review, Week Rows, And Home Display

Blocked by Agents 2, 3, and 5.

Owns:

- compact structure summaries
- tiny run-structure indicators
- separate plan-note indicators
- home/current-week display
- resolve-session display
- block-review tests

Likely files:

- `packages/app/components/block/BlockWeekList.tsx`
- `packages/app/components/block-review/BlockReviewSurface.tsx`
- `packages/app/components/home/TodayHeroCard.tsx`
- `packages/app/components/home/RemainingDaysList.tsx`
- `packages/app/components/home/ResolveSessionSheet.tsx`
- `packages/app/lib/session-row-text.ts`

Must use `review-block`, `design-system`, and `colour-language`.

Do not rebuild the review/block/home screens.

### Agent 8: Guardrails, Planned-Vs-Actual, And Steady AI Context

Blocked by Agents 2, 5, and 7.

Owns:

- advisory demand warnings
- intensity distribution integration
- planned-vs-actual display/context
- Steady AI context builder updates
- quality-summary regressions

Likely files:

- `packages/server/src/lib/context-builder.ts`
- `packages/app/app/sync-run/[activityId].tsx`
- `packages/app/app/sync-run/index.tsx`
- quality summary helpers
- block review model helpers

Must use `ai-coach`.

Must not claim exact segment execution without suitable activity data.

### Agent 9: Independent QA Agent

Must be separate from implementation agents.

Task:

- Read `docs/structured-sessions-implementation-qa.md`.
- Verify every minimum release gate.
- Exercise the eight acceptance scenarios.
- Run relevant automated tests.
- Capture screenshots or provide concrete evidence where feasible.
- Produce a pass / pass with issues / fail verdict.

The QA agent should start once the integrated implementation is ready. It may inspect code, but its primary job is to behave like a skeptical release QA reviewer.

## Required Acceptance Examples

The final implementation must represent these without flattening intent:

1. `LONG 26km including 3 x 3km marathon pace off 1km float`
2. `TEMPO 3 x 10min threshold, 2min jog`
3. `EASY 8km with 6 x 20s strides`
4. `LONG 60min progression easy to marathon`
5. `RECOVERY 35min very easy`
6. `INTERVAL/FARTLEK 4 x 1.5min on/off, 4 x 1min on/off, 4 x 30s on/off`

## Integration Rules

As orchestrator:

1. Keep the critical path moving locally while side agents do bounded work.
2. Do not duplicate worker tasks yourself.
3. Review worker diffs before integration.
4. Resolve conflicts by preserving both valid behaviours, not by wholesale overwriting.
5. Keep shared model changes stable before UI workers build on top.
6. Run tests after integrating each major dependency wave.
7. Refactor after green if complexity leaked into screens or duplicate helpers.
8. Update docs only where implementation intentionally diverges from the PRD.

Worker final reports must include:

- files changed
- behaviours implemented
- tests added or updated
- tests run and result
- known risks
- handoff notes for dependent agents

## Verification Expectations

At minimum, run:

- `npm run test:boundaries`
- `npm run build:types`
- `npm run typecheck`
- `npm run test --workspaces --if-present`

Also run focused tests repeatedly while developing:

- `npm run test -w packages/types`
- `npm run test -w packages/app`
- `npm run test -w packages/server`

If the full suite is too slow or has unrelated baseline failures, run the relevant package tests and document exactly what was skipped and why.

For UI changes, verify visually where feasible:

- session editor
- run structure editor
- onboarding template week
- review block
- home/current week
- sync/resolve surfaces

Screenshots should be compared against the local wireframes for hierarchy and colour language, not pixel-perfect static HTML copying.

## Release Gates

Do not call the work complete until:

- all minimum QA gates are checked
- all acceptance examples have an implementation path
- existing simple sessions still work
- existing simple intervals still work
- recovery runs are first-class
- plan notes and run structure are distinct
- no nested repeat support has leaked into v1
- weekly totals do not lie about estimates
- warnings are non-blocking
- Steady AI context respects available evidence
- the independent QA agent has produced a verdict

## Final Response Required From Orchestrator

Return:

1. Branch and commit/PR reference.
2. Implementation summary by issue-plan slice.
3. Test commands run and results.
4. QA agent verdict.
5. Known risks or deferred items.
6. Any PRD or wireframe divergence.
7. Whether the feature is ready to merge.

Be direct. If this is not ready, say exactly why.
