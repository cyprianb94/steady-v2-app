export interface Shoe {
  id: string;
  userId: string;
  stravaGearId?: string;
  brand: string;
  model: string;
  nickname?: string;
  retired: boolean;
  retireAtKm?: number;
  totalKm: number;
  createdAt: string;
  updatedAt: string;
}
