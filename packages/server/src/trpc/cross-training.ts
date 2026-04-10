import { z } from 'zod';
import { CROSS_TRAINING_TYPES } from '@steady/types';
import { TRPCError } from '@trpc/server';
import { authedProcedure, router } from './trpc';
import type { CrossTrainingRepo } from '../repos/cross-training-repo';
import type { PlanRepo } from '../repos/plan-repo';

export function createCrossTrainingRouter(
  crossTrainingRepo: CrossTrainingRepo,
  planRepo: PlanRepo,
) {
  return router({
    log: authedProcedure
      .input(
        z.object({
          date: z.string(),
          type: z.enum(CROSS_TRAINING_TYPES),
          durationMinutes: z.number().int().min(1).max(600),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        return crossTrainingRepo.log({
          userId: ctx.userId,
          planId: plan.id,
          date: input.date,
          type: input.type,
          durationMinutes: input.durationMinutes,
        });
      }),

    getForWeek: authedProcedure
      .input(
        z.object({
          weekStartDate: z.string(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        return crossTrainingRepo.getForWeek(plan.id, input.weekStartDate);
      }),

    getForDateRange: authedProcedure
      .input(
        z.object({
          startDate: z.string(),
          endDate: z.string(),
        }),
      )
      .query(async ({ ctx, input }) => {
        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        return crossTrainingRepo.getForDateRange(plan.id, input.startDate, input.endDate);
      }),

    delete: authedProcedure
      .input(
        z.object({
          id: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        await crossTrainingRepo.delete(input.id);
        return { success: true };
      }),
  });
}
