import type { TrainingPlan, PlanWeek } from '@steady/types';
import type { PlanRepo } from './plan-repo';

interface StoredPlan {
  plan: TrainingPlan;
  isActive: boolean;
}

export class InMemoryPlanRepo implements PlanRepo {
  private store = new Map<string, StoredPlan>();

  async getActive(userId: string): Promise<TrainingPlan | null> {
    for (const entry of this.store.values()) {
      if (entry.plan.userId === userId && entry.isActive) {
        return { ...entry.plan, weeks: [...entry.plan.weeks] };
      }
    }
    return null;
  }

  async getAllByUserId(userId: string): Promise<TrainingPlan[]> {
    const results: TrainingPlan[] = [];
    for (const entry of this.store.values()) {
      if (entry.plan.userId === userId) {
        results.push({ ...entry.plan });
      }
    }
    return results;
  }

  async save(plan: TrainingPlan): Promise<TrainingPlan> {
    // Deactivate any existing active plan for this user
    for (const entry of this.store.values()) {
      if (entry.plan.userId === plan.userId && entry.isActive) {
        entry.isActive = false;
      }
    }

    this.store.set(plan.id, { plan: { ...plan, weeks: [...plan.weeks] }, isActive: true });
    return { ...plan };
  }

  async updateWeeks(planId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry) return null;
    entry.plan.weeks = [...weeks];
    return { ...entry.plan };
  }

  async deactivate(planId: string): Promise<void> {
    const entry = this.store.get(planId);
    if (entry) entry.isActive = false;
  }
}
