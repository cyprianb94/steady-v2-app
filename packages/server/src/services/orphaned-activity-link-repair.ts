import type { Activity, PlanWeek, PlannedSession, TrainingPlan } from '@steady/types';
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
  activitiesById: ReadonlyMap<string, Activity>,
): { weeks: PlanWeek[]; repaired: boolean } {
  let repaired = false;

  const weeks = plan.weeks.map((week) => {
    let weekRepaired = false;

    const sessions = week.sessions.map((session) => {
      if (!session?.actualActivityId) {
        return session;
      }

      const activity = activitiesById.get(session.actualActivityId);
      if (activity && daysBetweenIsoDates(activityUtcDate(activity), session.date) <= 1) {
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

function daysBetweenIsoDates(left: string, right: string): number {
  const leftTime = new Date(`${left}T00:00:00.000Z`).getTime();
  const rightTime = new Date(`${right}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(Math.round((leftTime - rightTime) / (24 * 60 * 60 * 1000)));
}

function activityUtcDate(activity: Activity): string {
  const value = new Date(activity.startTime);
  if (Number.isNaN(value.getTime())) {
    return activity.startTime.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function planSessionsById(plan: TrainingPlan): Map<string, PlannedSession> {
  return new Map(
    plan.weeks.flatMap((week) => (
      week.sessions.flatMap((session) => (session ? [[session.id, session] as const] : []))
    )),
  );
}

function hasPlausibleMatchedSessionLink(
  activity: Activity,
  sessionsById: ReadonlyMap<string, PlannedSession>,
): boolean {
  if (!activity.matchedSessionId) {
    return true;
  }

  const session = sessionsById.get(activity.matchedSessionId);
  if (!session) {
    return false;
  }

  return daysBetweenIsoDates(activityUtcDate(activity), session.date) <= 1;
}

async function clearOrphanedMatchedSessionLinks(
  activityRepo: ActivityRepo,
  activities: readonly Activity[],
  plan: TrainingPlan,
  strict: boolean,
): Promise<void> {
  const sessionsById = planSessionsById(plan);
  const orphanedActivities = activities.filter((activity) => (
    !hasPlausibleMatchedSessionLink(activity, sessionsById)
  ));

  for (const activity of orphanedActivities) {
    const updated = await activityRepo.updateMatchedSession(activity.id, null);
    if (!updated && strict) {
      throw new Error('Failed to persist orphaned matched-session repair');
    }
  }
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
  const activitiesById = new Map(activities.map((activity) => [activity.id, activity] as const));
  await clearOrphanedMatchedSessionLinks(deps.activityRepo, activities, plan, options.strict ?? false);
  const { weeks, repaired } = clearOrphanedActivityLinks(plan, activitiesById);

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
