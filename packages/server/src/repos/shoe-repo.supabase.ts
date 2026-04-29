import type { SupabaseClient } from '@supabase/supabase-js';
import type { Shoe } from '@steady/types';
import type { ShoeRepo } from './shoe-repo';
import { highestFiniteDistanceKm } from './shoe-distance';

function rowToShoe(row: Record<string, unknown>, totalKm = 0): Shoe {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    stravaGearId: (row.strava_gear_id as string) ?? undefined,
    stravaDistanceKm: row.strava_distance_km != null ? Number(row.strava_distance_km) : undefined,
    brand: row.brand as string,
    model: row.model as string,
    nickname: (row.nickname as string) ?? undefined,
    retired: Boolean(row.retired),
    retireAtKm: row.retire_at_km != null ? Number(row.retire_at_km) : undefined,
    totalKm,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export class SupabaseShoeRepo implements ShoeRepo {
  constructor(private supabase: SupabaseClient) {}

  async save(shoe: Omit<Shoe, 'totalKm'> & { totalKm?: number }): Promise<Shoe> {
    const existing = shoe.stravaGearId
      ? await this.getByStravaGearId(shoe.userId, shoe.stravaGearId)
      : null;

    const payload = {
      id: existing?.id ?? shoe.id,
      user_id: shoe.userId,
      strava_gear_id: shoe.stravaGearId ?? null,
      strava_distance_km: highestFiniteDistanceKm(shoe.stravaDistanceKm, existing?.stravaDistanceKm) ?? null,
      brand: shoe.brand,
      model: shoe.model,
      nickname: shoe.nickname ?? null,
      retired: shoe.retired,
      retire_at_km: shoe.retireAtKm ?? null,
      created_at: existing?.createdAt ?? shoe.createdAt,
      updated_at: shoe.updatedAt,
    };

    const { data, error } = await this.supabase
      .from('shoes')
      .upsert(payload, { onConflict: 'id' })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save shoe: ${error.message}`);
    }

    return rowToShoe(data);
  }

  async listByUserId(userId: string): Promise<Shoe[]> {
    const [{ data: shoes, error: shoesError }, { data: activities, error: activitiesError }] = await Promise.all([
      this.supabase
        .from('shoes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
      this.supabase
        .from('activities')
        .select('shoe_id, distance')
        .eq('user_id', userId)
        .not('shoe_id', 'is', null),
    ]);

    if (shoesError || !shoes) return [];
    if (activitiesError) {
      throw new Error(`Failed to load shoe activity totals: ${activitiesError.message}`);
    }

    const totalKmByShoeId = new Map<string, number>();
    for (const activity of activities ?? []) {
      const shoeId = activity.shoe_id as string | null;
      if (!shoeId) continue;
      const nextTotal = (totalKmByShoeId.get(shoeId) ?? 0) + Number(activity.distance ?? 0);
      totalKmByShoeId.set(shoeId, Number(nextTotal.toFixed(3)));
    }

    return shoes.map((shoe) => rowToShoe(shoe, totalKmByShoeId.get(shoe.id as string) ?? 0));
  }

  async getByStravaGearId(userId: string, stravaGearId: string): Promise<Shoe | null> {
    const { data, error } = await this.supabase
      .from('shoes')
      .select('*')
      .eq('user_id', userId)
      .eq('strava_gear_id', stravaGearId)
      .maybeSingle();

    if (error || !data) return null;
    return rowToShoe(data);
  }
}
