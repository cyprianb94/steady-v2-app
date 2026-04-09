import type { TrainingPlan, PlanWeek, InjuryUpdate } from '@steady/types';

export interface PlanRepo {
  getActive(userId: string): Promise<TrainingPlan | null>;
  getAllByUserId(userId: string): Promise<TrainingPlan[]>;
  save(plan: TrainingPlan): Promise<TrainingPlan>;
  updateWeeks(planId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null>;
  markInjury(planId: string, name: string): Promise<TrainingPlan | null>;
  updateInjury(planId: string, updates: InjuryUpdate): Promise<TrainingPlan | null>;
  clearInjury(planId: string): Promise<TrainingPlan | null>;
  deactivate(planId: string): Promise<void>;
}
