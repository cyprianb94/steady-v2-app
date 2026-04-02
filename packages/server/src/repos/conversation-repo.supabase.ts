import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoachConversation, CoachMessage, PlanEdit, PlanEditStatus } from '@steady/types';
import type { ConversationRepo } from './conversation-repo';

export class SupabaseConversationRepo implements ConversationRepo {
  constructor(private supabase: SupabaseClient) {}

  async create(conversation: CoachConversation): Promise<CoachConversation> {
    const { data, error } = await this.supabase
      .from('coach_conversations')
      .insert({
        id: conversation.id,
        user_id: conversation.userId,
        type: conversation.type,
        related_session_id: conversation.relatedSessionId ?? null,
        related_week_number: conversation.relatedWeekNumber ?? null,
        title: conversation.title,
        created_at: conversation.createdAt,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create conversation: ${error.message}`);
    return { ...conversation, messages: [], planEdits: [] };
  }

  async getById(id: string): Promise<CoachConversation | null> {
    const { data: conv, error: convError } = await this.supabase
      .from('coach_conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError || !conv) return null;

    const [{ data: messages }, { data: edits }] = await Promise.all([
      this.supabase
        .from('coach_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true }),
      this.supabase
        .from('plan_edits')
        .select('*')
        .eq('conversation_id', id),
    ]);

    return {
      id: conv.id,
      userId: conv.user_id,
      type: conv.type,
      relatedSessionId: conv.related_session_id ?? undefined,
      relatedWeekNumber: conv.related_week_number ?? undefined,
      createdAt: conv.created_at,
      title: conv.title,
      messages: (messages ?? []).map(rowToMessage),
      planEdits: (edits ?? []).map(rowToEdit),
    };
  }

  async listByUserId(userId: string): Promise<CoachConversation[]> {
    const { data, error } = await this.supabase
      .from('coach_conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    // Fetch full conversations with messages
    const results = await Promise.all(data.map((row) => this.getById(row.id)));
    return results.filter(Boolean) as CoachConversation[];
  }

  async addMessage(conversationId: string, message: CoachMessage): Promise<CoachMessage> {
    const { data, error } = await this.supabase
      .from('coach_messages')
      .insert({
        id: message.id,
        conversation_id: conversationId,
        role: message.role,
        content: message.content,
        attached_session_id: message.attachedSessionId ?? null,
        plan_edit_id: message.planEditId ?? null,
        created_at: message.createdAt,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add message: ${error.message}`);
    return rowToMessage(data);
  }

  async addPlanEdit(edit: PlanEdit): Promise<PlanEdit> {
    const { data, error } = await this.supabase
      .from('plan_edits')
      .insert({
        id: edit.id,
        conversation_id: edit.conversationId,
        message_id: edit.messageId,
        session_id: edit.sessionId,
        before: edit.before,
        after: edit.after,
        status: edit.status,
        applied_at: edit.appliedAt ?? null,
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to add plan edit: ${error.message}`);
    return rowToEdit(data);
  }

  async updatePlanEditStatus(editId: string, status: PlanEditStatus, appliedAt?: string): Promise<PlanEdit | null> {
    const { data, error } = await this.supabase
      .from('plan_edits')
      .update({ status, applied_at: appliedAt ?? null })
      .eq('id', editId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToEdit(data);
  }
}

function rowToMessage(row: Record<string, unknown>): CoachMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    role: row.role as 'user' | 'assistant',
    content: row.content as string,
    createdAt: row.created_at as string,
    attachedSessionId: (row.attached_session_id as string) ?? undefined,
    planEditId: (row.plan_edit_id as string) ?? undefined,
  };
}

function rowToEdit(row: Record<string, unknown>): PlanEdit {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    messageId: row.message_id as string,
    sessionId: row.session_id as string,
    before: row.before as Record<string, unknown>,
    after: row.after as Record<string, unknown>,
    status: row.status as PlanEditStatus,
    appliedAt: (row.applied_at as string) ?? undefined,
  };
}
