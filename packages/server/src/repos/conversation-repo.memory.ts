import type { CoachConversation, CoachMessage, PlanEdit, PlanEditStatus } from '@steady/types';
import type { ConversationRepo } from './conversation-repo';

export class InMemoryConversationRepo implements ConversationRepo {
  private conversations = new Map<string, CoachConversation>();
  private planEdits = new Map<string, PlanEdit>();

  async create(conversation: CoachConversation): Promise<CoachConversation> {
    const conv = { ...conversation, messages: [...conversation.messages], planEdits: [...conversation.planEdits] };
    this.conversations.set(conv.id, conv);
    return { ...conv };
  }

  async getById(id: string): Promise<CoachConversation | null> {
    const conv = this.conversations.get(id);
    if (!conv) return null;

    // Attach plan edits to the conversation
    const edits: PlanEdit[] = [];
    for (const edit of this.planEdits.values()) {
      if (edit.conversationId === id) edits.push({ ...edit });
    }

    return { ...conv, messages: [...conv.messages], planEdits: edits };
  }

  async listByUserId(userId: string): Promise<CoachConversation[]> {
    const results: CoachConversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.userId === userId) {
        results.push(await this.getById(conv.id) as CoachConversation);
      }
    }
    return results;
  }

  async addMessage(conversationId: string, message: CoachMessage): Promise<CoachMessage> {
    const conv = this.conversations.get(conversationId);
    if (!conv) throw new Error(`Conversation ${conversationId} not found`);
    const msg = { ...message };
    conv.messages.push(msg);
    return msg;
  }

  async addPlanEdit(edit: PlanEdit): Promise<PlanEdit> {
    const stored = { ...edit };
    this.planEdits.set(stored.id, stored);
    return stored;
  }

  async updatePlanEditStatus(editId: string, status: PlanEditStatus, appliedAt?: string): Promise<PlanEdit | null> {
    const edit = this.planEdits.get(editId);
    if (!edit) return null;
    edit.status = status;
    edit.appliedAt = appliedAt;
    return { ...edit };
  }
}
