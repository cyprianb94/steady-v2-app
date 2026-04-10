import type { IntegrationToken } from '@steady/types';
import type { IntegrationTokenRepo } from './integration-token-repo';

function keyFor(userId: string, provider: string): string {
  return `${userId}:${provider}`;
}

export class InMemoryIntegrationTokenRepo implements IntegrationTokenRepo {
  private store = new Map<string, IntegrationToken>();

  async get(userId: string, provider: string): Promise<IntegrationToken | null> {
    const token = this.store.get(keyFor(userId, provider));
    return token ? { ...token } : null;
  }

  async save(token: IntegrationToken): Promise<IntegrationToken> {
    this.store.set(keyFor(token.userId, token.provider), { ...token });
    return { ...token };
  }

  async delete(userId: string, provider: string): Promise<void> {
    this.store.delete(keyFor(userId, provider));
  }

  async updateLastSyncedAt(userId: string, provider: string, timestamp: string): Promise<IntegrationToken | null> {
    const key = keyFor(userId, provider);
    const existing = this.store.get(key);
    if (!existing) return null;

    const updated = { ...existing, lastSyncedAt: timestamp };
    this.store.set(key, updated);
    return { ...updated };
  }
}
