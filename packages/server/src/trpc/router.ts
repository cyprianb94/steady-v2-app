import { router } from './trpc';
import { createActivityRouter } from './activity';
import { createPlanRouter } from './plan';
import { createCoachRouter } from './coach';
import { createCrossTrainingRouter } from './cross-training';
import { createShoeRouter } from './shoe';
import { createStravaRouter } from './strava';
import type { StravaClient } from '../lib/strava-client';
import type { ActivityRepo } from '../repos/activity-repo';
import type { ConversationRepo } from '../repos/conversation-repo';
import type { CrossTrainingRepo } from '../repos/cross-training-repo';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import type { ShoeRepo } from '../repos/shoe-repo';
import { InMemoryActivityRepo } from '../repos/activity-repo.memory';
import { InMemoryConversationRepo } from '../repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../repos/cross-training-repo.memory';
import { InMemoryPlanRepo } from '../repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../repos/shoe-repo.memory';

export interface RouterDeps {
  profileRepo: ProfileRepo;
  planRepo: PlanRepo;
  activityRepo: ActivityRepo;
  shoeRepo?: ShoeRepo;
  conversationRepo: ConversationRepo;
  crossTrainingRepo: CrossTrainingRepo;
  integrationTokenRepo?: IntegrationTokenRepo;
  stravaClient?: StravaClient;
  encryptionKey?: string;
}

export function createAppRouter(deps: RouterDeps) {
  const shoeRepo = deps.shoeRepo ?? new InMemoryShoeRepo(deps.activityRepo);
  return router({
    activity: createActivityRouter(deps.activityRepo, deps.planRepo),
    shoe: createShoeRouter(shoeRepo),
    plan: createPlanRouter(deps.planRepo),
    coach: createCoachRouter(deps),
    crossTraining: createCrossTrainingRouter(deps.crossTrainingRepo, deps.planRepo),
    strava: createStravaRouter({ ...deps, shoeRepo }),
  });
}

// Type is derived from a dummy call — deps don't affect the type shape
const _dummyRouter = createAppRouter({
  profileRepo: new InMemoryProfileRepo(),
  planRepo: new InMemoryPlanRepo(),
  activityRepo: new InMemoryActivityRepo(),
  conversationRepo: new InMemoryConversationRepo(),
  crossTrainingRepo: new InMemoryCrossTrainingRepo(),
});
export type AppRouter = typeof _dummyRouter;
