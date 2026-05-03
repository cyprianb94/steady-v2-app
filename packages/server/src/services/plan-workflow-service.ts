import {
  generatePlan,
  getDisplayWeekIndex,
  normalizePlanWeekSessionDurations,
  normalizeSessionDurations,
  normalizeSessionIds,
  normalizeTrainingPaceProfile,
  propagateChange,
  propagateTrainingPaceProfileUpdate,
} from '@steady/types';
import type {
  InjuryUpdate,
  PhaseConfig,
  PhaseName,
  PlannedSession,
  PlanWeek,
  TrainingPaceProfile,
  TrainingPlan,
  TrainingPlanWithAnnotation,
} from '@steady/types';
import { generateHomeAnnotations } from '../lib/annotation-engine';
import { currentIsoDateInTimezone } from '../lib/iso-date';
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
  scope: 'this' | 'remaining' | 'build';
  targetPhase?: PhaseName;
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
  updateWeeks(userId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null>;
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

    // Home annotations are intentionally server-owned so every client transport sees the same copy.
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
      const plan = await getRequiredActivePlan(userId);
      const newWeeks = propagateChange(
        plan.weeks,
        input.weekIndex,
        input.dayIndex,
        input.updated,
        input.scope,
        plan.templateWeek,
        input.targetPhase,
      );

      return planRepo.updateWeeks(plan.id, normalizeWeeks(newWeeks));
    },

    async updateWeeks(userId, weeks) {
      validateWeeks(weeks);

      const plan = await planRepo.getActive(userId);
      if (!plan) return null;

      return planRepo.updateWeeks(plan.id, normalizeWeeks(weeks));
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
