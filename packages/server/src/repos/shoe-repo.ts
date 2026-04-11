import type { Shoe } from '@steady/types';

export interface ShoeRepo {
  save(shoe: Omit<Shoe, 'totalKm'> & { totalKm?: number }): Promise<Shoe>;
  listByUserId(userId: string): Promise<Shoe[]>;
  getByStravaGearId(userId: string, stravaGearId: string): Promise<Shoe | null>;
}
