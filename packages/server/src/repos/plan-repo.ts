import type { TrainingPlan, PlanWeek } from '@steady/types';

export interface PlanRepo {
  getActive(userId: string): Promise<TrainingPlan | null>;
  getAllByUserId(userId: string): Promise<TrainingPlan[]>;
  save(plan: TrainingPlan): Promise<TrainingPlan>;
  updateWeeks(planId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null>;
  deactivate(planId: string): Promise<void>;
}
