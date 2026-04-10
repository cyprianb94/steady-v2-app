import { describe, it, expect, beforeEach } from 'vitest';
import type { CoachConversation, CoachMessage, PlanEdit } from '@steady/types';
import type { ConversationRepo } from '../src/repos/conversation-repo';
import { InMemoryConversationRepo } from '../src/repos/conversation-repo.memory';

function makeConversation(userId: string, overrides?: Partial<CoachConversation>): CoachConversation {
  return {
    id: crypto.randomUUID(),
    userId,
    type: 'free_form',
    createdAt: '2026-03-23T07:00:00Z',
    title: 'Test Chat',
    messages: [],
    planEdits: [],
    ...overrides,
  };
}

function makeMessage(conversationId: string, role: 'user' | 'assistant', content: string): CoachMessage {
  return {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

function makePlanEdit(conversationId: string, messageId: string): PlanEdit {
  return {
    id: crypto.randomUUID(),
    conversationId,
    messageId,
    sessionId: 'session-1',
    before: { distance: 8 },
    after: { distance: 10 },
    status: 'proposed',
  };
}

function runConversationRepoTests(name: string, createRepo: () => ConversationRepo) {
  describe(name, () => {
    let repo: ConversationRepo;

    beforeEach(() => {
      repo = createRepo();
    });

    it('returns null for nonexistent conversation', async () => {
      expect(await repo.getById('nonexistent')).toBeNull();
    });

    it('creates and retrieves a conversation', async () => {
      const conv = makeConversation('user-1');
      await repo.create(conv);

      const retrieved = await repo.getById(conv.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.title).toBe('Test Chat');
      expect(retrieved!.userId).toBe('user-1');
    });

    it('lists conversations by userId', async () => {
      await repo.create(makeConversation('user-1', { title: 'Chat 1' }));
      await repo.create(makeConversation('user-1', { title: 'Chat 2' }));
      await repo.create(makeConversation('user-2', { title: 'Other' }));

      const user1Convs = await repo.listByUserId('user-1');
      expect(user1Convs).toHaveLength(2);

      const user2Convs = await repo.listByUserId('user-2');
      expect(user2Convs).toHaveLength(1);
    });

    it('adds messages to a conversation', async () => {
      const conv = makeConversation('user-1');
      await repo.create(conv);

      const msg1 = makeMessage(conv.id, 'user', 'Hello');
      const msg2 = makeMessage(conv.id, 'assistant', 'Hi there');
      await repo.addMessage(conv.id, msg1);
      await repo.addMessage(conv.id, msg2);

      const retrieved = await repo.getById(conv.id);
      expect(retrieved!.messages).toHaveLength(2);
      expect(retrieved!.messages[0].content).toBe('Hello');
      expect(retrieved!.messages[1].role).toBe('assistant');
    });

    it('adds plan edits and updates their status', async () => {
      const conv = makeConversation('user-1');
      await repo.create(conv);

      const msg = makeMessage(conv.id, 'assistant', 'I suggest changing distance');
      await repo.addMessage(conv.id, msg);

      const edit = makePlanEdit(conv.id, msg.id);
      await repo.addPlanEdit(edit);

      // Verify it's in the conversation
      const retrieved = await repo.getById(conv.id);
      expect(retrieved!.planEdits).toHaveLength(1);
      expect(retrieved!.planEdits[0].status).toBe('proposed');

      // Apply the edit
      const updated = await repo.updatePlanEditStatus(edit.id, 'applied', '2026-03-23T08:00:00Z');
      expect(updated).not.toBeNull();
      expect(updated!.status).toBe('applied');
      expect(updated!.appliedAt).toBe('2026-03-23T08:00:00Z');
    });

    it('returns null when updating status for nonexistent edit', async () => {
      expect(await repo.updatePlanEditStatus('ghost', 'applied')).toBeNull();
    });
  });
}

runConversationRepoTests('InMemoryConversationRepo', () => new InMemoryConversationRepo());
