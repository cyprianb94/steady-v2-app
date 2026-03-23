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

export interface CoachDeps {
  llm: LLMClient;
  getPlan: (userId: string) => Promise<TrainingPlan | null>;
  getActivities: (userId: string) => Promise<Activity[]>;
  getUser: (userId: string) => Promise<User>;
}

// In-memory conversation store (replaced by Supabase in production)
const conversations = new Map<string, CoachConversation>();
// userId -> conversationId[]
const userConversations = new Map<string, string[]>();

function getOrCreateConversation(
  userId: string,
  conversationId: string | undefined,
  type: ConversationType,
): CoachConversation {
  if (conversationId && conversations.has(conversationId)) {
    return conversations.get(conversationId)!;
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
  conversations.set(conv.id, conv);

  const userConvs = userConversations.get(userId) ?? [];
  userConvs.push(conv.id);
  userConversations.set(userId, userConvs);

  return conv;
}

export async function handleCoachMessage(
  userId: string,
  conversationId: string | undefined,
  userMessage: string,
  deps: CoachDeps,
): Promise<{ conversation: CoachConversation; reply: CoachMessage }> {
  const conv = getOrCreateConversation(userId, conversationId, 'free_form');

  // Store user message
  const userMsg: CoachMessage = {
    id: crypto.randomUUID(),
    conversationId: conv.id,
    role: 'user',
    content: userMessage,
    createdAt: new Date().toISOString(),
  };
  conv.messages.push(userMsg);

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
  const llmMessages: LLMMessage[] = conv.messages.map((m) => ({
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
  conv.messages.push(assistantMsg);

  return { conversation: conv, reply: assistantMsg };
}

export function getConversation(conversationId: string): CoachConversation | null {
  return conversations.get(conversationId) ?? null;
}

export function getUserConversations(userId: string): CoachConversation[] {
  const ids = userConversations.get(userId) ?? [];
  return ids
    .map((id) => conversations.get(id))
    .filter(Boolean) as CoachConversation[];
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
  };
}
