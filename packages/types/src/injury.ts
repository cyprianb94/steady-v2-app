export const CROSS_TRAINING_TYPES = [
  'Cycling',
  'Swimming',
  'Strength',
  'Yoga',
  'Walking',
  'Elliptical',
] as const;

export type CrossTrainingType = (typeof CROSS_TRAINING_TYPES)[number];

export interface Injury {
  name: string;
  markedDate: string; // ISO date 'YYYY-MM-DD'
  reassessedTarget?: string;
  rtrStep: number;
  rtrStepCompletedDates: string[];
  status: 'recovering' | 'returning' | 'resolved';
  resolvedDate?: string;
}

export interface CrossTrainingEntry {
  id: string;
  userId: string;
  planId: string;
  date: string; // ISO date 'YYYY-MM-DD'
  type: CrossTrainingType;
  durationMinutes: number;
  createdAt: string;
}

export interface CrossTrainingLogInput {
  userId: string;
  planId: string;
  date: string; // ISO date 'YYYY-MM-DD'
  type: CrossTrainingType;
  durationMinutes: number;
}

export interface InjuryUpdate {
  reassessedTarget?: string;
  rtrStep?: number;
  rtrStepCompletedDates?: string[];
  resolvedDate?: string;
  status?: Injury['status'];
}
