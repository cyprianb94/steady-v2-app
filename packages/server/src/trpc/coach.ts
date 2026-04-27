import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, authedProcedure } from './trpc';
import {
  handleCoachMessage,
  getConversation,
  getUserConversations,
  type CoachDeps,
} from '../lib/coach-orchestrator';
import { createLLMClient } from '../lib/llm-client';
import type { ActivityRepo } from '../repos/activity-repo';
import type { ConversationRepo } from '../repos/conversation-repo';
import type { PlanRepo } from '../repos/plan-repo';
import type { ProfileRepo } from '../repos/profile-repo';

const llm = createLLMClient();

interface CoachRouterDeps {
  profileRepo: ProfileRepo;
  planRepo: PlanRepo;
  activityRepo: ActivityRepo;
  conversationRepo: ConversationRepo;
}

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

function createDeps(deps: CoachRouterDeps): CoachDeps {
  return {
    llm,
    conversationRepo: deps.conversationRepo,
    getPlan: async (userId) => deps.planRepo.getActive(userId),
    getActivities: async (userId) => deps.activityRepo.getByUserId(userId),
    getUser: async (userId) => {
      const profile = await deps.profileRepo.getById(userId);
      return profile ?? fallbackUser(userId);
    },
  };
}

export function createCoachRouter(deps: CoachRouterDeps) {
  return router({
    /** Send a message to the coach and get a reply. */
    send: authedProcedure
      .input(
        z.object({
          conversationId: z.string().optional(),
          message: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (input.conversationId) {
          const existing = await deps.conversationRepo.getById(input.conversationId);
          if (!existing || existing.userId !== ctx.userId) {
            throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
          }
        }

        const coachDeps = createDeps(deps);
        const { conversation, reply } = await handleCoachMessage(
          ctx.userId,
          input.conversationId,
          input.message,
          coachDeps,
        );
        return {
          conversationId: conversation.id,
          reply,
        };
      }),

    /** Get a specific conversation by ID. */
    getConversation: authedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(async ({ ctx, input }) => {
        const conversation = await getConversation(
          input.conversationId,
          deps.conversationRepo,
        );
        if (!conversation || conversation.userId !== ctx.userId) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Conversation not found' });
        }
        return conversation;
      }),

    /** List all conversations for the current user. */
    listConversations: authedProcedure.query(({ ctx }) => {
      return getUserConversations(ctx.userId, deps.conversationRepo);
    }),
  });
}
