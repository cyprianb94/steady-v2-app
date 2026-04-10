import type { IntegrationToken } from '@steady/types';

export interface IntegrationTokenRepo {
  get(userId: string, provider: string): Promise<IntegrationToken | null>;
  save(token: IntegrationToken): Promise<IntegrationToken>;
  delete(userId: string, provider: string): Promise<void>;
  updateLastSyncedAt(userId: string, provider: string, timestamp: string): Promise<IntegrationToken | null>;
}
