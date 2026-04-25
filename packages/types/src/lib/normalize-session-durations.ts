import type { TrainingPlan, PlanWeek } from '../plan';
import { normalizeSessionDuration, sessionSupportsWarmupCooldown, type PlannedSession } from '../session';

export function normalizeSessionDurations(
  session: PlannedSession | null,
): PlannedSession | null {
  if (!session) {
    return null;
  }

  const { warmup, cooldown, ...rest } = session;
  const normalizedSession: PlannedSession = {
    ...rest,
    repDuration: normalizeSessionDuration(session.repDuration),
    recovery: typeof session.recovery === 'string'
      ? session.recovery
      : normalizeSessionDuration(session.recovery),
  };

  if (sessionSupportsWarmupCooldown(session.type)) {
    normalizedSession.warmup = normalizeSessionDuration(warmup);
    normalizedSession.cooldown = normalizeSessionDuration(cooldown);
  }

  return normalizedSession;
}

export function normalizePlanWeekSessionDurations(week: PlanWeek): PlanWeek {
  return {
    ...week,
    sessions: week.sessions.map(normalizeSessionDurations),
  };
}

export function normalizeTrainingPlanSessionDurations(plan: TrainingPlan): TrainingPlan {
  return {
    ...plan,
    templateWeek: plan.templateWeek.map(normalizeSessionDurations),
    weeks: plan.weeks.map(normalizePlanWeekSessionDurations),
  };
}
