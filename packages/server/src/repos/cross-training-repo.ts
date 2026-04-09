import type { CrossTrainingEntry, CrossTrainingLogInput } from '@steady/types';

export interface CrossTrainingRepo {
  log(entry: CrossTrainingLogInput): Promise<CrossTrainingEntry>;
  getForWeek(planId: string, weekStartDate: string): Promise<CrossTrainingEntry[]>;
  getForDateRange(planId: string, startDate: string, endDate: string): Promise<CrossTrainingEntry[]>;
  delete(id: string): Promise<void>;
}
