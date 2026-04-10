import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { encrypt } from '../lib/encryption';
import {
  createStravaTokenService,
  revokeStravaTokenAccess,
  StravaAuthRevokedError,
  StravaTokensMissingError,
} from '../lib/strava-token-service';
import { syncStravaActivities } from '../lib/strava-sync';
import type { StravaClient } from '../lib/strava-client';
import type { ActivityRepo } from '../repos/activity-repo';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { authedProcedure, router } from './trpc';

interface StravaRouterDeps {
  profileRepo: ProfileRepo;
  planRepo?: PlanRepo;
  activityRepo?: ActivityRepo;
  integrationTokenRepo?: IntegrationTokenRepo;
  stravaClient?: StravaClient;
  encryptionKey?: string;
}

function requireConnectDeps(deps: StravaRouterDeps): {
  integrationTokenRepo: IntegrationTokenRepo;
  stravaClient: StravaClient;
  encryptionKey: string;
} {
  if (!deps.integrationTokenRepo || !deps.stravaClient || !deps.encryptionKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Strava integration is not configured',
    });
  }

  return {
    integrationTokenRepo: deps.integrationTokenRepo,
    stravaClient: deps.stravaClient,
    encryptionKey: deps.encryptionKey,
  };
}

function requireDisconnectDeps(deps: StravaRouterDeps): {
  integrationTokenRepo: IntegrationTokenRepo;
} {
  if (!deps.integrationTokenRepo) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Strava integration is not configured',
    });
  }

  return {
    integrationTokenRepo: deps.integrationTokenRepo,
  };
}

function requireSyncDeps(deps: StravaRouterDeps): {
  integrationTokenRepo: IntegrationTokenRepo;
  stravaClient: StravaClient;
  encryptionKey: string;
  planRepo: PlanRepo;
  activityRepo: ActivityRepo;
} {
  if (!deps.integrationTokenRepo || !deps.stravaClient || !deps.encryptionKey || !deps.planRepo || !deps.activityRepo) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Strava integration is not configured',
    });
  }

  return {
    integrationTokenRepo: deps.integrationTokenRepo,
    stravaClient: deps.stravaClient,
    encryptionKey: deps.encryptionKey,
    planRepo: deps.planRepo,
    activityRepo: deps.activityRepo,
  };
}

export function createStravaRouter(deps: StravaRouterDeps) {
  return router({
    config: authedProcedure.query(() => {
      return {
        clientId: process.env.STRAVA_CLIENT_ID ?? null,
      };
    }),

    status: authedProcedure.query(async ({ ctx }) => {
      const profile = await deps.profileRepo.getById(ctx.userId);
      const token = deps.integrationTokenRepo
        ? await deps.integrationTokenRepo.get(ctx.userId, 'strava')
        : null;

      const athleteId = profile?.stravaAthleteId ?? token?.externalAthleteId ?? null;
      return {
        connected: Boolean(token || athleteId),
        athleteId,
        lastSyncedAt: token?.lastSyncedAt ?? null,
      };
    }),

    connect: authedProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await deps.profileRepo.getById(ctx.userId);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
        }

        const { integrationTokenRepo, stravaClient, encryptionKey } = requireConnectDeps(deps);
        const tokenResponse = await stravaClient.exchangeCode(input.code);
        if (!tokenResponse.athleteId) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Strava token exchange did not include athlete information',
          });
        }

        await integrationTokenRepo.save({
          id: crypto.randomUUID(),
          userId: ctx.userId,
          provider: 'strava',
          encryptedAccessToken: encrypt(tokenResponse.accessToken, encryptionKey),
          encryptedRefreshToken: encrypt(tokenResponse.refreshToken, encryptionKey),
          expiresAt: tokenResponse.expiresAt,
          externalAthleteId: tokenResponse.athleteId,
          createdAt: new Date().toISOString(),
        });

        await deps.profileRepo.upsert({
          ...profile,
          stravaAthleteId: tokenResponse.athleteId,
        });

        return {
          success: true as const,
          athleteId: tokenResponse.athleteId,
        };
      }),

    sync: authedProcedure
      .mutation(async ({ ctx }) => {
        const { integrationTokenRepo, stravaClient, encryptionKey, planRepo, activityRepo } = requireSyncDeps(deps);
        const tokenService = createStravaTokenService({
          integrationTokenRepo,
          profileRepo: deps.profileRepo,
          stravaClient,
          encryptionKey,
        });

        try {
          return await syncStravaActivities(ctx.userId, {
            activityRepo,
            integrationTokenRepo,
            planRepo,
            stravaClient,
            tokenService,
          });
        } catch (error) {
          if (error instanceof StravaAuthRevokedError) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Strava access has been revoked',
            });
          }
          if (error instanceof StravaTokensMissingError) {
            throw new TRPCError({
              code: 'PRECONDITION_FAILED',
              message: 'Strava is not connected',
            });
          }
          throw error;
        }
      }),

    disconnect: authedProcedure
      .mutation(async ({ ctx }) => {
        const { integrationTokenRepo } = requireDisconnectDeps(deps);

        await revokeStravaTokenAccess(deps.profileRepo, integrationTokenRepo, ctx.userId);

        return { success: true as const };
      }),
  });
}
