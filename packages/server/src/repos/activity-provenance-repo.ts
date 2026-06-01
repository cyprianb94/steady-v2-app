import type { ActivityRunSubtype, ActivitySource } from '@steady/types';

export interface ProviderActivityRecord {
  id: string;
  userId: string;
  activityId: string;
  source: Exclude<ActivitySource, 'manual'>;
  externalId: string;
  sourceName?: string;
  sourceBundleId?: string;
  sourceDevice?: string;
  runSubtype?: ActivityRunSubtype;
  dataQualityFlags: Record<string, boolean | number | string | null>;
  importedAt: string;
}

export interface ActivityProvenanceRepo {
  save(record: ProviderActivityRecord): Promise<ProviderActivityRecord>;
  getByProviderExternalId(
    userId: string,
    source: Exclude<ActivitySource, 'manual'>,
    externalId: string,
  ): Promise<ProviderActivityRecord | null>;
}
