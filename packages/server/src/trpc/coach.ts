import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { STEADY_AI_FREEZE_MESSAGE } from '@steady/types';
import { router, authedProcedure } from './trpc';
import {
  getConversation,
  getUserConversations,
} from '../lib/coach-orchestrator';
import type { ConversationRepo } from '../repos/conversation-repo';

interface CoachRouterDeps {
  conversationRepo: ConversationRepo;
}

export function createCoachRouter(deps: CoachRouterDeps) {
  return router({
    /** AI freeze: refuse new Steady AI messages until the feature is deliberately re-enabled. */
    send: authedProcedure
      .input(
        z.object({
          conversationId: z.string().optional(),
          message: z.string().min(1),
        }),
      )
      .mutation(() => {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: STEADY_AI_FREEZE_MESSAGE,
        });
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
