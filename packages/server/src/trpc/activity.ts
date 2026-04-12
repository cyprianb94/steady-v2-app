import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { authedProcedure, router } from './trpc';
import { applyActivityMatchToPlan } from '../lib/activity-match-assignment';
import type { ActivityRepo } from '../repos/activity-repo';
import type { PlanRepo } from '../repos/plan-repo';

export function createActivityRouter(activityRepo: ActivityRepo, planRepo: PlanRepo) {
  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      const activities = await activityRepo.getByUserId(ctx.userId);
      return activities.sort((a, b) => b.startTime.localeCompare(a.startTime));
    }),

    matchSession: authedProcedure
      .input(
        z.object({
          activityId: z.string().min(1),
          sessionId: z.string().min(1).nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const activities = await activityRepo.getByUserId(ctx.userId);
        const activity = activities.find((item) => item.id === input.activityId);

        if (!activity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }

        const plan = await planRepo.getActive(ctx.userId);
        if (!plan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        const assignment = applyActivityMatchToPlan(plan, activity.id, input.sessionId);
        if (!assignment.foundSession) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Session not found' });
        }
        if (assignment.conflictingSession) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Session already has a matched activity',
          });
        }

        const updatedActivity = await activityRepo.updateMatchedSession(activity.id, input.sessionId);
        if (!updatedActivity) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' });
        }

        const updatedPlan = await planRepo.updateWeeks(plan.id, assignment.plan.weeks);
        if (!updatedPlan) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'No plan found' });
        }

        return {
          activity: updatedActivity,
          plan: updatedPlan,
        };
      }),
  });
}
