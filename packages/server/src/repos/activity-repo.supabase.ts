import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity, SubjectiveInput } from '@steady/types';
import type { ActivityRepo } from './activity-repo';

function rowToActivity(row: Record<string, unknown>): Activity {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    source: row.source as Activity['source'],
    externalId: row.external_id as string,
    startTime: row.start_time as string,
    distance: Number(row.distance),
    duration: row.duration as number,
    elevationGain: row.elevation_gain != null ? Number(row.elevation_gain) : undefined,
    avgPace: Number(row.avg_pace),
    avgHR: row.avg_hr != null ? Number(row.avg_hr) : undefined,
    maxHR: row.max_hr != null ? Number(row.max_hr) : undefined,
    splits: (row.splits as Activity['splits']) ?? [],
    subjectiveInput: (row.subjective_input as SubjectiveInput) ?? undefined,
    matchedSessionId: (row.matched_session_id as string) ?? undefined,
    shoeId: (row.shoe_id as string) ?? undefined,
  };
}

function activityToRow(activity: Activity): Record<string, unknown> {
  return {
    id: activity.id,
    user_id: activity.userId,
    source: activity.source,
    external_id: activity.externalId,
    start_time: activity.startTime,
    distance: activity.distance,
    duration: activity.duration,
    elevation_gain: activity.elevationGain ?? null,
    avg_pace: activity.avgPace,
    avg_hr: activity.avgHR ?? null,
    max_hr: activity.maxHR ?? null,
    splits: activity.splits,
    subjective_input: activity.subjectiveInput ?? null,
    matched_session_id: activity.matchedSessionId ?? null,
    shoe_id: activity.shoeId ?? null,
  };
}

export class SupabaseActivityRepo implements ActivityRepo {
  constructor(private supabase: SupabaseClient) {}

  async getByUserId(userId: string): Promise<Activity[]> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false });

    if (error || !data) return [];
    return data.map(rowToActivity);
  }

  async save(activity: Activity): Promise<Activity> {
    const { data, error } = await this.supabase
      .from('activities')
      .upsert(activityToRow(activity), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save activity: ${error.message}`);
    return rowToActivity(data);
  }

  async getByExternalId(userId: string, source: string, externalId: string): Promise<Activity | null> {
    const { data, error } = await this.supabase
      .from('activities')
      .select('*')
      .eq('user_id', userId)
      .eq('source', source)
      .eq('external_id', externalId)
      .single();

    if (error || !data) return null;
    return rowToActivity(data);
  }

  async updateSubjectiveInput(activityId: string, input: SubjectiveInput): Promise<Activity | null> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({ subjective_input: input })
      .eq('id', activityId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToActivity(data);
  }

  async updateMatchedSession(activityId: string, sessionId: string | null): Promise<Activity | null> {
    const { data, error } = await this.supabase
      .from('activities')
      .update({ matched_session_id: sessionId })
      .eq('id', activityId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToActivity(data);
  }
}
