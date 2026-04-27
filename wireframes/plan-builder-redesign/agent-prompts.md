# Plan Builder Redesign Agent Prompts

Use these prompts to run three implementation agents in parallel. The projects are parallelisable, but they are not fully independent: Agent A owns the shared review contract and UI. Agents B and C must not duplicate Overview / Phases / Weeks UI.

## Agent A: Shared Block Review Components

You are Agent A working in `/Users/cyprianbrytan/Projects/steady-v2-app`.

Create a fresh branch from `main` named `shared-block-review-components`. Keep changes scoped to this track. You are not alone in the codebase: other agents may be editing plan-builder onboarding and the live Block tab in parallel. Do not revert or overwrite changes you did not make.

Linear ownership:
- Project: Shared Block Review Components
- Issues: STV2-139, STV2-140, STV2-141, STV2-142, STV2-143, STV2-144, STV2-145
- Implementation doc: https://linear.app/cypriansprojects/document/implementation-plan-shared-block-review-components-56aca24f404f

Local visual references:
- `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/plan-builder-redesign/mockup.html`
- `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/plan-builder-redesign/mockup.png`

Your job:
1. Define a reusable `BlockReviewModel` and derivation helpers that can be used by both Plan Builder review and the live Block tab.
2. Build the shared review components: tab control, overload card, Overview view, Phases view, Weeks view, chart/volume curve, phase strip, week rows.
3. Keep the public component API small and deep. Presentational components should accept model data and callbacks; they should not own navigation or plan generation.
4. Implement Apple-quality but Steady-appropriate motion: functional, calm, interruptible, reduced-motion safe. No decorative bounce, glow, or busy effects.
5. Add focused tests/fixtures for model derivation, phase grouping, week rows, overload updates, and reduced-motion-friendly behaviour where feasible.

Design constraints:
- Preserve Steady's design system: parchment background, Playfair titles, Space Mono numbers, DM Sans UI, semantic session/phase colours.
- Do not use white or black app surfaces.
- Use colour only semantically: clay/intervalling/CTA, forest/easy/completed, navy/long/base, amber/tempo/peak, purple/recovery, slate/rest.
- Keep density mobile-native and editorial. Avoid generic SaaS card stacks.
- Tabs: about 42-44px high, 4px active inset, rounded active pill, spring-like active indicator.
- Cards: 12-24px radius depending on context, 1.5px warm border, tight internal spacing.

Important product context:
- The Plan Builder review currently feels like a long generated list. We want summary first, optional detail second.
- The tabs are `Overview`, `Phases`, `Weeks`.
- The overload percentage is staying for now. Do not redesign the overload decision away.
- The same components should be reused later in the live Block tab so changing one improves the other.

Boundaries:
- You own shared model/components and their tests.
- Avoid editing the new onboarding step flow unless you need a minimal integration point. Agent B owns onboarding screens.
- Avoid live Block-specific behaviour beyond optional model fields. Agent C owns live Block integration.

Before finishing:
- Run the relevant tests/typecheck/lint commands you discover in the repo.
- Leave Linear warm traces on the issues you touch: what changed, tests run, remaining risks.
- Final response must list changed file paths, tests run, and any integration notes for Agents B/C.

## Agent B: TestFlight Plan Builder Redesign

You are Agent B working in `/Users/cyprianbrytan/Projects/steady-v2-app`.

Create a fresh branch from `main` named `testflight-plan-builder-redesign`. Keep changes scoped to Plan Builder onboarding and plan-template generation. You are not alone in the codebase: another agent owns shared block-review UI, and another owns the live Block tab. Do not revert or overwrite changes you did not make.

Linear ownership:
- Project: TestFlight Plan Builder Redesign
- Issues: STV2-146, STV2-148, STV2-147, STV2-149, STV2-150, STV2-151, STV2-152
- Implementation doc: https://linear.app/cypriansprojects/document/implementation-plan-testflight-plan-builder-redesign-e1917bcf8394

Local visual references:
- `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/plan-builder-redesign/mockup.html`
- `/Users/cyprianbrytan/Projects/steady-v2-app/wireframes/plan-builder-redesign/mockup.png`

Your job:
1. Split the old dense Plan Builder form into focused mobile steps: Race, Date, Target, Base week, Design week, Review block.
2. Build Race/Date/Target screens without the confusing blue summary pills.
3. Add Ultra distance input when `Ultra` is selected. Ultra is not a fixed race distance.
4. Build `Build your base week` with two obvious choices: `Build from template` and `Clean slate`.
5. Keep the run-count selector inside the template card only. It does not apply to clean slate.
6. Remove weekly kilometre estimation from the base-week choice screen.
7. Add template generation for 1, 2, 3, 4, 5, 6, and 7 runs per week, plus clean slate.
8. Preserve the Design your week editor concept, but make rows compact enough for seven-day running weeks. Move type into the primary line where possible, e.g. `8km Easy`.
9. Wire Review block to the shared components from Agent A when available. Do not duplicate Overview / Phases / Weeks UI locally.

Product context:
- Do not turn onboarding into another Runna-style questionnaire. Do not ask recent weekly km, runs per week, longest recent run, or preferred long run up front.
- Friction is acceptable only when each screen has one clear decision.
- The user likes the current Design your week step. Treat it as a refinement, not a replacement.
- Phase breakdown should not live on the first goal screen anymore. It belongs in review/phases.
- Overload percentage should stay for now.

Design constraints:
- Preserve Steady's design system: parchment background, Playfair titles, Space Mono numbers, DM Sans UI, semantic session colours.
- Avoid web-form density. One main decision per screen.
- Page margin should follow existing app patterns, not the browser mock literally if native code uses different tokens.
- CTA should stay clear and reachable above safe area.
- Motion should feel native: step transitions, card selection morph, run-count selector glide, Ultra field reveal, week-row reordering. Must respect reduced motion.

Boundaries:
- You own onboarding plan-builder screens, plan-builder state, template starter/generation, and compact week editor changes.
- Do not build shared Overview / Phases / Weeks UI if Agent A has not landed it yet. Create an integration seam/callback and note the blocker instead.
- Do not alter live Block tab behaviour except where existing shared plan-builder code requires it.

Before finishing:
- Run relevant tests/typecheck/lint.
- Manually verify marathon template, Ultra custom distance, clean slate, 1-run template, 7-run template, and back-navigation state preservation.
- Leave Linear warm traces on the issues you touch.
- Final response must list changed file paths, tests run, and any dependency on Agent A.

## Agent C: Block Tab Overview / Phases / Weeks

You are Agent C working in `/Users/cyprianbrytan/Projects/steady-v2-app`.

Create a fresh branch from `main` named `block-tab-review-tabs`. Keep changes scoped to live Block tab reuse. You are not alone in the codebase: Agent A owns shared review components and Agent B owns onboarding. Do not revert or overwrite changes you did not make.

Linear ownership:
- Project: Block Tab Overview Phases Weeks
- Issues: STV2-153, STV2-154, STV2-155, STV2-156, STV2-157
- Implementation doc: https://linear.app/cypriansprojects/document/implementation-plan-block-tab-overview-phases-weeks-593bfa754d5e

Also read the shared component doc because you must consume, not duplicate, shared UI:
- https://linear.app/cypriansprojects/document/implementation-plan-shared-block-review-components-56aca24f404f

Your job:
1. Adapt live Block data into the shared `BlockReviewModel` shape.
2. Add live Block tab shell for `Overview`, `Phases`, and `Weeks` using Agent A's shared components when available.
3. Wire week rows to existing live week detail/reschedule/adapt flows through callbacks. Shared row components should not import navigation directly.
4. Add live-state polish: current week, current phase, completed/planned distinction, loading/empty/error states.
5. Verify that shared components are reused in Block and Plan Builder instead of duplicated.

Product context:
- The Block tab should feel like the live version of what the runner reviewed during onboarding.
- Overview is for confidence and orientation. Phases is for structure. Weeks is for inspection and edit entry.
- This is not an analytics dashboard. Keep it scannable and calm.
- Do not change the training-plan model unless the shared adapter truly requires it.

Design constraints:
- Preserve Steady's design system: parchment background, Playfair titles, Space Mono numbers, DM Sans UI, semantic phase/session colours.
- Current week treatment should be noticeable but restrained: thin accent, small pill, or tonal highlight.
- Completed items should be subdued and readable, not aggressively crossed out.
- Reduced motion must work for tab transitions and row interactions.

Boundaries:
- You own live Block tab integration, live adapter code, week-row callback wiring, and live-state tests.
- Do not implement local copies of Overview / Phases / Weeks UI. If Agent A's components are not available, stop at adapter/tests and leave a clear integration note.
- Do not alter Plan Builder onboarding.

Before finishing:
- Run relevant tests/typecheck/lint.
- Verify live current-week, completed-week, future-week, edited-week, and empty/loading states.
- Leave Linear warm traces on the issues you touch.
- Final response must list changed file paths, tests run, and any dependency on Agent A.
