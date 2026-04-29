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
  const totalKm = Number.isFinite(shoe.totalKm) ? shoe.totalKm : 0;

  if (
    shoe.stravaGearId
    && typeof shoe.stravaDistanceKm === 'number'
    && Number.isFinite(shoe.stravaDistanceKm)
  ) {
    return Math.max(shoe.stravaDistanceKm, totalKm);
  }

  return totalKm;
}
