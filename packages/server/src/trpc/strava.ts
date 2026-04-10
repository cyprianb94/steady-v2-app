import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { encrypt } from '../lib/encryption';
import { revokeStravaTokenAccess } from '../lib/strava-token-service';
import type { StravaClient } from '../lib/strava-client';
import type { IntegrationTokenRepo } from '../repos/integration-token-repo';
import type { ProfileRepo } from '../repos/profile-repo';
import { authedProcedure, router } from './trpc';

interface StravaRouterDeps {
  profileRepo: ProfileRepo;
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

export function createStravaRouter(deps: StravaRouterDeps) {
  return router({
    connect: authedProcedure
      .input(z.object({ code: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const profile = await deps.profileRepo.getById(ctx.userId);
        if (!profile) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
        }

        const { integrationTokenRepo, stravaClient, encryptionKey } = requireConnectDeps(deps);
        const tokenResponse = await stravaClient.exchangeCode(input.code);

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

    disconnect: authedProcedure
      .mutation(async ({ ctx }) => {
        const { integrationTokenRepo } = requireDisconnectDeps(deps);

        await revokeStravaTokenAccess(deps.profileRepo, integrationTokenRepo, ctx.userId);

        return { success: true as const };
      }),
  });
}
