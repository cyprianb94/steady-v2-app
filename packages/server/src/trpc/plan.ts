import { z } from 'zod';
import { router, authedProcedure } from './trpc';
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
  BASE: z.number(),
  BUILD: z.number(),
  RECOVERY: z.number(),
  PEAK: z.number(),
  TAPER: z.number(),
});

export const planRouter = router({
  /** Get the user's active training plan. */
  get: authedProcedure.query(({ ctx }) => {
    return planStore.get(ctx.userId) ?? null;
  }),

  /** Save or update a training plan. */
  save: authedProcedure
    .input(
      z.object({
        raceName: z.string(),
        raceDate: z.string(),
        raceDistance: z.enum(['5K', '10K', 'Half Marathon', 'Marathon']),
        targetTime: z.string(),
        phases: PhaseConfigSchema,
        progressionPct: z.number(),
        templateWeek: z.array(z.any()),
        weeks: z.array(z.any()),
      }),
    )
    .mutation(({ ctx, input }) => {
      const plan: TrainingPlan = {
        id: planStore.get(ctx.userId)?.id ?? crypto.randomUUID(),
        userId: ctx.userId,
        createdAt: planStore.get(ctx.userId)?.createdAt ?? new Date().toISOString(),
        raceName: input.raceName,
        raceDate: input.raceDate,
        raceDistance: input.raceDistance,
        targetTime: input.targetTime,
        phases: input.phases as PhaseConfig,
        progressionPct: input.progressionPct,
        templateWeek: input.templateWeek as (PlannedSession | null)[],
        weeks: input.weeks as PlanWeek[],
      };
      planStore.set(ctx.userId, plan);
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
