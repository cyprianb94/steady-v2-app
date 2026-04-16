import { z } from 'zod';
import type { StravaWorkflowService } from '../services/strava-workflow-service';
import { authedProcedure, router } from './trpc';

export function createStravaRouter(stravaWorkflow: StravaWorkflowService) {
  return router({
    config: authedProcedure.query(() => stravaWorkflow.getConfig()),

    status: authedProcedure.query(({ ctx }) => stravaWorkflow.getStatus(ctx.userId)),

    connect: authedProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(({ ctx, input }) => stravaWorkflow.connect(ctx.userId, input.code)),

    sync: authedProcedure
      .mutation(({ ctx }) => stravaWorkflow.sync(ctx.userId)),

    refreshActivity: authedProcedure
      .input(z.object({ activityId: z.string().uuid() }))
      .mutation(({ ctx, input }) => stravaWorkflow.refreshActivity(ctx.userId, input.activityId)),

    disconnect: authedProcedure
      .mutation(({ ctx }) => stravaWorkflow.disconnect(ctx.userId)),
  });
}
