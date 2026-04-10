import type { CrossTrainingEntry, CrossTrainingLogInput } from '@steady/types';
import type { CrossTrainingRepo } from './cross-training-repo';

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export class InMemoryCrossTrainingRepo implements CrossTrainingRepo {
  private store = new Map<string, CrossTrainingEntry>();

  async log(entry: CrossTrainingLogInput): Promise<CrossTrainingEntry> {
    const stored: CrossTrainingEntry = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      ...entry,
    };
    this.store.set(stored.id, stored);
    return { ...stored };
  }

  async getForWeek(planId: string, weekStartDate: string): Promise<CrossTrainingEntry[]> {
    return this.getForDateRange(planId, weekStartDate, addDays(weekStartDate, 6));
  }

  async getForDateRange(planId: string, startDate: string, endDate: string): Promise<CrossTrainingEntry[]> {
    const results: CrossTrainingEntry[] = [];

    for (const entry of this.store.values()) {
      if (entry.planId !== planId) continue;
      if (entry.date < startDate || entry.date > endDate) continue;
      results.push({ ...entry });
    }

    results.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
    return results;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
