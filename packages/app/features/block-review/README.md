# Live Block Review Integration Note

`live-block-review-model.ts` now adapts a persisted `TrainingPlan` to the shared
`@steady/types` `BlockReviewModel`. It deliberately does not keep a Block-local
review model shape.

TODO for the live Block tab shell:

1. Pass `deriveLiveBlockReviewState(...).model` into `BlockReviewSurface`.
2. Forward shared week-row presses to the live controller in `packages/app/features/block/use-block-tab-controller.ts`.
3. Keep expanded week details, planned-vs-actual status, injury history, and direct reschedule behaviour in the existing live Block flow until those concerns have shared model fields. Do not move that orchestration back into `packages/app/app/(tabs)/block.tsx`; extend `packages/app/features/block/block-tab-model.ts` or the live controller instead.
