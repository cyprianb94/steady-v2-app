import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from './trpc';
import { generatePlan, getDisplayWeekIndex, propagateChange } from '@steady/types';
import type { TrainingPlan, TrainingPlanWithAnnotation, PlanWeek, PhaseConfig, PlannedSession } from '@steady/types';
import type { ActivityRepo } from '../repos/activity-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { generateHomeAnnotations } from '../lib/annotation-engine';
import { currentIsoDateInTimezone } from '../lib/iso-date';
import { repairOrphanedActivityLinks } from '../services/orphaned-activity-link-repair';

const PhaseConfigSchema = z.object({
  BASE: z.number().min(0),
  BUILD: z.number().min(0),
  RECOVERY: z.number().min(0),
  PEAK: z.number().min(0),
  TAPER: z.number().min(0),
});

const InjuryUpdateSchema = z.object({
  reassessedTarget: z.string().min(1).max(100).optional(),
  rtrStep: z.number().min(0).max(4).optional(),
  rtrStepCompletedDates: z.array(z.string()).optional(),
  status: z.enum(['recovering', 'returning', 'resolved']).optional(),
});

const PhaseNameSchema = z.enum(['BASE', 'BUILD', 'RECOVERY', 'PEAK', 'TAPER']);
const SessionTypeSchema = z.enum(['EASY', 'INTERVAL', 'TEMPO', 'LONG', 'REST']);
const RecoveryDurationSchema = z.enum(['45s', '60s', '90s', '2min', '3min', '4min', '5min']);
const SessionDurationSchema = z.object({
  unit: z.enum(['km', 'min']),
  value: z.number().positive(),
});
const IntervalRecoverySchema = z.union([RecoveryDurationSchema, SessionDurationSchema]);
const SessionDurationInputSchema = z.union([z.number().positive(), SessionDurationSchema]);
const SubjectiveInputSchema = z.object({
  legs: z.enum(['fresh', 'normal', 'heavy', 'dead']),
  breathing: z.enum(['easy', 'controlled', 'labored']),
  overall: z.enum(['could-go-again', 'done', 'shattered']),
});
const SkippedSessionSchema = z.object({
  reason: z.enum(['tired', 'ill', 'busy', 'sore', 'other']),
  markedAt: z.string(),
});
const PlannedSessionSchema = z.object({
  id: z.string(),
  type: SessionTypeSchema,
  date: z.string(),
  distance: z.number().optional(),
  pace: z.string().optional(),
  reps: z.number().int().optional(),
  repDist: z.number().int().optional(),
  repDuration: SessionDurationSchema.optional(),
  recovery: IntervalRecoverySchema.optional(),
  warmup: SessionDurationInputSchema.optional(),
  cooldown: SessionDurationInputSchema.optional(),
  actualActivityId: z.string().optional(),
  subjectiveInput: SubjectiveInputSchema.optional(),
  subjectiveInputDismissed: z.boolean().optional(),
  skipped: SkippedSessionSchema.optional(),
});
const PlanWeekSchema = z.object({
  weekNumber: z.number().int().min(1),
  phase: PhaseNameSchema,
  sessions: z.array(PlannedSessionSchema.nullable()).length(7),
  plannedKm: z.number(),
  swapLog: z.array(z.object({
    from: z.number().int().min(0),
    to: z.number().int().min(0),
  })).optional(),
});

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

function withHomeAnnotations(plan: TrainingPlan | null, today: string): TrainingPlanWithAnnotation | null {
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

export function createPlanRouter(planRepo: PlanRepo, profileRepo: ProfileRepo, activityRepo: ActivityRepo) {
  return router({
    /** Get the user's active training plan. */
    get: authedProcedure.query(async ({ ctx }) => {
      const [plan, profile] = await Promise.all([
        repairOrphanedActivityLinks(ctx.userId, { planRepo, activityRepo }),
        profileRepo.getById(ctx.userId),
      ]);

      return withHomeAnnotations(plan, currentIsoDateInTimezone(profile?.timezone ?? 'UTC'));
    }),

    /** Generate a plan server-side from a template. */
    generate: authedProcedure
      .input(
        z.object({
          template: z.array(z.any()),
          totalWeeks: z.number().min(4).max(52),
          progressionPct: z.number().min(0).max(30),
          phases: PhaseConfigSchema.optional(),
        }),
      )
      .mutation(({ input }) => {
        const weeks = generatePlan(
          input.template as (PlannedSession | null)[],
          input.totalWeeks,
          input.progressionPct,
          input.phases as PhaseConfig | undefined,
        );
        return { weeks };
      }),

    /** Save or update a training plan with validation. */
    save: authedProcedure
      .input(
        z.object({
          raceName: z.string().min(1).max(200),
          raceDate: z.string(),
          raceDistance: z.enum(['5K', '10K', 'Half Marathon', 'Marathon', 'Ultra']),
          targetTime: z.string(),
          phases: PhaseConfigSchema,
          progressionPct: z.number().min(0).max(30),
          templateWeek: z.array(z.any()),
          weeks: z.array(z.any()),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const weeks = input.weeks as PlanWeek[];

        // Validate: phases sum must equal total weeks
        const phases = input.phases as PhaseConfig;
        const phaseSum = phases.BASE + phases.BUILD + phases.RECOVERY + phases.PEAK + phases.TAPER;
        if (weeks.length > 0 && phaseSum !== weeks.length) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Phase sum (${phaseSum}) does not match week count (${weeks.length})`,
          });
        }

        // Validate: each week must have 7 sessions
        for (const w of weeks) {
          if (!w.sessions || w.sessions.length !== 7) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Week ${w.weekNumber} must have exactly 7 session slots`,
            });
          }
        }

        const existing = await planRepo.getActive(ctx.userId);

        const plan: TrainingPlan = {
          id: existing?.id ?? crypto.randomUUID(),
          userId: ctx.userId,
          createdAt: existing?.createdAt ?? new Date().toISOString(),
          raceName: input.raceName,
          raceDate: input.raceDate,
          raceDistance: input.raceDistance as TrainingPlan['raceDistance'],
          targetTime: input.targetTime,
          phases,
          progressionPct: input.progressionPct,
          templateWeek: input.templateWeek as (PlannedSession | null)[],
          weeks,
          activeInjury: existing?.activeInjury ?? null,
        };

        return planRepo.save(plan);
      }),

    /** Apply a session edit and propagate across the plan. */
    propagate: authedProcedure
      .input(
        z.object({
          weekIndex: z.number().min(0),
          dayIndex: z.number().min(0).max(6),
          updated: z.any(),
          scope: z.enum(['this', 'remaining', 'build']),
          targetPhase: PhaseNameSchema.optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        const newWeeks = propagateChange(
          plan.weeks,
          input.weekIndex,
          input.dayIndex,
          input.updated as PlannedSession | null,
          input.scope,
          plan.templateWeek,
          input.targetPhase,
        );

        return planRepo.updateWeeks(plan.id, newWeeks);
      }),

    /** Update a single week's sessions (used by propagateChange on client). */
    updateWeeks: authedProcedure
      .input(
        z.object({
          weeks: z.array(PlanWeekSchema),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) return null;
        return planRepo.updateWeeks(plan.id, input.weeks as PlanWeek[]);
      }),

    markInjury: authedProcedure
      .input(
        z.object({
          name: z.string().trim().min(1).max(120),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }
        return planRepo.markInjury(plan.id, input.name);
      }),

    updateInjury: authedProcedure
      .input(InjuryUpdateSchema)
      .mutation(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }
        return planRepo.updateInjury(plan.id, input);
      }),

    clearInjury: authedProcedure
      .mutation(async ({ ctx }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }
        return planRepo.clearInjury(plan.id);
      }),
  });
}
