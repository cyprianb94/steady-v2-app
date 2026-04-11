import type { SupabaseClient } from '@supabase/supabase-js';
import type { Niggle } from '@steady/types';
import type { NiggleInput, NiggleRepo } from './niggle-repo';

function rowToNiggle(row: Record<string, unknown>): Niggle {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    activityId: row.activity_id as string,
    bodyPart: row.body_part as Niggle['bodyPart'],
    severity: row.severity as Niggle['severity'],
    when: row.niggle_when as Niggle['when'],
    side: (row.side as Niggle['side']) ?? null,
    createdAt: row.created_at as string,
  };
}

export class SupabaseNiggleRepo implements NiggleRepo {
  constructor(private supabase: SupabaseClient) {}

  async setForActivity(activityId: string, niggles: NiggleInput[]): Promise<Niggle[]> {
    const { data: activity, error: activityError } = await this.supabase
      .from('activities')
      .select('user_id')
      .eq('id', activityId)
      .maybeSingle();

    if (activityError || !activity) {
      throw new Error(`Activity ${activityId} does not exist`);
    }

    const { data, error } = await this.supabase.rpc('replace_niggles_for_activity', {
      p_activity_id: activityId,
      p_user_id: activity.user_id,
      p_niggles: niggles,
    });

    if (error) {
      throw new Error(`Failed to replace niggles for activity: ${error.message}`);
    }

    return (data ?? []).map((row: unknown) => rowToNiggle(row as Record<string, unknown>));
  }

  async listByActivity(activityId: string): Promise<Niggle[]> {
    const { data, error } = await this.supabase
      .from('niggles')
      .select('*')
      .eq('activity_id', activityId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(rowToNiggle);
  }
}
