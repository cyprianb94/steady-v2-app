import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrossTrainingEntry, CrossTrainingLogInput } from '@steady/types';
import type { CrossTrainingRepo } from './cross-training-repo';

function rowToEntry(row: Record<string, unknown>): CrossTrainingEntry {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    planId: row.plan_id as string,
    date: row.date as string,
    type: row.type as CrossTrainingEntry['type'],
    durationMinutes: row.duration_minutes as number,
    createdAt: row.created_at as string,
  };
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export class SupabaseCrossTrainingRepo implements CrossTrainingRepo {
  constructor(private supabase: SupabaseClient) {}

  async log(entry: CrossTrainingLogInput): Promise<CrossTrainingEntry> {
    const payload = {
      user_id: entry.userId,
      plan_id: entry.planId,
      date: entry.date,
      type: entry.type,
      duration_minutes: entry.durationMinutes,
    };

    const { data, error } = await this.supabase
      .from('cross_training_log')
      .insert(payload)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to log cross-training entry: ${error.message}`);
    }

    return rowToEntry(data);
  }

  async getForWeek(planId: string, weekStartDate: string): Promise<CrossTrainingEntry[]> {
    return this.getForDateRange(planId, weekStartDate, addDays(weekStartDate, 6));
  }

  async getForDateRange(planId: string, startDate: string, endDate: string): Promise<CrossTrainingEntry[]> {
    const { data, error } = await this.supabase
      .from('cross_training_log')
      .select('*')
      .eq('plan_id', planId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(rowToEntry);
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('cross_training_log')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete cross-training entry: ${error.message}`);
    }
  }
}
