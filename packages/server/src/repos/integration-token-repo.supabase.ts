import type { SupabaseClient } from '@supabase/supabase-js';
import type { IntegrationToken } from '@steady/types';
import type { IntegrationTokenRepo } from './integration-token-repo';

function rowToIntegrationToken(row: Record<string, unknown>): IntegrationToken {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    provider: row.provider as string,
    encryptedAccessToken: row.encrypted_access_token as string,
    encryptedRefreshToken: row.encrypted_refresh_token as string,
    expiresAt: row.expires_at as string,
    externalAthleteId: (row.external_athlete_id as string) ?? undefined,
    lastSyncedAt: (row.last_synced_at as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

function integrationTokenToRow(token: IntegrationToken): Record<string, unknown> {
  return {
    id: token.id,
    user_id: token.userId,
    provider: token.provider,
    encrypted_access_token: token.encryptedAccessToken,
    encrypted_refresh_token: token.encryptedRefreshToken,
    expires_at: token.expiresAt,
    external_athlete_id: token.externalAthleteId ?? null,
    last_synced_at: token.lastSyncedAt ?? null,
    created_at: token.createdAt,
  };
}

export class SupabaseIntegrationTokenRepo implements IntegrationTokenRepo {
  constructor(private supabase: SupabaseClient) {}

  async get(userId: string, provider: string): Promise<IntegrationToken | null> {
    const { data, error } = await this.supabase
      .from('integration_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', provider)
      .single();

    if (error || !data) return null;
    return rowToIntegrationToken(data);
  }

  async save(token: IntegrationToken): Promise<IntegrationToken> {
    const { data, error } = await this.supabase
      .from('integration_tokens')
      .upsert(integrationTokenToRow(token), { onConflict: 'user_id,provider' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save integration token: ${error.message}`);
    return rowToIntegrationToken(data);
  }

  async delete(userId: string, provider: string): Promise<void> {
    const { error } = await this.supabase
      .from('integration_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('provider', provider);

    if (error) throw new Error(`Failed to delete integration token: ${error.message}`);
  }

  async updateLastSyncedAt(userId: string, provider: string, timestamp: string): Promise<IntegrationToken | null> {
    const { data, error } = await this.supabase
      .from('integration_tokens')
      .update({ last_synced_at: timestamp })
      .eq('user_id', userId)
      .eq('provider', provider)
      .select()
      .single();

    if (error || !data) return null;
    return rowToIntegrationToken(data);
  }
}
