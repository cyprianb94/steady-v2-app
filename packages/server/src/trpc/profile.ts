import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, authedProcedure } from './trpc';
import type { ProfileRepo } from '../repos/profile-repo';

function fallbackUser(userId: string) {
  return {
    id: userId,
    email: `${userId}@steady.app`,
    createdAt: new Date().toISOString(),
    appleHealthConnected: false,
    subscriptionTier: 'free' as const,
    timezone: 'UTC',
    units: 'metric' as const,
    weeklyVolumeMetric: 'distance' as const,
  };
}

export function createProfileRouter(profileRepo: ProfileRepo) {
  return router({
    me: authedProcedure.query(async ({ ctx }) => {
      const profile = await profileRepo.getById(ctx.userId);
      return profile ?? fallbackUser(ctx.userId);
    }),

    updatePreferences: authedProcedure
      .input(
        z
          .object({
            units: z.enum(['metric', 'imperial']).optional(),
            weeklyVolumeMetric: z.enum(['time', 'distance']).optional(),
          })
          .refine(
            (input) => input.units !== undefined || input.weeklyVolumeMetric !== undefined,
            'Provide at least one preference to update',
          ),
      )
      .mutation(async ({ ctx, input }) => {
        const profile = await profileRepo.getById(ctx.userId);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
        }

        return profileRepo.upsert({
          ...profile,
          units: input.units ?? profile.units,
          weeklyVolumeMetric: input.weeklyVolumeMetric ?? profile.weeklyVolumeMetric,
        });
      }),
  });
}
