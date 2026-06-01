import type { SupabaseClient } from '@supabase/supabase-js';
import type { ActivityRunSubtype, ActivitySource } from '@steady/types';
import type { ActivityProvenanceRepo, ProviderActivityRecord } from './activity-provenance-repo';

function rowToProviderActivityRecord(row: Record<string, unknown>): ProviderActivityRecord {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    activityId: row.activity_id as string,
    source: row.source as Exclude<ActivitySource, 'manual'>,
    externalId: row.external_id as string,
    sourceName: (row.source_name as string) ?? undefined,
    sourceBundleId: (row.source_bundle_id as string) ?? undefined,
    sourceDevice: (row.source_device as string) ?? undefined,
    runSubtype: (row.run_subtype as ActivityRunSubtype) ?? undefined,
    dataQualityFlags: (row.data_quality_flags as ProviderActivityRecord['dataQualityFlags']) ?? {},
    importedAt: row.imported_at as string,
  };
}

function providerActivityRecordToRow(record: ProviderActivityRecord): Record<string, unknown> {
  return {
    id: record.id,
    user_id: record.userId,
    activity_id: record.activityId,
    source: record.source,
    external_id: record.externalId,
    source_name: record.sourceName ?? null,
    source_bundle_id: record.sourceBundleId ?? null,
    source_device: record.sourceDevice ?? null,
    run_subtype: record.runSubtype ?? null,
    data_quality_flags: record.dataQualityFlags,
    imported_at: record.importedAt,
  };
}

export class SupabaseActivityProvenanceRepo implements ActivityProvenanceRepo {
  constructor(private supabase: SupabaseClient) {}

  async save(record: ProviderActivityRecord): Promise<ProviderActivityRecord> {
    const { data, error } = await this.supabase
      .from('provider_activity_records')
      .upsert(providerActivityRecordToRow(record), { onConflict: 'user_id,source,external_id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save activity provenance: ${error.message}`);
    return rowToProviderActivityRecord(data);
  }

  async getByProviderExternalId(
    userId: string,
    source: Exclude<ActivitySource, 'manual'>,
    externalId: string,
  ): Promise<ProviderActivityRecord | null> {
    const { data, error } = await this.supabase
      .from('provider_activity_records')
      .select('*')
      .eq('user_id', userId)
      .eq('source', source)
      .eq('external_id', externalId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load activity provenance: ${error.message}`);
    if (!data) return null;
    return rowToProviderActivityRecord(data);
  }
}
