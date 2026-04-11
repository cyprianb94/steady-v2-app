import type { RouterDeps } from '../trpc/router';
import { createStravaClient, type StravaClient } from '../lib/strava-client';
import { getSupabaseAdminClient } from '../lib/supabase-admin';
import { InMemoryActivityRepo } from './activity-repo.memory';
import { InMemoryConversationRepo } from './conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from './cross-training-repo.memory';
import type { IntegrationTokenRepo } from './integration-token-repo';
import { InMemoryIntegrationTokenRepo } from './integration-token-repo.memory';
import { InMemoryNiggleRepo } from './niggle-repo.memory';
import { InMemoryPlanRepo } from './plan-repo.memory';
import { InMemoryProfileRepo } from './profile-repo.memory';
import { InMemoryShoeRepo } from './shoe-repo.memory';
import { SupabaseActivityRepo } from './activity-repo.supabase';
import { SupabaseConversationRepo } from './conversation-repo.supabase';
import { SupabaseCrossTrainingRepo } from './cross-training-repo.supabase';
import { SupabaseIntegrationTokenRepo } from './integration-token-repo.supabase';
import { SupabaseNiggleRepo } from './niggle-repo.supabase';
import { SupabasePlanRepo } from './plan-repo.supabase';
import { SupabaseProfileRepo } from './profile-repo.supabase';
import { SupabaseShoeRepo } from './shoe-repo.supabase';

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

export interface ServerDeps extends RouterDeps {
  integrationTokenRepo: IntegrationTokenRepo;
  stravaClient?: StravaClient;
  encryptionKey?: string;
}

export function createServerDeps(): ServerDeps {
  if (!hasSupabaseConfig()) {
    const activityRepo = new InMemoryActivityRepo();
    return {
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo,
      shoeRepo: new InMemoryShoeRepo(activityRepo),
      niggleRepo: new InMemoryNiggleRepo(activityRepo),
      integrationTokenRepo: new InMemoryIntegrationTokenRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
      stravaClient: undefined,
      encryptionKey: process.env.ENCRYPTION_KEY,
    };
  }

  const supabase = getSupabaseAdminClient();
  return {
    profileRepo: new SupabaseProfileRepo(supabase),
    planRepo: new SupabasePlanRepo(supabase),
    activityRepo: new SupabaseActivityRepo(supabase),
    shoeRepo: new SupabaseShoeRepo(supabase),
    niggleRepo: new SupabaseNiggleRepo(supabase),
    integrationTokenRepo: new SupabaseIntegrationTokenRepo(supabase),
    conversationRepo: new SupabaseConversationRepo(supabase),
    crossTrainingRepo: new SupabaseCrossTrainingRepo(supabase),
    stravaClient: process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET
      ? createStravaClient()
      : undefined,
    encryptionKey: process.env.ENCRYPTION_KEY,
  };
}
