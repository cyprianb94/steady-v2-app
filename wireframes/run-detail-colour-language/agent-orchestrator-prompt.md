# Agent Prompt: Run Detail Colour Language Pilot

You are the implementation orchestrator for the Linear project **Run Detail Colour Language Pilot**.

Linear project:
- Project URL: https://linear.app/cypriansprojects/project/run-detail-colour-language-pilot-8b9d903916ae
- Issues:
  - STV2-186: Add semantic metric colour tokens
  - STV2-187: Apply metric colours to Run detail summary metrics
  - STV2-188: Apply metric and status colour to Planned vs actual
  - STV2-189: Update Run detail splits with metric columns and average pace marker
  - STV2-190: Quietly apply semantic colour to feel, shoes, fuelling, and niggles
  - STV2-191: Run visual QA for the Run detail colour-language pilot

Design source of truth:
- Wireframe HTML: `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/run-detail-colour-language/index.html`
- Wireframe PNG: `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/run-detail-colour-language/run-detail-colour-language.png`
- Colour language skill: `/Users/cyprianbrytan/Projects/steady-v2-app/.codex/skills/colour-language/SKILL.md`

Use the wireframe as the visual target, but implement only the existing Run detail product surface. Do not introduce new features that appeared in earlier exploratory wireframes.

## Required Skills

Before implementing, explicitly load and follow:
- `$colour-language` for semantic colour rules and token meanings
- `$design-system` for Steady UI primitives, spacing, typography, and component consistency
- `$brand-and-content` for naming, copy, and avoiding noisy product language
- `$screens` for screen-level navigation and information hierarchy
- `$steady-feature-guardrails` for feature boundaries and architecture routing
- `$engineering` for implementation discipline and verification
- `$tdd` for test-driven vertical slices
- `$tests` for test quality and avoiding brittle implementation-coupled tests
- `$branching-workflow` for branch, commit, merge, and cleanup flow
- `$linear` for issue status, comments, and project traceability

## Permission To Delegate

You may create as many subagents as are useful, but only when the work can be split cleanly.

Use this coordination model:
- Keep one agent responsible for one write scope.
- Do not let two agents edit the same file at the same time.
- Do not ask agents to redo the same exploration.
- Do not leave implementation-only work on a side branch without merging it back.
- If most Run detail UI changes are concentrated in one screen file, assign one UI implementation owner and use other agents for tests, QA, issue updates, or focused exploration.

Recommended split:
- Token owner: STV2-186. Owns semantic colour tokens and any token tests/docs.
- Run detail UI owner: STV2-187, STV2-188, STV2-189, STV2-190. Owns the Run detail screen changes to avoid conflicts.
- Test/verification owner: focused tests, accessibility checks, and regression checks after the UI owner lands changes.
- Visual QA owner: STV2-191. Compares the app against the wireframe and records gaps.
- Linear owner, if useful: keeps issue comments/status accurate while implementation proceeds.

## Product Constraints

This pilot is only about applying the approved colour language to the existing Run detail experience.

Do not add:
- A phase timeline at the top of Run detail
- A new pace chart
- A new heart-rate chart
- Derived chips such as `+2.8 more than planned`
- Drift chips such as `late drift`
- AI or "Steady readout" cards
- New interval-specific analytics beyond the existing splits/segments table
- New data requirements that are not already available to Run detail

Preserve existing behavior, data model, save flow, forms, selectors, and navigation.

## Colour Language To Implement

Colour must carry meaning, not decoration.

Metric tokens:
- Distance: cobalt/lapis family, approved target `#3D55A4`
- Pace: teal family, approved target `#187F7A`
- Time/duration: brass family, approved target `#9D711F`
- Heart rate: coral/red family, approved target `#BD433B`
- Elevation: moss/olive family, approved target `#607B38`
- Effort: plum family, approved target `#765098`
- Fuelling: copper family, approved target `#A5612F`
- Shoes/kit: blue-grey family, approved target `#577080`

Important separation:
- Metric colour identifies the data type.
- Phase colour identifies training phase context. Existing phase colour coding must remain separate and must not be overwritten or repurposed.
- Session colour identifies workout/session type.
- Status colour communicates a judgement or state.
- Action colour communicates an available action.

Application rules:
- Use colour mainly on values, small bars, icons, selected chips, and thin accents.
- Keep cards, page backgrounds, dividers, and body text mostly neutral.
- Do not tint entire cards for routine metrics.
- Do not colour every chip. For feel chips, neutral options stay neutral; only selected recorded answers receive quiet semantic styling.
- Keep accessibility contrast acceptable in light mode.

Splits rule:
- Pace bar fill uses pace colour.
- The grey vertical marker shows the run average pace.
- A bar extending past the marker means faster than average.
- A bar ending before the marker means slower than average.
- Preserve this meaning in code and visual QA notes.

## TDD And Implementation Order

Follow TDD where it is meaningful:
1. Start with the smallest vertical slice.
2. Write or update one focused test first.
3. Implement the minimum production change.
4. Run the relevant test and make it pass.
5. Repeat for the next slice.

Do not write brittle tests that assert every visual style string. Prefer tests that prove:
- Semantic token helpers exist and are exported through the expected public surface.
- Run detail maps metric types to semantic tokens consistently.
- Split pace marker calculations handle faster, slower, and average cases.
- Existing save/edit/selection behavior still works.

For purely visual details, rely on browser/device screenshots and explicit QA notes instead of overfitting tests to layout internals.

## Branching And Merge Requirements

Use the repository branching workflow.

Required flow:
1. Start from an up-to-date `main`.
2. Create a short, scoped branch for the first independently mergeable slice. If the active Codex environment requires a prefix, use that required prefix plus a short descriptive name.
3. Commit only scoped work for that slice.
4. Run relevant tests and checks before merging.
5. Merge back into `main` once verified.
6. Delete the finished branch.
7. Repeat for the next slice if needed.

Do not:
- Leave uncommitted work at the end.
- Leave finished work only on feature branches.
- Revert unrelated user changes.
- Squash unrelated edits together.
- Use destructive git commands unless the user explicitly approves.

At final handoff, `main` should contain the completed, verified pilot work. If a safe merge cannot be completed because of conflicts, failing tests, or unclear requirements, stop and report exactly what remains.

## Linear Traceability

For each issue:
- Move/update status as work starts and finishes.
- Comment with the branch name, commit hash, test command output summary, and any notable design decisions.
- Link back to the wireframe paths where relevant.

For the project:
- Add a final project status update describing what shipped, what was verified, and any remaining risks.

## Verification Checklist

Before final merge/handoff:
- Run token/unit tests.
- Run relevant Run detail tests.
- Run typecheck/lint if available and reasonably scoped.
- Open the Run detail screen in the app or browser harness.
- Compare against the wireframe PNG and HTML.
- Verify light-mode contrast and that the screen does not read as a rainbow.
- Verify distance and pace are clearly different colour families.
- Verify phase colours still exist separately from metric colours.
- Verify unselected feel chips remain neutral.
- Verify the selected feel chips are quiet and not over-coloured.
- Verify split pace bars include the grey average marker and explain the same meaning as the wireframe.

## Final Response Requirements

When finished, report:
- Issues completed
- Branches used and merged
- Commits created
- Tests/checks run
- Screenshots or visual QA artifacts produced
- Any residual risks or follow-up issues

Do not claim completion unless the work is committed, merged into `main`, and the working tree is clean apart from unrelated pre-existing user changes.
