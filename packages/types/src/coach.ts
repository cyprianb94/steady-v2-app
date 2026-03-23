import type { PlannedSession } from './session';

export type ConversationType =
  | 'post_run_debrief'
  | 'weekly_preview'
  | 'missed_session'
  | 'free_form';

export interface CoachConversation {
  id: string;
  userId: string;
  type: ConversationType;

  relatedSessionId?: string;
  relatedWeekNumber?: number;

  createdAt: string;
  title: string;

  messages: CoachMessage[];
  planEdits: PlanEdit[];
}

export interface CoachMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;

  attachedSessionId?: string;
  planEditId?: string;
}

export type PlanEditStatus = 'proposed' | 'applied' | 'rejected';

export interface PlanEdit {
  id: string;
  conversationId: string;
  messageId: string;

  sessionId: string;

  before: Partial<PlannedSession>;
  after: Partial<PlannedSession>;

  status: PlanEditStatus;
  appliedAt?: string;
}
