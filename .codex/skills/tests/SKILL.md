---
name: tests
description: Use when reviewing test quality and distinguishing strong integration-style tests from brittle implementation-coupled tests.
---

# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test

Steady-specific preference: put canonical structured-session and volume behavior in `packages/types/tests` when it is package-level math (`sessionKm`, `weekKmBreakdown`, exact vs estimated distance). Use app tests for the app feature boundary, such as `structured-session-editor-engine`, not for re-proving every React control detail.

For Block review, test source-of-truth volume semantics in `packages/types/tests/block-review.test.ts`, especially stale persisted `PlanWeek.plannedKm` versus session-derived exact/estimated km. Test app-only boundaries in focused files such as `review-volume-chart-model.test.ts`, `block-reschedule-controller.test.ts`, and `live-block-review-model.test.ts`; keep React tests for meaningful rendered behavior and interaction only.

For plan persistence, put orchestration coverage on `packages/server/src/services/plan-workflow-service.ts` and keep `packages/app/lib/plan-api.ts` tests transport-thin. Do not test duplicated app-side Supabase plan writes; real plan load/save/profile/week/skipped-session behavior should be proven through the server workflow and router boundaries. Home skipped-session tests should prove the rendered interaction calls the dedicated intent API and never reintroduces whole-plan `updatePlanWeeks` payloads.

For sync-run detail, put load/draft/save/split-refresh behavior on `packages/app/features/sync/use-run-detail-controller.ts` tests with mocked transport boundaries. Keep `sync-run-detail.test.tsx` for rendered behavior and high-value interactions only, and rely on server activity workflow/router tests for multi-step persistence and rollback.

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface

```typescript
// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```
