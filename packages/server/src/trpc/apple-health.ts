import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import type { ActivityIngestionService } from '../services/activity-ingestion-service';
import type { ActivitySyncLogRepo } from '../repos/activity-sync-log-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { authedProcedure, router } from './trpc';

const ActivitySplitSchema = z.object({
  km: z.number().positive(),
  pace: z.number().nonnegative(),
  hr: z.number().positive().optional(),
  elevation: z.number().optional(),
  label: z.string().min(1).max(80).optional(),
  distance: z.number().positive().optional(),
  cadence: z.number().positive().optional(),
});

const DataQualitySchema = z.record(z.union([z.boolean(), z.number(), z.string(), z.null()]));

const NormalizedProviderActivitySchema = z.object({
  source: z.literal('apple_health'),
  externalId: z.string().trim().min(1).max(200),
  name: z.string().trim().max(200).optional(),
  sourceName: z.string().trim().max(120).optional(),
  sourceBundleId: z.string().trim().max(200).optional(),
  sourceDevice: z.string().trim().max(200).optional(),
  startTime: z.string().datetime(),
  timezone: z.string().trim().max(80).optional(),
  runSubtype: z.enum(['outdoor', 'trail', 'track', 'treadmill', 'unknown']),
  distanceKm: z.number().positive(),
  durationSeconds: z.number().positive(),
  movingDurationSeconds: z.number().positive().optional(),
  elapsedDurationSeconds: z.number().positive().optional(),
  elevationGainM: z.number().optional(),
  avgPaceSecondsPerKm: z.number().positive().optional(),
  avgHR: z.number().positive().optional(),
  maxHR: z.number().positive().optional(),
  avgCadence: z.number().positive().optional(),
  splits: z.array(ActivitySplitSchema).max(200),
  dataQuality: DataQualitySchema,
}).strict();

export function createAppleHealthRouter(
  profileRepo: ProfileRepo,
  activityIngestion: ActivityIngestionService,
  syncLogRepo: ActivitySyncLogRepo,
) {
  return router({
    status: authedProcedure.query(async ({ ctx }) => {
      const [profile, latestSync] = await Promise.all([
        profileRepo.getById(ctx.userId),
        syncLogRepo.getLatestSuccessful(ctx.userId, 'apple_health'),
      ]);

      return {
        connected: Boolean(profile?.appleHealthConnected),
        primaryRunSource: profile?.primaryRunSource ?? null,
        lastSyncedAt: latestSync?.lastSuccessfulSyncAt ?? null,
      };
    }),

    connect: authedProcedure.mutation(async ({ ctx }) => {
      const profile = await profileRepo.updateRunSourceSettings(ctx.userId, {
        appleHealthConnected: true,
        primaryRunSource: 'apple_watch',
      });

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return { success: true as const };
    }),

    sync: authedProcedure
      .input(z.object({ activities: z.array(NormalizedProviderActivitySchema).max(250) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await profileRepo.getById(ctx.userId);
        if (!profile?.appleHealthConnected) {
          const updatedProfile = await profileRepo.updateRunSourceSettings(ctx.userId, {
            appleHealthConnected: true,
            primaryRunSource: profile?.primaryRunSource ?? 'apple_watch',
          });
          if (!updatedProfile) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
          }
        }

        return activityIngestion.ingest(ctx.userId, input.activities);
      }),

    disconnect: authedProcedure.mutation(async ({ ctx }) => {
      const profile = await profileRepo.getById(ctx.userId);
      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      const nextPrimaryRunSource = profile.primaryRunSource === 'apple_watch'
        ? null
        : profile.primaryRunSource ?? null;

      const updatedProfile = await profileRepo.updateRunSourceSettings(ctx.userId, {
        appleHealthConnected: false,
        primaryRunSource: nextPrimaryRunSource,
      });

      if (!updatedProfile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return { success: true as const };
    }),
  });
}
