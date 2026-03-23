import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleCoachMessage,
  getConversation,
  getUserConversations,
  type CoachDeps,
} from '../src/lib/coach-orchestrator';
import type { LLMClient } from '../src/lib/llm-client';
import type { TrainingPlan, User } from '@steady/types';

// --- Test fixtures ---

function mockLLM(reply: string = 'Test reply'): LLMClient {
  return {
    sendMessage: async (_system, _messages) => reply,
  };
}

const testUser: User = {
  id: 'test-user',
  email: 'test@steady.app',
  createdAt: '2026-01-01T00:00:00Z',
  appleHealthConnected: false,
  subscriptionTier: 'pro',
  timezone: 'Europe/London',
  units: 'metric',
};

const testPlan: TrainingPlan = {
  id: 'plan-1',
  userId: 'test-user',
  createdAt: '2026-01-01T00:00:00Z',
  raceName: 'Test Marathon',
  raceDate: '2026-10-04',
  raceDistance: 'Marathon',
  targetTime: 'sub-3:30',
  phases: { BASE: 3, BUILD: 8, RECOVERY: 2, PEAK: 2, TAPER: 3 },
  progressionPct: 7,
  templateWeek: [],
  weeks: [{
    weekNumber: 1,
    phase: 'BUILD',
    sessions: [
      { id: 's1', type: 'EASY', date: '2026-03-23', distance: 8, pace: '5:20' },
      null, null, null, null, null, null,
    ],
    plannedKm: 8,
  }],
};

function createDeps(overrides?: Partial<CoachDeps>): CoachDeps {
  return {
    llm: mockLLM(),
    getPlan: async () => testPlan,
    getActivities: async () => [],
    getUser: async () => testUser,
    ...overrides,
  };
}

// --- Tests ---

describe('coach-orchestrator', () => {
  describe('handleCoachMessage', () => {
    it('creates a new conversation and returns both user and assistant messages', async () => {
      const deps = createDeps({ llm: mockLLM('Great run today!') });
      const { conversation, reply } = await handleCoachMessage(
        'test-user',
        undefined,
        'How was my run?',
        deps,
      );

      expect(conversation.id).toBeTruthy();
      expect(conversation.userId).toBe('test-user');
      expect(conversation.type).toBe('free_form');
      expect(conversation.messages).toHaveLength(2);
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe('How was my run?');
      expect(conversation.messages[1].role).toBe('assistant');
      expect(reply.content).toBe('Great run today!');
    });

    it('appends to existing conversation when conversationId is provided', async () => {
      const deps = createDeps();

      // First message creates conversation
      const { conversation: conv1 } = await handleCoachMessage(
        'test-user',
        undefined,
        'Hello',
        deps,
      );

      // Second message continues it
      const { conversation: conv2 } = await handleCoachMessage(
        'test-user',
        conv1.id,
        'Follow up question',
        deps,
      );

      expect(conv2.id).toBe(conv1.id);
      expect(conv2.messages).toHaveLength(4); // 2 user + 2 assistant
    });

    it('passes conversation history to the LLM', async () => {
      let capturedMessages: any[] = [];
      const spyLLM: LLMClient = {
        sendMessage: async (_system, messages) => {
          capturedMessages = messages;
          return 'reply';
        },
      };

      const deps = createDeps({ llm: spyLLM });
      const { conversation } = await handleCoachMessage(
        'test-user',
        undefined,
        'First message',
        deps,
      );

      // Send second message
      await handleCoachMessage(
        'test-user',
        conversation.id,
        'Second message',
        deps,
      );

      // LLM should receive full history (3 messages: user, assistant, user)
      expect(capturedMessages).toHaveLength(3);
      expect(capturedMessages[0].role).toBe('user');
      expect(capturedMessages[0].content).toBe('First message');
      expect(capturedMessages[1].role).toBe('assistant');
      expect(capturedMessages[2].role).toBe('user');
      expect(capturedMessages[2].content).toBe('Second message');
    });

    it('includes coaching knowledge in the system prompt', async () => {
      let capturedSystemPrompt = '';
      const spyLLM: LLMClient = {
        sendMessage: async (system, _messages) => {
          capturedSystemPrompt = system;
          return 'reply';
        },
      };

      const deps = createDeps({ llm: spyLLM });
      await handleCoachMessage('test-user', undefined, 'Hi', deps);

      expect(capturedSystemPrompt).toContain('Steady');
      expect(capturedSystemPrompt).toContain('COACHING PRINCIPLE');
      expect(capturedSystemPrompt).toContain('Test Marathon');
    });

    it('works when user has no plan', async () => {
      const deps = createDeps({ getPlan: async () => null });
      const { reply } = await handleCoachMessage(
        'test-user',
        undefined,
        'Hi coach',
        deps,
      );

      expect(reply.content).toBeTruthy();
    });
  });

  describe('getConversation', () => {
    it('returns null for unknown conversation', () => {
      expect(getConversation('nonexistent')).toBeNull();
    });

    it('returns conversation after creation', async () => {
      const deps = createDeps();
      const { conversation } = await handleCoachMessage(
        'test-user',
        undefined,
        'Hello',
        deps,
      );

      const found = getConversation(conversation.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(conversation.id);
    });
  });

  describe('getUserConversations', () => {
    it('returns all conversations for a user', async () => {
      const deps = createDeps();

      // Create two separate conversations
      await handleCoachMessage('conv-test-user', undefined, 'First chat', deps);
      await handleCoachMessage('conv-test-user', undefined, 'Second chat', deps);

      const conversations = getUserConversations('conv-test-user');
      expect(conversations.length).toBeGreaterThanOrEqual(2);
    });

    it('returns empty array for user with no conversations', () => {
      const conversations = getUserConversations('no-such-user');
      expect(conversations).toEqual([]);
    });
  });
});
