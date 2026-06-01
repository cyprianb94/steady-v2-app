import { router } from './trpc';
import { createActivityRouter } from './activity';
import { createAppleHealthRouter } from './apple-health';
import { createPlanRouter } from './plan';
import { createCoachRouter } from './coach';
import { createCrossTrainingRouter } from './cross-training';
import { createProfileRouter } from './profile';
import { createShoeRouter } from './shoe';
import { createStravaRouter } from './strava';
import type { StravaClient } from '../lib/strava-client';
import type { ActivityRepo } from '../repos/activity-repo';
import type { ActivityProvenanceRepo } from '../repos/activity-provenance-repo';
import type { ActivitySyncLogRepo } from '../repos/activity-sync-log-repo';
import type { ConversationRepo } from '../repos/conversation-repo';
import type { CrossTrainingRepo } from '../repos/cross-training-repo';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { NiggleRepo } from '../repos/niggle-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import type { ShoeRepo } from '../repos/shoe-repo';
import { InMemoryActivityRepo } from '../repos/activity-repo.memory';
import { InMemoryActivityProvenanceRepo } from '../repos/activity-provenance-repo.memory';
import { InMemoryActivitySyncLogRepo } from '../repos/activity-sync-log-repo.memory';
import { InMemoryConversationRepo } from '../repos/conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from '../repos/cross-training-repo.memory';
import { InMemoryNiggleRepo } from '../repos/niggle-repo.memory';
import { InMemoryPlanRepo } from '../repos/plan-repo.memory';
import { InMemoryProfileRepo } from '../repos/profile-repo.memory';
import { InMemoryShoeRepo } from '../repos/shoe-repo.memory';
import { createActivityWorkflowService } from '../services/activity-workflow-service';
import { createActivityIngestionService } from '../services/activity-ingestion-service';
import { createPlanWorkflowService } from '../services/plan-workflow-service';
import { createStravaWorkflowService } from '../services/strava-workflow-service';

export interface RouterDeps {
  profileRepo: ProfileRepo;
  planRepo: PlanRepo;
  activityRepo: ActivityRepo;
  activityProvenanceRepo?: ActivityProvenanceRepo;
  activitySyncLogRepo?: ActivitySyncLogRepo;
  shoeRepo?: ShoeRepo;
  niggleRepo?: NiggleRepo;
  conversationRepo: ConversationRepo;
  crossTrainingRepo: CrossTrainingRepo;
  integrationTokenRepo?: IntegrationTokenRepo;
  stravaClient?: StravaClient;
  encryptionKey?: string;
}

export function createAppRouter(deps: RouterDeps) {
  const shoeRepo = deps.shoeRepo ?? new InMemoryShoeRepo(deps.activityRepo);
  const niggleRepo = deps.niggleRepo ?? new InMemoryNiggleRepo(deps.activityRepo);
  const activityProvenanceRepo = deps.activityProvenanceRepo ?? new InMemoryActivityProvenanceRepo();
  const activitySyncLogRepo = deps.activitySyncLogRepo ?? new InMemoryActivitySyncLogRepo();
  const activityWorkflow = createActivityWorkflowService({
    activityRepo: deps.activityRepo,
    planRepo: deps.planRepo,
    niggleRepo,
    shoeRepo,
  });
  const activityIngestion = createActivityIngestionService({
    profileRepo: deps.profileRepo,
    activityRepo: deps.activityRepo,
    planRepo: deps.planRepo,
    provenanceRepo: activityProvenanceRepo,
    syncLogRepo: activitySyncLogRepo,
  });
  const planWorkflow = createPlanWorkflowService({
    profileRepo: deps.profileRepo,
    planRepo: deps.planRepo,
    activityRepo: deps.activityRepo,
  });
  const stravaWorkflow = createStravaWorkflowService({
    profileRepo: deps.profileRepo,
    planRepo: deps.planRepo,
    activityRepo: deps.activityRepo,
    shoeRepo,
    integrationTokenRepo: deps.integrationTokenRepo,
    stravaClient: deps.stravaClient,
    encryptionKey: deps.encryptionKey,
  });
  return router({
    profile: createProfileRouter(deps.profileRepo),
    activity: createActivityRouter(activityWorkflow),
    appleHealth: createAppleHealthRouter(deps.profileRepo, activityIngestion, activitySyncLogRepo),
    shoe: createShoeRouter(shoeRepo),
    plan: createPlanRouter(planWorkflow),
    coach: createCoachRouter(deps),
    crossTraining: createCrossTrainingRouter(deps.crossTrainingRepo, deps.planRepo),
    strava: createStravaRouter(stravaWorkflow),
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
