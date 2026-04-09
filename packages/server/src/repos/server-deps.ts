import type { RouterDeps } from '../trpc/router';
import { getSupabaseAdminClient } from '../lib/supabase-admin';
import { InMemoryActivityRepo } from './activity-repo.memory';
import { InMemoryConversationRepo } from './conversation-repo.memory';
import { InMemoryCrossTrainingRepo } from './cross-training-repo.memory';
import { InMemoryPlanRepo } from './plan-repo.memory';
import { InMemoryProfileRepo } from './profile-repo.memory';
import { SupabaseActivityRepo } from './activity-repo.supabase';
import { SupabaseConversationRepo } from './conversation-repo.supabase';
import { SupabaseCrossTrainingRepo } from './cross-training-repo.supabase';
import { SupabasePlanRepo } from './plan-repo.supabase';
import { SupabaseProfileRepo } from './profile-repo.supabase';

function hasSupabaseConfig(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

export function createServerDeps(): RouterDeps {
  if (!hasSupabaseConfig()) {
    return {
      profileRepo: new InMemoryProfileRepo(),
      planRepo: new InMemoryPlanRepo(),
      activityRepo: new InMemoryActivityRepo(),
      conversationRepo: new InMemoryConversationRepo(),
      crossTrainingRepo: new InMemoryCrossTrainingRepo(),
    };
  }

  const supabase = getSupabaseAdminClient();
  return {
    profileRepo: new SupabaseProfileRepo(supabase),
    planRepo: new SupabasePlanRepo(supabase),
    activityRepo: new SupabaseActivityRepo(supabase),
    conversationRepo: new SupabaseConversationRepo(supabase),
    crossTrainingRepo: new SupabaseCrossTrainingRepo(supabase),
  };
}
