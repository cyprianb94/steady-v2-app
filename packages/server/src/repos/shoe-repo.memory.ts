import type { Activity, Shoe } from '@steady/types';
import type { ActivityRepo } from './activity-repo';
import type { ShoeRepo } from './shoe-repo';

type StoredShoe = Omit<Shoe, 'totalKm'>;

function toShoe(stored: StoredShoe, activities: Activity[]): Shoe {
  const totalKm = Number(
    activities
      .filter((activity) => activity.shoeId === stored.id)
      .reduce((sum, activity) => sum + activity.distance, 0)
      .toFixed(3),
  );

  return {
    ...stored,
    totalKm,
  };
}

export class InMemoryShoeRepo implements ShoeRepo {
  private store = new Map<string, StoredShoe>();

  constructor(private activityRepo: ActivityRepo) {}

  async save(shoe: Omit<Shoe, 'totalKm'> & { totalKm?: number }): Promise<Shoe> {
    const existing = shoe.stravaGearId
      ? await this.getByStravaGearId(shoe.userId, shoe.stravaGearId)
      : null;

    const stored: StoredShoe = {
      ...shoe,
      id: existing?.id ?? shoe.id,
      stravaDistanceKm: shoe.stravaDistanceKm ?? existing?.stravaDistanceKm,
      createdAt: existing?.createdAt ?? shoe.createdAt,
    };

    this.store.set(stored.id, stored);
    const activities = await this.activityRepo.getByUserId(stored.userId);
    return toShoe(stored, activities);
  }

  async listByUserId(userId: string): Promise<Shoe[]> {
    const activities = await this.activityRepo.getByUserId(userId);
    return [...this.store.values()]
      .filter((shoe) => shoe.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((shoe) => toShoe(shoe, activities));
  }

  async getByStravaGearId(userId: string, stravaGearId: string): Promise<Shoe | null> {
    for (const shoe of this.store.values()) {
      if (shoe.userId === userId && shoe.stravaGearId === stravaGearId) {
        const activities = await this.activityRepo.getByUserId(userId);
        return toShoe(shoe, activities);
      }
    }
    return null;
  }
}
