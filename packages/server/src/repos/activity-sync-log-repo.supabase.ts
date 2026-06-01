import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivitySource } from '@steady/types';
import type { ActivitySyncLog, ActivitySyncLogRepo } from './activity-sync-log-repo';

function rowToActivitySyncLog(row: Record<string, unknown>): ActivitySyncLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    source: row.source as Exclude<ActivitySource, 'manual'>,
    startedAt: row.started_at as string,
    finishedAt: row.finished_at as string,
    fetchedCount: row.fetched_count as number,
    importedCount: row.imported_count as number,
    skippedCount: row.skipped_count as number,
    upgradedCount: row.upgraded_count as number,
    errorCount: row.error_count as number,
    lastSuccessfulSyncAt: (row.last_successful_sync_at as string) ?? null,
  };
}

function activitySyncLogToRow(log: ActivitySyncLog): Record<string, unknown> {
  return {
    id: log.id,
    user_id: log.userId,
    source: log.source,
    started_at: log.startedAt,
    finished_at: log.finishedAt,
    fetched_count: log.fetchedCount,
    imported_count: log.importedCount,
    skipped_count: log.skippedCount,
    upgraded_count: log.upgradedCount,
    error_count: log.errorCount,
    last_successful_sync_at: log.lastSuccessfulSyncAt,
  };
}

export class SupabaseActivitySyncLogRepo implements ActivitySyncLogRepo {
  constructor(private supabase: SupabaseClient) {}

  async save(log: ActivitySyncLog): Promise<ActivitySyncLog> {
    const { data, error } = await this.supabase
      .from('activity_sync_logs')
      .insert(activitySyncLogToRow(log))
      .select()
      .single();

    if (error) throw new Error(`Failed to save activity sync log: ${error.message}`);
    return rowToActivitySyncLog(data);
  }

  async getLatestSuccessful(
    userId: string,
    source: Exclude<ActivitySource, 'manual'>,
  ): Promise<ActivitySyncLog | null> {
    const { data, error } = await this.supabase
      .from('activity_sync_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('source', source)
      .not('last_successful_sync_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load activity sync log: ${error.message}`);
    if (!data) return null;
    return rowToActivitySyncLog(data);
  }
}
