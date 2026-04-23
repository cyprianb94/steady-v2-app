import type { PlanWeek, TrainingPlan } from '@steady/types';
import type { ActivityRepo } from '../repos/activity-repo';
import type { PlanRepo } from '../repos/plan-repo';

interface RepairOrphanedActivityLinksDeps {
  activityRepo: ActivityRepo;
  planRepo: PlanRepo;
}

interface RepairOrphanedActivityLinksOptions {
  plan?: TrainingPlan | null;
  strict?: boolean;
}

function clearOrphanedActivityLinks(
  plan: TrainingPlan,
  validActivityIds: ReadonlySet<string>,
): { weeks: PlanWeek[]; repaired: boolean } {
  let repaired = false;

  const weeks = plan.weeks.map((week) => {
    let weekRepaired = false;

    const sessions = week.sessions.map((session) => {
      if (!session?.actualActivityId || validActivityIds.has(session.actualActivityId)) {
        return session;
      }

      repaired = true;
      weekRepaired = true;
      return {
        ...session,
        actualActivityId: undefined,
      };
    });

    if (!weekRepaired) {
      return week;
    }

    return {
      ...week,
      sessions,
    };
  });

  return { weeks, repaired };
}

export async function repairOrphanedActivityLinks(
  userId: string,
  deps: RepairOrphanedActivityLinksDeps,
  options: RepairOrphanedActivityLinksOptions = {},
): Promise<TrainingPlan | null> {
  const plan = options.plan === undefined ? await deps.planRepo.getActive(userId) : options.plan;
  if (!plan) {
    return null;
  }

  const activities = await deps.activityRepo.getByUserId(userId);
  const validActivityIds = new Set(activities.map((activity) => activity.id));
  const { weeks, repaired } = clearOrphanedActivityLinks(plan, validActivityIds);

  if (!repaired) {
    return plan;
  }

  const repairedPlan = {
    ...plan,
    weeks,
  };
  const persistedPlan = await deps.planRepo.updateWeeks(plan.id, weeks);

  if (persistedPlan) {
    return persistedPlan;
  }

  if (options.strict) {
    throw new Error('Failed to persist orphaned activity-link repair');
  }

  return repairedPlan;
}
