# Orchestrator Prompt: Edit Run Colour Language Refresh

You are the orchestrator agent for the Steady project `Edit run colour language refresh`.

Linear project:
- Project: https://linear.app/cypriansprojects/project/edit-run-colour-language-refresh-2ce33609ee0d
- Design guidance document: https://linear.app/cypriansprojects/document/design-guidance-edit-run-colour-language-4dc495142b4f
- Issues: `STV2-207`, `STV2-208`, `STV2-209`, `STV2-210`, `STV2-211`

Local wireframe references:
- `wireframes/edit-run-colour-language/index.html`
- `wireframes/edit-run-colour-language/edit-run-colour-language.png`

## Mission

Apply the quieter edit-run/session colour-language direction to the real app.

This is not a full redesign. Preserve the existing notebook-row editor model and improve comprehension through restrained colour, clearer pace language, and a quieter unit toggle.

The edit-session screens are shared across multiple app contexts. Treat shared-component blast radius as a first-class risk.

## Required Skills

Load and follow these skills before implementation:

- `steady-feature-guardrails`
- `colour-language`
- `design-system`
- `brand-and-content`
- `frontend-design`
- `plan-builder`
- `screens`
- `tdd`
- `tests`
- `branching-workflow`

Load these if the exploration shows shared boundary or abstraction work:

- `interface-design`
- `deep-modules`
- `refactoring`

## Branching

Create a fresh branch from `main` before editing. Follow the active session's branch naming rules. If the environment requires a `codex/` prefix, use `codex/edit-run-colour-language`; otherwise use `edit-run-colour-language`.

Before editing:

- Run `git status --short`.
- Identify unrelated dirty files.
- Do not revert user changes.
- Keep changes scoped to this project.

## First Pass: Read and Map

Start with `STV2-207`.

Audit all entry points and call sites for the shared edit/session editor before changing UI primitives.

Read at least:

- `packages/app/components/plan-builder/SessionEditor.tsx`
- `packages/app/components/plan-builder/SessionEditorScreen.tsx`
- `packages/app/components/ui/NotebookRow.tsx`
- `packages/app/components/ui/NotebookRowValue.tsx`
- `packages/app/components/ui/EditableChipStrip.tsx`
- `packages/app/components/ui/ChipStripEditor.tsx`
- `packages/app/components/ui/UnitTogglePill.tsx`
- `packages/app/tests/session-editor.test.tsx`
- `packages/app/constants/colours.ts`
- `packages/app/constants/session-types.ts`

Find every context where the session editor appears: screen presentation, sheet presentation, plan builder, edit run/session entry points, onboarding or review flows if present.

Capture a short implementation map in your working notes or PR notes:

- Entry points.
- Shared primitives affected.
- Behaviours that must not regress.
- Tests that already exist.
- Tests that need adding.

## Product and Design Direction

Use `Training paces` for the group label. Use `range` for ranged training pace options.

Expanded pace rows should show two sections:

1. `Training paces`
   - Profile-derived pace options, such as Easy range, Interval range, Threshold range, Steady range, Race pace.
   - Selected training pace should use a quiet teal outline/tint, not a solid teal filled pill.
   - Labels must be concrete. For example: `Easy range`, `Interval range`, `Threshold range`.

2. `Manual paces`
   - Nearby explicit pace chips plus `Custom...`.
   - Manual chips remain neutral until selected.

Do not use the earlier `Profile pace / Custom` segmented control. It made interval/profile pace difficult to understand.

The `km/min` toggle should be compact and quiet:

- Small inline toggle near the row label.
- Active `km` can use light distance tint and cobalt text.
- Active `min` can use light time tint and brass text.
- Avoid wide filled blue/brass segmented controls.
- Keep existing haptic behaviour.

Colour-language rules:

- Session colour answers: what type of session is this?
- Metric colour answers: what kind of value is being edited?
- Action colour answers: what can the runner do?
- Status colour answers: what judgement/state is Steady communicating?

For this project:

- Session colour stays on session identity: session type chip, header type word, contextual session label where useful.
- Metric colour should be restrained: active row text, chevrons, focused controls, selected subtle outlines/tints.
- Do not colour every collapsed row value by metric by default.
- Keep `Update session` / `Add session` clay as the primary action.
- Keep `Cancel` neutral.
- Do not add raw colour values if existing semantic tokens are available.

Relevant tokens:

- Distance: `C.metricDistance`
- Pace: `C.metricPace`
- Pace tint: `C.metricPaceBg`
- Time: `C.metricTime`
- Effort: `C.metricEffort`, sparingly
- Primary action: `C.clay`
- Session identity: `SESSION_TYPE[type].color` and `SESSION_TYPE[type].bg`

## TDD Workflow

Use vertical TDD slices. Do not write a batch of speculative tests first.

Suggested slices:

1. RED: Add/update a session editor test that expects `Training paces` and `Manual paces` labels for expanded target pace.
   GREEN: Implement the smallest UI change to pass.

2. RED: Add/update a test proving interval target pace reads as an interval training pace.
   GREEN: Implement label/option grouping logic.

3. RED: Add/update a unit-toggle test if current coverage does not protect km/min switching after style/API changes.
   GREEN: Make the toggle compact without changing behaviour.

4. RED: Add/update a test for custom/manual pace behaviour if the grouping work changes selection paths.
   GREEN: Preserve manual and custom selection.

After green, refactor only while tests pass.

Test through public component behaviour. Avoid brittle assertions on internal helper names unless there is no better public boundary.

## Agent Delegation Guidance

You may spin subagents if useful. Do not delegate the immediate blocking task if you need it for your next step.

Good delegation options:

- Explorer agent: audit all session editor entry points and return a concise map.
- Explorer agent: inspect current session editor tests and identify which behaviours are already covered.
- Worker agent: implement compact `UnitTogglePill` treatment if its write scope is isolated.
- Worker agent: implement pace grouping labels/options if its write scope is isolated.
- Verification agent: run tests and inspect screenshots after implementation while you review code.

If using workers:

- Tell them they are not alone in the codebase.
- Give them disjoint write scopes.
- Tell them not to revert unrelated edits.
- Require changed file paths in their final response.

Suggested ownership split:

- Worker A: `UnitTogglePill.tsx` and any focused tests for unit switching.
- Worker B: pace editor grouping in `SessionEditor.tsx` plus session editor tests.
- Main orchestrator: integration, colour-language consistency, shared component review, final verification.

## Verification

Run the relevant test suite. Start with:

- `npm test -- session-editor`

If the repo uses another command, inspect `package.json` and use the local convention.

Also run targeted tests for touched shared UI primitives if they exist.

For visual verification:

- Check easy, interval, tempo, long, and rest sessions.
- Check expanded target pace rows.
- Check interval target pace specifically.
- Check repetitions/recovery/warm-up/cool-down unit toggles.
- Check custom value editing and keyboard behaviour.
- Check both screen and sheet presentation if both are active.

Use screenshots if the app can be run locally. Compare against:

- `wireframes/edit-run-colour-language/edit-run-colour-language.png`

Do not try to match the wireframe pixel-for-pixel. Match the design intent:

- quieter colours,
- clearer Training paces,
- compact km/min,
- no rainbow collapsed state,
- no regression in shared editor flows.

## Completion Criteria

The project is done when:

- `STV2-207` audit notes are represented in PR notes or issue comments.
- `STV2-208` compact unit toggle is implemented.
- `STV2-209` pace editor uses `Training paces` and `Manual paces`.
- `STV2-210` colour-language treatment is restrained and semantically correct.
- `STV2-211` verification is complete.
- Relevant tests pass.
- Any residual risk is clearly called out.
- The branch is committed and ready for PR.

## Final Response Expected From The Implementing Agent

Include:

- Files changed.
- Tests run and results.
- Screens/flows manually checked.
- Linear issues covered.
- Any follow-up issue created for debt or open risk.
