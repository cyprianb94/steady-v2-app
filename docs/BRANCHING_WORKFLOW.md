# Branching Workflow

## Default approach

Use `main` as the stable branch.

For each feature or fix:

1. Create a new short-lived branch from `main`.
2. Keep the branch scoped to one logical piece of work.
3. Make commits only for that feature or fix.
4. Open a PR back into `main`.
5. Run tests and review it.
6. Merge it into `main`.
7. Delete the feature branch.

This repo works best when we avoid long-lived catch-all branches.

## What to ask an agent to do

When working with an agent, a good default instruction is:

> Create a fresh branch from `main` for this work, keep the changes scoped to this feature only, commit on that branch, and when it is ready merge it back into `main` and clean up the branch.

You can also be more explicit:

- Create a new branch first.
- Keep changes limited to this feature or fix.
- Commit the work on that branch.
- Prepare or open a PR into `main`.
- Merge it when ready.
- Switch back to `main` and delete the branch afterward.

## Branch naming

Use short, descriptive names. Examples:

- `codex/landing-anchor-fix`
- `codex/strava-sync`
- `codex/home-redesign`
- `codex/block-rearrange`

## Rules that help

- One branch per logical feature or fix.
- Do not mix unrelated work in one branch.
- Merge smaller branches often.
- If a task grows too large, split it into multiple branches instead of letting one branch keep expanding.
- If `main` moves while you are working, bring the latest `main` into the branch before opening or merging the PR.

## Practical examples

Good:

- A branch only for the landing page anchor fix.
- A branch only for Strava sync.
- A branch only for the home redesign.

Bad:

- One branch containing landing changes, auth changes, app UI updates, and backend work all together.

## Why this works better

This approach makes it easier to:

- review changes
- test safely
- find regressions
- merge without conflicts
- roll back a single feature if needed

## Recommended default

If you are not sure what to do, use this rule:

Start from `main`, open a new branch for the task, finish the task there, merge into `main`, then delete the branch.
