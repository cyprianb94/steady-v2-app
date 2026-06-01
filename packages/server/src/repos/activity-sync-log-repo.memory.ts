import type { ActivitySource } from '@steady/types';
import type { ActivitySyncLog, ActivitySyncLogRepo } from './activity-sync-log-repo';

export class InMemoryActivitySyncLogRepo implements ActivitySyncLogRepo {
  private store = new Map<string, ActivitySyncLog>();

  async save(log: ActivitySyncLog): Promise<ActivitySyncLog> {
    this.store.set(log.id, { ...log });
    return { ...log };
  }

  async getLatestSuccessful(
    userId: string,
    source: Exclude<ActivitySource, 'manual'>,
  ): Promise<ActivitySyncLog | null> {
    const logs = [...this.store.values()]
      .filter((log) => log.userId === userId && log.source === source && log.lastSuccessfulSyncAt)
      .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

    return logs[0] ? { ...logs[0] } : null;
  }
}
