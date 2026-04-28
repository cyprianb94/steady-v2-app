import type { TrainingPlan, PlanWeek, Injury, InjuryUpdate, TrainingPaceProfile } from '@steady/types';
import {
  normalizeSessionIds,
  normalizePlanWeekSessionDurations,
  normalizeTrainingPlanSessionDurations,
  normalizeTrainingPaceProfile,
} from '@steady/types';
import type { PlanRepo } from './plan-repo';

interface StoredPlan {
  plan: TrainingPlan;
  isActive: boolean;
}

function clonePlan(plan: TrainingPlan): TrainingPlan {
  return structuredClone(plan);
}

function normalizePlanForStorage(plan: TrainingPlan): TrainingPlan {
  return normalizeTrainingPlanSessionDurations({
    ...plan,
    trainingPaceProfile: normalizeTrainingPaceProfile(plan.trainingPaceProfile),
    weeks: normalizeSessionIds(plan.weeks),
  });
}

function createActiveInjury(name: string): Injury {
  return {
    name,
    markedDate: new Date().toISOString().slice(0, 10),
    rtrStep: 0,
    rtrStepCompletedDates: [],
    status: 'recovering',
  };
}

export class InMemoryPlanRepo implements PlanRepo {
  private store = new Map<string, StoredPlan>();

  async getActive(userId: string): Promise<TrainingPlan | null> {
    for (const entry of this.store.values()) {
      if (entry.plan.userId === userId && entry.isActive) {
        return clonePlan(entry.plan);
      }
    }
    return null;
  }

  async getAllByUserId(userId: string): Promise<TrainingPlan[]> {
    const results: TrainingPlan[] = [];
    for (const entry of this.store.values()) {
      if (entry.plan.userId === userId) {
        results.push(clonePlan(entry.plan));
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

    const normalized = normalizePlanForStorage(plan);
    this.store.set(plan.id, { plan: clonePlan(normalized), isActive: true });
    return clonePlan(normalized);
  }

  async updateWeeks(planId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry) return null;
    entry.plan.weeks = structuredClone(weeks.map(normalizePlanWeekSessionDurations));
    return clonePlan(entry.plan);
  }

  async updateTrainingPaceProfile(
    planId: string,
    trainingPaceProfile: TrainingPaceProfile | null,
    weeks?: PlanWeek[],
  ): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry) return null;
    entry.plan.trainingPaceProfile = normalizeTrainingPaceProfile(trainingPaceProfile);
    if (weeks) {
      entry.plan.weeks = structuredClone(weeks.map(normalizePlanWeekSessionDurations));
    }
    return clonePlan(entry.plan);
  }

  async markInjury(planId: string, name: string): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry) return null;

    entry.plan.activeInjury = createActiveInjury(name);
    return clonePlan(entry.plan);
  }

  async updateInjury(planId: string, updates: InjuryUpdate): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry || !entry.plan.activeInjury) return null;

    entry.plan.activeInjury = {
      ...entry.plan.activeInjury,
      ...structuredClone(updates),
    };
    return clonePlan(entry.plan);
  }

  async clearInjury(planId: string): Promise<TrainingPlan | null> {
    const entry = this.store.get(planId);
    if (!entry || !entry.plan.activeInjury) return null;

    entry.plan.activeInjury = {
      ...entry.plan.activeInjury,
      status: 'resolved',
      resolvedDate: new Date().toISOString().slice(0, 10),
    };
    return clonePlan(entry.plan);
  }

  async deactivate(planId: string): Promise<void> {
    const entry = this.store.get(planId);
    if (entry) entry.isActive = false;
  }
}
