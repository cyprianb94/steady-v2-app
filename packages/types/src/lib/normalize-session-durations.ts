import type { TrainingPlan, PlanWeek } from '../plan';
import { normalizeSessionDuration, sessionSupportsWarmupCooldown, type PlannedSession } from '../session';
import { normalizeSessionIntensityTarget } from './intensity-targets';
import { normalizePlannedVolume, normalizeRunStructure } from './structured-session';

export function normalizeSessionDurations(
  session: PlannedSession | null,
): PlannedSession | null {
  if (!session) {
    return null;
  }

  const { warmup, cooldown, plannedVolume, planNote, runStructure, ...rest } = session;
  const normalizedSession: PlannedSession = {
    ...rest,
    repDuration: normalizeSessionDuration(session.repDuration),
    recovery: typeof session.recovery === 'string'
      ? session.recovery
      : normalizeSessionDuration(session.recovery),
  };
  const normalizedPlannedVolume = normalizePlannedVolume(plannedVolume);
  const normalizedPlanNote = typeof planNote === 'string' && planNote.trim().length > 0
    ? planNote.trim()
    : undefined;
  const normalizedRunStructure = normalizeRunStructure(runStructure);

  if (normalizedPlannedVolume) {
    normalizedSession.plannedVolume = normalizedPlannedVolume;
  }
  if (normalizedPlanNote) {
    normalizedSession.planNote = normalizedPlanNote;
  }
  if (normalizedRunStructure && session.type !== 'RECOVERY') {
    normalizedSession.runStructure = normalizedRunStructure;
  }

  if (sessionSupportsWarmupCooldown(session.type)) {
    normalizedSession.warmup = normalizeSessionDuration(warmup);
    normalizedSession.cooldown = normalizeSessionDuration(cooldown);
  }

  return normalizeSessionIntensityTarget(normalizedSession);
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
