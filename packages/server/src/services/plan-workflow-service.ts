import {
  generatePlan,
  getDisplayWeekIndex,
  assignWeekSessionDates,
  inferWeekStartDate,
  normalizePlanWeekSessionDurations,
  normalizeSessionDurations,
  normalizeSessionIds,
  normalizeTrainingPaceProfile,
  propagateChange,
  propagateSwap,
  propagateTrainingPaceProfileUpdate,
  swapSessions,
  weekKm,
} from '@steady/types';
import type {
  Activity,
  InjuryUpdate,
  PhaseConfig,
  PhaseName,
  PlannedSession,
  PlanWeek,
  PropagateScope,
  SkippedSessionReason,
  SwapLogEntry,
  TrainingPaceProfile,
  TrainingPlan,
  TrainingPlanWithAnnotation,
} from '@steady/types';
import { generateHomeAnnotations } from '../lib/annotation-engine';
import { currentIsoDateInTimezone, isoDateInTimezone } from '../lib/iso-date';
import type { ActivityRepo } from '../repos/activity-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { repairOrphanedActivityLinks } from './orphaned-activity-link-repair';

export interface SavePlanWorkflowInput {
  raceName: string;
  raceDate: string;
  raceDistance: TrainingPlan['raceDistance'];
  targetTime: string;
  phases: PhaseConfig;
  progressionPct: number;
  progressionEveryWeeks?: number;
  trainingPaceProfile?: TrainingPaceProfile | null;
  templateWeek: (PlannedSession | null)[];
  weeks: PlanWeek[];
}

export interface PropagatePlanChangeInput {
  weekIndex: number;
  dayIndex: number;
  updated: PlannedSession | null;
  scope: PropagateScope;
  targetPhase?: PhaseName;
}

export interface ApplyBlockRescheduleInput {
  weekIndex: number;
  swapLog: SwapLogEntry[];
  scope: PropagateScope;
  targetPhase?: PhaseName;
  targetSessions?: (PlannedSession | null)[];
}

export interface MarkSessionSkippedInput {
  sessionId: string;
  reason: SkippedSessionReason;
}

export interface ClearSessionSkippedInput {
  sessionId: string;
}

export type PlanWorkflowErrorCode = 'BAD_REQUEST' | 'NOT_FOUND';

export class PlanWorkflowError extends Error {
  constructor(
    public readonly code: PlanWorkflowErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PlanWorkflowError';
  }
}

interface PlanWorkflowDeps {
  planRepo: PlanRepo;
  profileRepo: ProfileRepo;
  activityRepo: ActivityRepo;
  todayForTimezone?: (timezone: string) => string;
  createId?: () => string;
  now?: () => string;
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayIndexForDate(date: string): number {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function findSessionForDateOrWeekday(
  sessions: (PlannedSession | null)[],
  date: string,
): PlannedSession | null {
  return sessions[dayIndexForDate(date)] ?? null;
}

function withHomeAnnotations(
  plan: TrainingPlan | null,
  today: string,
): TrainingPlanWithAnnotation | null {
  if (!plan) return null;

  const currentWeek = plan.weeks[getDisplayWeekIndex(plan.weeks, today)];

  if (!currentWeek) {
    return {
      ...plan,
      todayAnnotation: 'Your plan is ready — build consistency one week at a time.',
      coachAnnotation: null,
    };
  }

  const tomorrow = addDays(today, 1);
  const todaySession = findSessionForDateOrWeekday(currentWeek.sessions, today);
  const tomorrowSession = findSessionForDateOrWeekday(currentWeek.sessions, tomorrow);
  const annotations = generateHomeAnnotations({
    todaySession,
    tomorrowSession,
    phase: currentWeek.phase,
    weekNumber: currentWeek.weekNumber,
    totalWeeks: plan.weeks.length,
    allSessions: currentWeek.sessions,
  });

  return {
    ...plan,
    ...annotations,
  };
}

function validateWeeks(weeks: PlanWeek[]) {
  for (const week of weeks) {
    if (!week.sessions || week.sessions.length !== 7) {
      throw new PlanWorkflowError(
        'BAD_REQUEST',
        `Week ${week.weekNumber} must have exactly 7 session slots`,
      );
    }
  }
}

function validatePlanSlot(plan: TrainingPlan, weekIndex: number, dayIndex: number) {
  if (!Number.isInteger(weekIndex) || weekIndex < 0 || weekIndex >= plan.weeks.length) {
    throw new PlanWorkflowError('BAD_REQUEST', 'Week index is outside the active plan');
  }

  if (!Number.isInteger(dayIndex) || dayIndex < 0 || dayIndex > 6) {
    throw new PlanWorkflowError('BAD_REQUEST', 'Day index must be between 0 and 6');
  }
}

function validateSwapLog(plan: TrainingPlan, input: ApplyBlockRescheduleInput) {
  if (!Number.isInteger(input.weekIndex) || input.weekIndex < 0 || input.weekIndex >= plan.weeks.length) {
    throw new PlanWorkflowError('BAD_REQUEST', 'Week index is outside the active plan');
  }

  if (input.targetSessions && input.targetSessions.length !== 7) {
    throw new PlanWorkflowError('BAD_REQUEST', 'Target sessions must include exactly 7 day slots');
  }

  for (const swap of input.swapLog) {
    if (
      !Number.isInteger(swap.from)
      || !Number.isInteger(swap.to)
      || swap.from < 0
      || swap.from > 6
      || swap.to < 0
      || swap.to > 6
    ) {
      throw new PlanWorkflowError('BAD_REQUEST', 'Swap log entries must use day indexes between 0 and 6');
    }
  }
}

function validateSaveInput(input: SavePlanWorkflowInput) {
  const phaseSum = input.phases.BASE
    + input.phases.BUILD
    + input.phases.RECOVERY
    + input.phases.PEAK
    + input.phases.TAPER;

  if (input.weeks.length > 0 && phaseSum !== input.weeks.length) {
    throw new PlanWorkflowError(
      'BAD_REQUEST',
      `Phase sum (${phaseSum}) does not match week count (${input.weeks.length})`,
    );
  }

  validateWeeks(input.weeks);
}

function normalizeTemplateWeek(templateWeek: (PlannedSession | null)[]): (PlannedSession | null)[] {
  return templateWeek.map(normalizeSessionDurations);
}

function normalizeWeeks(weeks: PlanWeek[]): PlanWeek[] {
  return normalizeSessionIds(weeks.map(normalizePlanWeekSessionDurations));
}

function updateSessionById(
  weeks: PlanWeek[],
  sessionId: string,
  update: (session: PlannedSession) => PlannedSession,
): { weeks: PlanWeek[]; found: boolean; changed: boolean } {
  let found = false;
  let changed = false;

  const nextWeeks = weeks.map((week) => {
    let weekChanged = false;
    const sessions = week.sessions.map((session) => {
      if (!session || session.id !== sessionId) {
        return session;
      }

      found = true;
      const nextSession = update(session);
      if (nextSession !== session) {
        changed = true;
        weekChanged = true;
      }
      return nextSession;
    });

    return weekChanged ? { ...week, sessions } : week;
  });

  return {
    weeks: nextWeeks,
    found,
    changed,
  };
}

function matchedActivitiesBySessionId(activities: Activity[]): Map<string, Activity> {
  return new Map(
    activities
      .filter((activity): activity is Activity & { matchedSessionId: string } => Boolean(activity.matchedSessionId))
      .map((activity) => [activity.matchedSessionId, activity]),
  );
}

interface CompletedSessionContext {
  matchedActivitiesBySessionId: Map<string, Activity>;
  activityIds: Set<string>;
  today: string;
  timezone: string;
}

function shouldPreserveCompletedOrMatchedSession({
  matchedActivitiesBySessionId: matchedActivities,
  activityIds,
  today,
  timezone,
}: CompletedSessionContext): (session: PlannedSession) => boolean {
  return (session) => {
    const matchedActivity = matchedActivities.get(session.id);
    if (matchedActivity && isoDateInTimezone(matchedActivity.startTime, timezone) === session.date) {
      return true;
    }

    if (!session.actualActivityId) {
      return false;
    }

    return activityIds.has(session.actualActivityId) || session.date <= today;
  };
}

function completedSessionContext(
  activities: Activity[],
  today: string,
  timezone: string,
): CompletedSessionContext {
  return {
    matchedActivitiesBySessionId: matchedActivitiesBySessionId(activities),
    activityIds: new Set(activities.map((activity) => activity.id)),
    today,
    timezone,
  };
}

function shouldApplyRescheduleToWeek(
  index: number,
  week: PlanWeek,
  weekIndex: number,
  scope: PropagateScope,
  targetPhase: PhaseName,
): boolean {
  if (scope === 'this') return index === weekIndex;
  if (scope === 'remaining') return index >= weekIndex;
  return week.phase === targetPhase;
}

function hasPreservedSwapPosition(
  sessions: readonly (PlannedSession | null)[],
  weekIndex: number,
  swap: SwapLogEntry,
  shouldPreserveSession: (session: PlannedSession, weekIndex: number, dayIndex: number) => boolean,
): boolean {
  const fromSession = sessions[swap.from] ?? null;
  const toSession = sessions[swap.to] ?? null;

  return (
    Boolean(fromSession && shouldPreserveSession(fromSession, weekIndex, swap.from))
    || Boolean(toSession && shouldPreserveSession(toSession, weekIndex, swap.to))
  );
}

function isRestSession(session: PlannedSession | null): boolean {
  return !session || session.type === 'REST';
}

function matchesRescheduleRole(
  session: PlannedSession | null,
  target: PlannedSession | null,
): boolean {
  if (isRestSession(session) || isRestSession(target)) {
    return isRestSession(session) && isRestSession(target);
  }

  return session?.type === target?.type;
}

function matchesTargetReschedulePattern(
  week: PlanWeek,
  targetSessions: readonly (PlannedSession | null)[],
  swapLog: readonly SwapLogEntry[],
): boolean {
  return swapLog.every((swap) => (
    matchesRescheduleRole(week.sessions[swap.from] ?? null, targetSessions[swap.from] ?? null)
    && matchesRescheduleRole(week.sessions[swap.to] ?? null, targetSessions[swap.to] ?? null)
  ));
}

function appendSwapLog(
  week: PlanWeek,
  swapLog: readonly SwapLogEntry[],
): SwapLogEntry[] | undefined {
  const nextSwapLog = [...(week.swapLog ?? []), ...swapLog];
  return nextSwapLog.length > 0 ? nextSwapLog : week.swapLog;
}

function replaceWeekWithTargetSessions(
  week: PlanWeek,
  targetSessions: readonly (PlannedSession | null)[],
  swapLog: readonly SwapLogEntry[],
): PlanWeek {
  const sessions = assignWeekSessionDates(
    targetSessions.map((session) => (session ? { ...session } : null)),
    inferWeekStartDate(week),
  );

  return {
    ...week,
    sessions,
    plannedKm: Math.round(weekKm(sessions)),
    swapLog: appendSwapLog(week, swapLog),
  };
}

function applySwapLogToWeek(
  week: PlanWeek,
  weekIndex: number,
  swapLog: readonly SwapLogEntry[],
  shouldPreserveSession: (session: PlannedSession, weekIndex: number, dayIndex: number) => boolean,
  targetSessions?: readonly (PlannedSession | null)[],
): PlanWeek {
  let sessions = week.sessions;
  const appliedSwaps: SwapLogEntry[] = [];

  for (const swap of swapLog) {
    if (
      targetSessions
      && matchesRescheduleRole(sessions[swap.from] ?? null, targetSessions[swap.from] ?? null)
      && matchesRescheduleRole(sessions[swap.to] ?? null, targetSessions[swap.to] ?? null)
    ) {
      continue;
    }

    if (hasPreservedSwapPosition(sessions, weekIndex, swap, shouldPreserveSession)) {
      continue;
    }

    const nextSessions = swapSessions(sessions, swap.from, swap.to);
    if (nextSessions !== sessions) {
      sessions = nextSessions;
      appliedSwaps.push(swap);
    }
  }

  if (appliedSwaps.length === 0) {
    return week;
  }

  const datedSessions = assignWeekSessionDates(sessions, inferWeekStartDate(week));
  return {
    ...week,
    sessions: datedSessions,
    plannedKm: Math.round(weekKm(datedSessions)),
    swapLog: appendSwapLog(week, appliedSwaps),
  };
}

function applyTargetedBlockReschedule({
  weeks,
  input,
  sourcePhase,
  shouldPreserveSession,
}: {
  weeks: PlanWeek[];
  input: ApplyBlockRescheduleInput;
  sourcePhase: PhaseName;
  shouldPreserveSession: (session: PlannedSession, weekIndex: number, dayIndex: number) => boolean;
}): PlanWeek[] {
  const targetSessions = input.targetSessions;
  if (!targetSessions) {
    return input.swapLog.reduce<PlanWeek[]>((currentWeeks, swap) => (
      propagateSwap(
        currentWeeks,
        input.weekIndex,
        swap.from,
        swap.to,
        input.scope,
        sourcePhase,
        { shouldPreserveSession },
      )
    ), weeks);
  }

  return weeks.map((week, index) => {
    if (!shouldApplyRescheduleToWeek(index, week, input.weekIndex, input.scope, sourcePhase)) {
      return week;
    }

    if (input.swapLog.some((swap) => hasPreservedSwapPosition(
      week.sessions,
      index,
      swap,
      shouldPreserveSession,
    ))) {
      return week;
    }

    if (index === input.weekIndex) {
      return replaceWeekWithTargetSessions(week, targetSessions, input.swapLog);
    }

    if (matchesTargetReschedulePattern(week, targetSessions, input.swapLog)) {
      return week;
    }

    return applySwapLogToWeek(week, index, input.swapLog, shouldPreserveSession, targetSessions);
  });
}

export interface PlanWorkflowService {
  getActivePlan(userId: string): Promise<TrainingPlanWithAnnotation | null>;
  getTrainingPaceProfile(userId: string): Promise<TrainingPaceProfile | null>;
  updateTrainingPaceProfile(
    userId: string,
    trainingPaceProfile: TrainingPaceProfile | null,
  ): Promise<TrainingPaceProfile | null>;
  generatePlan(input: {
    template: (PlannedSession | null)[];
    totalWeeks: number;
    progressionPct: number;
    progressionEveryWeeks?: number;
    phases?: PhaseConfig;
  }): { weeks: PlanWeek[] };
  savePlan(userId: string, input: SavePlanWorkflowInput): Promise<TrainingPlan>;
  propagatePlanChange(userId: string, input: PropagatePlanChangeInput): Promise<TrainingPlan | null>;
  applyBlockReschedule(userId: string, input: ApplyBlockRescheduleInput): Promise<TrainingPlan | null>;
  updateWeeks(userId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null>;
  markSessionSkipped(userId: string, input: MarkSessionSkippedInput): Promise<TrainingPlan | null>;
  clearSessionSkipped(userId: string, input: ClearSessionSkippedInput): Promise<TrainingPlan | null>;
  markInjury(userId: string, name: string): Promise<TrainingPlan | null>;
  updateInjury(userId: string, updates: InjuryUpdate): Promise<TrainingPlan | null>;
  clearInjury(userId: string): Promise<TrainingPlan | null>;
}

export function createPlanWorkflowService({
  planRepo,
  profileRepo,
  activityRepo,
  todayForTimezone = currentIsoDateInTimezone,
  createId = () => crypto.randomUUID(),
  now = () => new Date().toISOString(),
}: PlanWorkflowDeps): PlanWorkflowService {
  async function getActivePlan(userId: string): Promise<TrainingPlanWithAnnotation | null> {
    const [plan, profile] = await Promise.all([
      repairOrphanedActivityLinks(userId, { planRepo, activityRepo }),
      profileRepo.getById(userId),
    ]);

    // Home annotations are server-owned. During the AI freeze this must not
    // generate or return proactive coach/Steady AI notes.
    return withHomeAnnotations(plan, todayForTimezone(profile?.timezone ?? 'UTC'));
  }

  async function getRequiredActivePlan(userId: string): Promise<TrainingPlan> {
    const plan = await planRepo.getActive(userId);
    if (!plan) {
      throw new PlanWorkflowError('NOT_FOUND', 'No plan found');
    }
    return plan;
  }

  return {
    getActivePlan,

    async getTrainingPaceProfile(userId: string) {
      const plan = await planRepo.getActive(userId);
      return plan?.trainingPaceProfile ?? null;
    },

    async updateTrainingPaceProfile(userId, trainingPaceProfile) {
      const plan = await planRepo.getActive(userId);
      if (!plan) return null;

      const normalizedProfile = normalizeTrainingPaceProfile(trainingPaceProfile);
      const [profile, activities] = await Promise.all([
        profileRepo.getById(userId),
        activityRepo.getByUserId(userId),
      ]);
      const propagatedPlan = propagateTrainingPaceProfileUpdate(plan, normalizedProfile, {
        today: todayForTimezone(profile?.timezone ?? 'UTC'),
        completedSessionIds: activities
          .map((activity) => activity.matchedSessionId)
          .filter((sessionId): sessionId is string => Boolean(sessionId)),
      });
      const updated = await planRepo.updateTrainingPaceProfile(
        plan.id,
        propagatedPlan.trainingPaceProfile ?? null,
        propagatedPlan.weeks,
      );

      return updated?.trainingPaceProfile ?? null;
    },

    generatePlan(input) {
      return {
        weeks: generatePlan(
          input.template,
          input.totalWeeks,
          input.progressionPct,
          input.phases,
          input.progressionEveryWeeks,
        ),
      };
    },

    async savePlan(userId, input) {
      validateSaveInput(input);

      const existing = await planRepo.getActive(userId);
      const plan: TrainingPlan = {
        id: existing?.id ?? createId(),
        userId,
        createdAt: existing?.createdAt ?? now(),
        raceName: input.raceName,
        raceDate: input.raceDate,
        raceDistance: input.raceDistance,
        targetTime: input.targetTime,
        phases: input.phases,
        progressionPct: input.progressionPct,
        progressionEveryWeeks: input.progressionEveryWeeks ?? 2,
        templateWeek: normalizeTemplateWeek(input.templateWeek),
        weeks: normalizeWeeks(input.weeks),
        trainingPaceProfile: input.trainingPaceProfile === undefined
          ? existing?.trainingPaceProfile ?? null
          : normalizeTrainingPaceProfile(input.trainingPaceProfile),
        activeInjury: existing?.activeInjury ?? null,
      };

      return planRepo.save(plan);
    },

    async propagatePlanChange(userId, input) {
      const [plan, profile, activities] = await Promise.all([
        getRequiredActivePlan(userId),
        profileRepo.getById(userId),
        activityRepo.getByUserId(userId),
      ]);
      validatePlanSlot(plan, input.weekIndex, input.dayIndex);
      const timezone = profile?.timezone ?? 'UTC';
      const preservationContext = completedSessionContext(
        activities,
        todayForTimezone(timezone),
        timezone,
      );
      const newWeeks = propagateChange(
        plan.weeks,
        input.weekIndex,
        input.dayIndex,
        input.updated,
        input.scope,
        plan.templateWeek,
        input.targetPhase,
        {
          shouldPreserveSession: shouldPreserveCompletedOrMatchedSession(preservationContext),
        },
      );

      return planRepo.updateWeeks(plan.id, normalizeWeeks(newWeeks));
    },

    async applyBlockReschedule(userId, input) {
      const [plan, profile, activities] = await Promise.all([
        getRequiredActivePlan(userId),
        profileRepo.getById(userId),
        activityRepo.getByUserId(userId),
      ]);
      validateSwapLog(plan, input);

      if (input.swapLog.length === 0) {
        return plan;
      }

      const timezone = profile?.timezone ?? 'UTC';
      const shouldPreserveSession = shouldPreserveCompletedOrMatchedSession(
        completedSessionContext(
          activities,
          todayForTimezone(timezone),
          timezone,
        ),
      );
      const sourcePhase = input.targetPhase ?? plan.weeks[input.weekIndex]?.phase;
      const newWeeks = applyTargetedBlockReschedule({
        weeks: plan.weeks,
        input,
        sourcePhase,
        shouldPreserveSession,
      });

      return planRepo.updateWeeks(plan.id, normalizeWeeks(newWeeks));
    },

    async updateWeeks(userId, weeks) {
      validateWeeks(weeks);

      const plan = await planRepo.getActive(userId);
      if (!plan) return null;

      return planRepo.updateWeeks(plan.id, normalizeWeeks(weeks));
    },

    async markSessionSkipped(userId, input) {
      const plan = await planRepo.getActive(userId);
      if (!plan) return null;

      const markedAt = now();
      const result = updateSessionById(plan.weeks, input.sessionId, (session) => ({
        ...session,
        skipped: {
          reason: input.reason,
          markedAt,
        },
      }));

      if (!result.found) {
        throw new PlanWorkflowError('NOT_FOUND', 'Session not found in active plan');
      }

      return planRepo.updateWeeks(plan.id, normalizeWeeks(result.weeks));
    },

    async clearSessionSkipped(userId, input) {
      const plan = await planRepo.getActive(userId);
      if (!plan) return null;

      const result = updateSessionById(plan.weeks, input.sessionId, (session) => {
        if (!session.skipped) {
          return session;
        }

        const { skipped: _skipped, ...sessionWithoutSkipped } = session;
        return sessionWithoutSkipped;
      });

      if (!result.found) {
        throw new PlanWorkflowError('NOT_FOUND', 'Session not found in active plan');
      }

      if (!result.changed) {
        return plan;
      }

      return planRepo.updateWeeks(plan.id, normalizeWeeks(result.weeks));
    },

    async markInjury(userId, name) {
      const plan = await getRequiredActivePlan(userId);
      return planRepo.markInjury(plan.id, name);
    },

    async updateInjury(userId, updates) {
      const plan = await getRequiredActivePlan(userId);
      return planRepo.updateInjury(plan.id, updates);
    },

    async clearInjury(userId) {
      const plan = await getRequiredActivePlan(userId);
      return planRepo.clearInjury(plan.id);
    },
  };
}
