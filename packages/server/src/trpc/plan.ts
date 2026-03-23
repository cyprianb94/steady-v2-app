import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from './trpc';
import { generatePlan, defaultPhases, propagateChange } from '@steady/types';
import type { TrainingPlan, PlanWeek, PhaseConfig, PlannedSession } from '@steady/types';

/**
 * Plan CRUD procedures.
 *
 * For now, plans are stored in-memory per user.
 * Will be replaced with Supabase persistence once auth is wired up.
 */

// Shared in-memory store (replaced by Supabase in production)
import { planStore } from '../lib/stores';

const PhaseConfigSchema = z.object({
  BASE: z.number().min(0),
  BUILD: z.number().min(0),
  RECOVERY: z.number().min(0),
  PEAK: z.number().min(0),
  TAPER: z.number().min(0),
});

export const planRouter = router({
  /** Get the user's active training plan. */
  get: authedProcedure.query(({ ctx }) => {
    return planStore.get(ctx.userId) ?? null;
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
        raceDistance: z.enum(['5K', '10K', 'Half Marathon', 'Marathon']),
        targetTime: z.string(),
        phases: PhaseConfigSchema,
        progressionPct: z.number().min(0).max(30),
        templateWeek: z.array(z.any()),
        weeks: z.array(z.any()),
      }),
    )
    .mutation(({ ctx, input }) => {
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

      const plan: TrainingPlan = {
        id: planStore.get(ctx.userId)?.id ?? crypto.randomUUID(),
        userId: ctx.userId,
        createdAt: planStore.get(ctx.userId)?.createdAt ?? new Date().toISOString(),
        raceName: input.raceName,
        raceDate: input.raceDate,
        raceDistance: input.raceDistance,
        targetTime: input.targetTime,
        phases,
        progressionPct: input.progressionPct,
        templateWeek: input.templateWeek as (PlannedSession | null)[],
        weeks,
      };
      planStore.set(ctx.userId, plan);
      return plan;
    }),

  /** Apply a session edit and propagate across the plan. */
  propagate: authedProcedure
    .input(
      z.object({
        weekIndex: z.number().min(0),
        dayIndex: z.number().min(0).max(6),
        updated: z.any(),
        scope: z.enum(['this', 'remaining', 'build']),
      }),
    )
    .mutation(({ ctx, input }) => {
      const plan = planStore.get(ctx.userId);
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
      );

      plan.weeks = newWeeks;
      return plan;
    }),

  /** Update a single week's sessions (used by propagateChange on client). */
  updateWeeks: authedProcedure
    .input(
      z.object({
        weeks: z.array(z.any()),
      }),
    )
    .mutation(({ ctx, input }) => {
      const plan = planStore.get(ctx.userId);
      if (!plan) return null;
      plan.weeks = input.weeks as PlanWeek[];
      return plan;
    }),
});
