import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '@steady/types';
import type { ProfileRepo } from './profile-repo';

/** Maps a Supabase row to the User type. */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    createdAt: row.created_at as string,
    stravaAthleteId: (row.strava_athlete_id as string) ?? undefined,
    appleHealthConnected: row.apple_health_connected as boolean,
    garminAthleteId: (row.garmin_athlete_id as string) ?? undefined,
    subscriptionTier: row.subscription_tier as 'free' | 'pro',
    subscriptionExpiresAt: (row.subscription_expires_at as string) ?? undefined,
    timezone: row.timezone as string,
    units: row.units as 'metric' | 'imperial',
  };
}

/** Maps a User to a Supabase row for upsert. */
function userToRow(user: User): Record<string, unknown> {
  return {
    id: user.id,
    email: user.email,
    created_at: user.createdAt,
    strava_athlete_id: user.stravaAthleteId ?? null,
    apple_health_connected: user.appleHealthConnected,
    garmin_athlete_id: user.garminAthleteId ?? null,
    subscription_tier: user.subscriptionTier,
    subscription_expires_at: user.subscriptionExpiresAt ?? null,
    timezone: user.timezone,
    units: user.units,
  };
}

export class SupabaseProfileRepo implements ProfileRepo {
  constructor(private supabase: SupabaseClient) {}

  async getById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToUser(data);
  }

  async upsert(profile: User): Promise<User> {
    const { data, error } = await this.supabase
      .from('users')
      .upsert(userToRow(profile), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to upsert profile: ${error.message}`);
    return rowToUser(data);
  }

  async updateSubscription(id: string, tier: 'free' | 'pro', expiresAt?: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .update({
        subscription_tier: tier,
        subscription_expires_at: expiresAt ?? null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !data) return null;
    return rowToUser(data);
  }
}
