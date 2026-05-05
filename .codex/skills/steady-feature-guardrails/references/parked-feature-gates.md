# Parked Feature Gates

Use this reference when touching recovery, Coach, Steady AI, screenshot demo, Settings entries, Home nudges, or tab navigation.

## Runtime gates

- App-side parked gates live in `packages/app/features/parked-feature-gates.ts`.
- Shared Steady AI freeze constants live in `packages/types/src/ai-freeze.ts`.
- Recovery visibility is still consumed through `packages/app/features/recovery/recovery-ui-gate.ts`.
- Screenshot demo mode is the only allowed runtime path for parked recovery UI.

## Current parked state

- Normal app mode must not expose the Coach tab, Steady AI Settings entries, Home AI nudges, chat inputs, AI CTAs, LLM calls, or deterministic `coachAnnotation` cards.
- The hidden `/coach` route may render only a paused Steady AI state while the freeze is active.
- Human coach Settings entries are also parked until a real coach collaboration slice is deliberately enabled.
- Recovery UI is parked in normal app mode. It may render in explicit screenshot demo mode only.

## Re-enable checklist

Do not lift any one switch in isolation. A deliberate re-enable needs:

- product approval in the task prompt
- a named app gate change in `parked-feature-gates.ts`
- rendered tests for Home, Settings, tabs, and the relevant routed screen
- server/API freeze updates if Steady AI calls are involved
- screenshot demo tests proving demo-only fixtures do not leak into normal mode
- product/skill documentation updates that distinguish human coach from Steady AI
