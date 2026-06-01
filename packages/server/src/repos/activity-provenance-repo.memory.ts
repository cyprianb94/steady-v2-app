import type { ActivitySource } from '@steady/types';
import type { ActivityProvenanceRepo, ProviderActivityRecord } from './activity-provenance-repo';

export class InMemoryActivityProvenanceRepo implements ActivityProvenanceRepo {
  private store = new Map<string, ProviderActivityRecord>();

  async save(record: ProviderActivityRecord): Promise<ProviderActivityRecord> {
    this.store.set(record.id, structuredClone(record));
    return structuredClone(record);
  }

  async getByProviderExternalId(
    userId: string,
    source: Exclude<ActivitySource, 'manual'>,
    externalId: string,
  ): Promise<ProviderActivityRecord | null> {
    for (const record of this.store.values()) {
      if (record.userId === userId && record.source === source && record.externalId === externalId) {
        return structuredClone(record);
      }
    }

    return null;
  }
}
