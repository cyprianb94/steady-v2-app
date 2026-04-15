import type { Activity, SubjectiveInput } from '@steady/types';
import { isLikelyNetworkError } from './network-errors';
import { getSupabaseClient } from './supabase';
import { trpc } from './trpc';

interface ActivityRow {
  id: string;
  user_id: string;
  source: Activity['source'];
  external_id: string;
  start_time: string;
  distance: number | string;
  duration: number;
  elevation_gain: number | string | null;
  avg_pace: number | string;
  avg_hr: number | string | null;
  max_hr: number | string | null;
  splits: Activity['splits'] | null;
  subjective_input: SubjectiveInput | null;
  matched_session_id: string | null;
  shoe_id: string | null;
  notes: string | null;
}

function requireActivitySupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Missing Supabase configuration for activity reads.');
  }
  return supabase;
}

function rowToActivity(row: ActivityRow): Activity {
  return {
    id: row.id,
    userId: row.user_id,
    source: row.source,
    externalId: row.external_id,
    startTime: row.start_time,
    distance: Number(row.distance),
    duration: row.duration,
    elevationGain: row.elevation_gain != null ? Number(row.elevation_gain) : undefined,
    avgPace: Number(row.avg_pace),
    avgHR: row.avg_hr != null ? Number(row.avg_hr) : undefined,
    maxHR: row.max_hr != null ? Number(row.max_hr) : undefined,
    splits: row.splits ?? [],
    subjectiveInput: row.subjective_input ?? undefined,
    matchedSessionId: row.matched_session_id ?? undefined,
    shoeId: row.shoe_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

async function listActivitiesDirect(userId: string): Promise<Activity[]> {
  const supabase = requireActivitySupabaseClient();
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  if (error) {
    throw new Error(`Failed to load activities: ${error.message}`);
  }

  return ((data ?? []) as ActivityRow[]).map(rowToActivity);
}

export async function listActivities(userId: string): Promise<Activity[]> {
  try {
    return await trpc.activity.list.query();
  } catch (error) {
    if (!isLikelyNetworkError(error) || !getSupabaseClient()) {
      throw error;
    }
    return listActivitiesDirect(userId);
  }
}
