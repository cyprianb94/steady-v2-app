import { router } from './trpc';
import { createPlanRouter } from './plan';
import { createCoachRouter } from './coach';
import type { PlanRepo } from '../repos/plan-repo';

export interface RouterDeps {
  planRepo: PlanRepo;
}

export function createAppRouter(deps: RouterDeps) {
  return router({
    plan: createPlanRouter(deps.planRepo),
    coach: createCoachRouter(deps.planRepo),
  });
}

// Type is derived from a dummy call — deps don't affect the type shape
import { InMemoryPlanRepo } from '../repos/plan-repo.memory';
const _dummyRouter = createAppRouter({ planRepo: new InMemoryPlanRepo() });
export type AppRouter = typeof _dummyRouter;
