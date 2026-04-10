import { authedProcedure, router } from './trpc';
import type { ActivityRepo } from '../repos/activity-repo';

export function createActivityRouter(activityRepo: ActivityRepo) {
  return router({
    list: authedProcedure.query(async ({ ctx }) => {
      const activities = await activityRepo.getByUserId(ctx.userId);
      return activities.sort((a, b) => b.startTime.localeCompare(a.startTime));
    }),
  });
}
