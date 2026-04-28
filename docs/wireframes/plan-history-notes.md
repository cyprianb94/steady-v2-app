# Plan History Wireframe Notes

## Scope

Add a Settings entry point for plan history so testers can return to older plans without losing the active plan.

## Proposed screens

1. **Settings entry point**
   - Keep the existing active plan card.
   - Add a `Plan history` row below `Replace plan`.
   - Caption: `View, restore, or delete saved plans.`

2. **Plan history list**
   - Show the current active plan first.
   - Show previous plans as archived cards ordered by most recently archived/created.
   - Each previous plan supports `View` and `Restore`.
   - Helper copy: `Restoring a plan keeps the current plan in history.`

3. **Plan preview**
   - Use the redesigned plan-builder review model from `wireframes/plan-builder-redesign/review-block-tabs.html`.
   - Default to the read-only `Structure` tab for archived plans.
   - Keep the same two-tab shape: `Structure` and `Weeks`.
   - `Structure` shows the weekly volume curve, progression choice state, and phase structure summary.
   - `Weeks` should reuse the Block-style week list from the redesign, but view-only.
   - Do not show phase edit links, session edit affordances, propagation controls, or day drag handles while a plan is inactive.
   - Primary action: `Restore this plan`.
   - Destructive action: `Delete from history`.

4. **Restore confirmation**
   - Bottom sheet, not an alert, because the state transition needs explanation.
   - Copy should explicitly state that the current plan is preserved.
   - Primary action: `Restore plan`.

## Product rules

- There is only one active plan.
- Replacing a plan or restoring a previous plan should preserve the displaced current plan.
- Deleting is only available for inactive historical plans.
- The active plan cannot be deleted from plan history.
- Restore should refresh Home and Block to the restored plan immediately.
- Viewing an inactive plan should not change activity matching, current-week state, or the active plan cache.
- Activity matching and future retrospective analysis can remain out of scope for the first implementation, but the issue should note that historical analysis will eventually need a plan/activity relationship.

## Open decisions for implementation

- Whether `Replace plan` should create a new plan row every time, or update the current row until the final save.
- Whether history ordering should use `createdAt`, `updatedAt`, or a new `archivedAt`.
- Whether restored plans keep their original `createdAt` or receive a new `restoredAt`.
- Whether deleting a historical plan should hard-delete immediately or soft-delete for recovery.
