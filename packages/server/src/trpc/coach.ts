import { z } from 'zod';
import { router, authedProcedure } from './trpc';
import {
  handleCoachMessage,
  getConversation,
  getUserConversations,
  type CoachDeps,
} from '../lib/coach-orchestrator';
import { createLLMClient } from '../lib/llm-client';
import type { PlanRepo } from '../repos/plan-repo';

const llm = createLLMClient();

function createDeps(planRepo: PlanRepo): CoachDeps {
  return {
    llm,
    getPlan: async (userId) => planRepo.getActive(userId),
    getActivities: async () => [],
    getUser: async (userId) => ({
      id: userId,
      email: `${userId}@steady.app`,
      createdAt: new Date().toISOString(),
      appleHealthConnected: false,
      subscriptionTier: 'pro' as const,
      timezone: 'Europe/London',
      units: 'metric' as const,
    }),
  };
}

export function createCoachRouter(planRepo: PlanRepo) {
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
        const deps = createDeps(planRepo);
        const { conversation, reply } = await handleCoachMessage(
          ctx.userId,
          input.conversationId,
          input.message,
          deps,
        );
        return {
          conversationId: conversation.id,
          reply,
        };
      }),

    /** Get a specific conversation by ID. */
    getConversation: authedProcedure
      .input(z.object({ conversationId: z.string() }))
      .query(({ input }) => {
        return getConversation(input.conversationId);
      }),

    /** List all conversations for the current user. */
    listConversations: authedProcedure.query(({ ctx }) => {
      return getUserConversations(ctx.userId);
    }),
  });
}
