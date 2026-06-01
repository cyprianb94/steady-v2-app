import type { ActivitySource } from '@steady/types';

export interface ActivitySyncLog {
  id: string;
  userId: string;
  source: Exclude<ActivitySource, 'manual'>;
  startedAt: string;
  finishedAt: string;
  fetchedCount: number;
  importedCount: number;
  skippedCount: number;
  upgradedCount: number;
  errorCount: number;
  lastSuccessfulSyncAt: string | null;
}

export interface ActivitySyncLogRepo {
  save(log: ActivitySyncLog): Promise<ActivitySyncLog>;
  getLatestSuccessful(userId: string, source: Exclude<ActivitySource, 'manual'>): Promise<ActivitySyncLog | null>;
}
