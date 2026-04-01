import type { CoachConversation, CoachMessage, PlanEdit, PlanEditStatus } from '@steady/types';

export interface ConversationRepo {
  create(conversation: CoachConversation): Promise<CoachConversation>;
  getById(id: string): Promise<CoachConversation | null>;
  listByUserId(userId: string): Promise<CoachConversation[]>;
  addMessage(conversationId: string, message: CoachMessage): Promise<CoachMessage>;
  addPlanEdit(edit: PlanEdit): Promise<PlanEdit>;
  updatePlanEditStatus(editId: string, status: PlanEditStatus, appliedAt?: string): Promise<PlanEdit | null>;
}
