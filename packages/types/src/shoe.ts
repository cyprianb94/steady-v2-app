export interface Shoe {
  id: string;
  userId: string;
  stravaGearId?: string;
  stravaDistanceKm?: number;
  brand: string;
  model: string;
  nickname?: string;
  retired: boolean;
  retireAtKm?: number;
  totalKm: number;
  createdAt: string;
  updatedAt: string;
}

export function shoeLifetimeKm(
  shoe: Pick<Shoe, 'stravaGearId' | 'stravaDistanceKm' | 'totalKm'>,
): number {
  if (
    shoe.stravaGearId
    && typeof shoe.stravaDistanceKm === 'number'
    && Number.isFinite(shoe.stravaDistanceKm)
  ) {
    return shoe.stravaDistanceKm;
  }

  return shoe.totalKm;
}
