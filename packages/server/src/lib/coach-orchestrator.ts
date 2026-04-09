/**
 * Coach orchestrator.
 *
 * Hides: Context loading, prompt building, LLM calls, message storage,
 * conversation management. Callers provide deps; orchestrator wires everything.
 */

import type {
  CoachConversation,
  CoachMessage,
  ConversationType,
  TrainingPlan,
  Activity,
  User,
} from '@steady/types';
import type { LLMClient, LLMMessage } from './llm-client';
import { buildSystemPrompt } from './context-builder';
import type { ConversationRepo } from '../repos/conversation-repo';

export interface CoachDeps {
  llm: LLMClient;
  conversationRepo: ConversationRepo;
  getPlan: (userId: string) => Promise<TrainingPlan | null>;
  getActivities: (userId: string) => Promise<Activity[]>;
  getUser: (userId: string) => Promise<User>;
}

async function getOrCreateConversation(
  userId: string,
  conversationId: string | undefined,
  type: ConversationType,
  conversationRepo: ConversationRepo,
): Promise<CoachConversation> {
  if (conversationId) {
    const existing = await conversationRepo.getById(conversationId);
    if (existing) {
      if (existing.userId !== userId) {
        throw new Error('Conversation does not belong to the current user');
      }
      return existing;
    }
  }

  const conv: CoachConversation = {
    id: crypto.randomUUID(),
    userId,
    type,
    createdAt: new Date().toISOString(),
    title: type === 'free_form' ? 'Chat' : type.replace(/_/g, ' '),
    messages: [],
    planEdits: [],
  };
  return conversationRepo.create(conv);
}

export async function handleCoachMessage(
  userId: string,
  conversationId: string | undefined,
  userMessage: string,
  deps: CoachDeps,
): Promise<{ conversation: CoachConversation; reply: CoachMessage }> {
  const conv = await getOrCreateConversation(
    userId,
    conversationId,
    'free_form',
    deps.conversationRepo,
  );

  // Store user message
  const userMsg: CoachMessage = {
    id: crypto.randomUUID(),
    conversationId: conv.id,
    role: 'user',
    content: userMessage,
    createdAt: new Date().toISOString(),
  };
  await deps.conversationRepo.addMessage(conv.id, userMsg);

  // Build context
  const [plan, activities, user] = await Promise.all([
    deps.getPlan(userId),
    deps.getActivities(userId),
    deps.getUser(userId),
  ]);

  const systemPrompt = buildSystemPrompt(
    user,
    plan ?? emptyPlan(userId),
    activities,
    conv.type,
  );

  // Build message history for LLM
  const llmMessages: LLMMessage[] = [...conv.messages, userMsg].map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Call LLM
  const replyText = await deps.llm.sendMessage(systemPrompt, llmMessages);

  // Store assistant message
  const assistantMsg: CoachMessage = {
    id: crypto.randomUUID(),
    conversationId: conv.id,
    role: 'assistant',
    content: replyText,
    createdAt: new Date().toISOString(),
  };
  await deps.conversationRepo.addMessage(conv.id, assistantMsg);

  const persistedConversation = await deps.conversationRepo.getById(conv.id);
  if (!persistedConversation) {
    throw new Error(`Conversation ${conv.id} disappeared after persistence`);
  }

  return { conversation: persistedConversation, reply: assistantMsg };
}

export function getConversation(
  conversationId: string,
  conversationRepo: ConversationRepo,
): Promise<CoachConversation | null> {
  return conversationRepo.getById(conversationId);
}

export function getUserConversations(
  userId: string,
  conversationRepo: ConversationRepo,
): Promise<CoachConversation[]> {
  return conversationRepo.listByUserId(userId);
}

function emptyPlan(userId: string): TrainingPlan {
  return {
    id: '',
    userId,
    createdAt: new Date().toISOString(),
    raceName: 'No plan yet',
    raceDate: '',
    raceDistance: 'Marathon',
    targetTime: '',
    phases: { BASE: 0, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: [],
    weeks: [],
    activeInjury: null,
  };
}
