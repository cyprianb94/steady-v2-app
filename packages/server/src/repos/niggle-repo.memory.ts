import type { Niggle } from '@steady/types';
import type { ActivityRepo } from './activity-repo';
import type { NiggleInput, NiggleRepo } from './niggle-repo';

export class InMemoryNiggleRepo implements NiggleRepo {
  private store = new Map<string, Niggle[]>();

  constructor(private activityRepo: ActivityRepo) {}

  async setForActivity(activityId: string, niggles: NiggleInput[]): Promise<Niggle[]> {
    const activity = await this.activityRepo.getById(activityId);
    if (!activity) {
      throw new Error(`Activity ${activityId} does not exist`);
    }

    const baseTime = Date.now();
    const stored = niggles.map((niggle, index) => ({
      id: crypto.randomUUID(),
      userId: activity.userId,
      activityId,
      bodyPart: niggle.bodyPart,
      bodyPartOtherText: niggle.bodyPart === 'other' ? niggle.bodyPartOtherText ?? null : undefined,
      severity: niggle.severity,
      when: niggle.when,
      side: niggle.side,
      createdAt: new Date(baseTime + index).toISOString(),
    }));

    this.store.set(activityId, stored);
    return stored.map((niggle) => ({ ...niggle }));
  }

  async listByActivity(activityId: string): Promise<Niggle[]> {
    const activity = await this.activityRepo.getById(activityId);
    if (!activity) {
      this.store.delete(activityId);
      return [];
    }

    return (this.store.get(activityId) ?? []).map((niggle) => ({ ...niggle }));
  }
}
