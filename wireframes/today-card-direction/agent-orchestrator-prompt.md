# Orchestrator Prompt: Implement Today Card Direction

You are implementing the Home Today card redesign for Steady.

## Required Context

Read these files first:
- `wireframes/today-card-direction/README.md`
- `wireframes/today-card-direction/index.html`
- `wireframes/today-card-direction/today-card-direction.png`
- `packages/app/components/home/TodayHeroCard.tsx`
- `packages/app/tests/hero-card.test.tsx`
- `packages/app/app/(tabs)/home.tsx`
- `packages/app/constants/colours.ts`
- `packages/app/constants/session-types.ts`
- `packages/app/lib/units.ts`

Read the Linear project and attached Linear document before editing. The Linear project is the source of product scope and acceptance criteria.

## Required Skills

Use these skills in this order:
1. `steady-feature-guardrails`
2. `branching-workflow`
3. `engineering`
4. `design-system`
5. `colour-language`
6. `brand-and-content`
7. `screens`
8. `tdd`
9. `tests`
10. `refactoring`

If a skill references another local skill that is directly relevant, read only the needed part.

## Branching

Create a fresh branch from `main`.

Suggested branch name:
- `today-card-redesign`

Keep the branch scoped to the Today card implementation and related tests. Do not mix this with the structured-session quality-summary project unless the Linear project explicitly says to wire a compact existing summary into the logged card.

## Product Intent

The Today card should answer one question at a time:

- Before the run: what should I go and run?
- After the run: did the run match the intent?

Before-run cards must be instructional, not analytical. After-run cards may be more analytical because the run has happened.

Do not add Steady AI to this surface.

## Implementation Direction

Before-run structure:
1. Session type chip top left.
2. `TODAY` label top right.
3. Session title.
4. Date.
5. One target frame.
6. One quiet detail line only when needed.
7. Finished-run CTA when runnable.

After-run structure:
1. Session type chip top left.
2. Status chip top right: `COMPLETED` or `NEEDS REVIEW`.
3. Verdict headline.
4. One short evidence sentence.
5. Slim comparison list.
6. Optional review row to open run detail.

## Colour Rules

Use semantic colours only:
- Session colour: chip, card border, session title.
- Today/status colour: top-right state label/chip and CTA.
- Distance cobalt: distance values only.
- Pace teal: pace values only.
- Time brass: duration/time values only.
- Effort plum: effort and feel values only.

Keep labels, card interiors, frames, and dividers neutral.

Remove planned heart-rate zones from the Today card.

Only show heart rate after logging if it explains the verdict. Otherwise leave HR to run detail.

## Planned Session Variants

Easy/long:
- target frame label: `Target`
- primary: effort cue when present
- secondary: pace or pace range when present
- no detail line by default

Tempo:
- target frame label: `Tempo target`
- primary: pace or pace range
- secondary: effort cue
- detail line: total distance, warm-up, cool-down where present

Interval:
- target frame label: `Rep target`
- primary: rep pace or pace range
- secondary: effort cue
- detail line: recovery, warm-up, cool-down where present

Do not show placeholders for missing effort or pace.

## Logged Variants

Easy/long:
- status chip: `COMPLETED`
- show verdict from existing summary logic
- show actual distance, pace, and feel/add-feel in a slim list

Tempo/interval:
- if quality-summary work is already available, use the compact summary entry point
- if not available, keep existing logged behaviour but align the card structure and leave a clear seam for the structured-session project
- do not invent new calculations in this implementation

Rest:
- `REST` chip top left
- `TODAY` top right
- no finished-run CTA by default

## TDD Plan

Use vertical slices. Do not write all tests first.

Suggested slices:
1. Before easy card no longer renders heart rate and shows effort plus pace in one target area.
2. Before tempo card renders tempo target and warm/cool detail line.
3. Before interval card renders rep target and recovery/warm/cool detail line.
4. Effort-only and pace-only targets render without placeholders.
5. Logged easy card renders session chip left, Completed status right, and slim evidence list.
6. Rest day renders Rest chip and no finished-run CTA.

After each slice:
- run the focused test
- implement the smallest code needed
- run the focused test again

After all slices:
- run the relevant app test suite
- do a visual check of the Home tab if the app can run locally

## Verification

At minimum run:
- focused `hero-card` tests
- relevant Home tests if touched
- typecheck or package test command if practical

Also compare the implemented UI against:
- `wireframes/today-card-direction/today-card-direction.png`

Do not overfit pixel-perfect values. The implementation should preserve the hierarchy, colour language, and component states.

## Linear Warm Trace

When finished or paused, update Linear with:
- branch name
- files changed
- tests run
- what remains
- any known risk or follow-up
