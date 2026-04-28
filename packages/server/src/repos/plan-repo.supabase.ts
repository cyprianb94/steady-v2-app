import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TrainingPlan,
  PlanWeek,
  PhaseConfig,
  PlannedSession,
  Injury,
  InjuryUpdate,
  TrainingPaceProfile,
} from '@steady/types';
import {
  normalizePlanWeekSessionDurations,
  normalizeSessionIds,
  normalizeTrainingPlanSessionDurations,
  normalizeTrainingPaceProfile,
} from '@steady/types';
import type { PlanRepo } from './plan-repo';

function createActiveInjury(name: string): Injury {
  return {
    name,
    markedDate: new Date().toISOString().slice(0, 10),
    rtrStep: 0,
    rtrStepCompletedDates: [],
    status: 'recovering',
  };
}

function rowToPlan(row: Record<string, unknown>): TrainingPlan {
  const weeks = normalizeSessionIds(row.weeks as PlanWeek[]);
  return normalizeTrainingPlanSessionDurations({
    id: row.id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as string,
    raceName: row.race_name as string,
    raceDate: row.race_date as string,
    raceDistance: row.race_distance as TrainingPlan['raceDistance'],
    targetTime: row.target_time as string,
    phases: row.phases as PhaseConfig,
    progressionPct: row.progression_pct as number,
    progressionEveryWeeks: (row.progression_every_weeks as number | null) ?? 2,
    templateWeek: row.template_week as (PlannedSession | null)[],
    weeks,
    trainingPaceProfile: normalizeTrainingPaceProfile(row.training_pace_profile),
    activeInjury: (row.active_injury as Injury | null) ?? null,
  });
}

function planToRow(plan: TrainingPlan, isActive: boolean): Record<string, unknown> {
  const normalized = normalizeTrainingPlanSessionDurations(plan);
  return {
    id: normalized.id,
    user_id: normalized.userId,
    created_at: normalized.createdAt,
    race_name: normalized.raceName,
    race_date: normalized.raceDate,
    race_distance: normalized.raceDistance,
    target_time: normalized.targetTime,
    phases: normalized.phases,
    progression_pct: normalized.progressionPct,
    progression_every_weeks: normalized.progressionEveryWeeks ?? 2,
    template_week: normalized.templateWeek,
    weeks: normalized.weeks,
    training_pace_profile: normalizeTrainingPaceProfile(normalized.trainingPaceProfile),
    active_injury: normalized.activeInjury,
    is_active: isActive,
  };
}

export class SupabasePlanRepo implements PlanRepo {
  constructor(private supabase: SupabaseClient) {}

  async getActive(userId: string): Promise<TrainingPlan | null> {
    const { data, error } = await this.supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return rowToPlan(data);
  }

  async getAllByUserId(userId: string): Promise<TrainingPlan[]> {
    const { data, error } = await this.supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map(rowToPlan);
  }

  async save(plan: TrainingPlan): Promise<TrainingPlan> {
    // Deactivate existing active plans for this user
    await this.supabase
      .from('training_plans')
      .update({ is_active: false })
      .eq('user_id', plan.userId)
      .eq('is_active', true);

    const { data, error } = await this.supabase
      .from('training_plans')
      .upsert(planToRow(plan, true), { onConflict: 'id' })
      .select()
      .single();

    if (error) throw new Error(`Failed to save plan: ${error.message}`);
    return rowToPlan(data);
  }

  async updateWeeks(planId: string, weeks: PlanWeek[]): Promise<TrainingPlan | null> {
    const normalizedWeeks = weeks.map(normalizePlanWeekSessionDurations);
    const { data, error } = await this.supabase
      .from('training_plans')
      .update({ weeks: normalizedWeeks })
      .eq('id', planId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToPlan(data);
  }

  async updateTrainingPaceProfile(
    planId: string,
    trainingPaceProfile: TrainingPaceProfile | null,
    weeks?: PlanWeek[],
  ): Promise<TrainingPlan | null> {
    const update: Record<string, unknown> = {
      training_pace_profile: normalizeTrainingPaceProfile(trainingPaceProfile),
    };
    if (weeks) {
      update.weeks = weeks.map(normalizePlanWeekSessionDurations);
    }

    const { data, error } = await this.supabase
      .from('training_plans')
      .update(update)
      .eq('id', planId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToPlan(data);
  }

  async markInjury(planId: string, name: string): Promise<TrainingPlan | null> {
    const { data, error } = await this.supabase
      .from('training_plans')
      .update({ active_injury: createActiveInjury(name) })
      .eq('id', planId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToPlan(data);
  }

  async updateInjury(planId: string, updates: InjuryUpdate): Promise<TrainingPlan | null> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('training_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (fetchError || !existing) return null;

    const currentInjury = (existing.active_injury as Injury | null) ?? null;
    if (!currentInjury) return null;

    const { data, error } = await this.supabase
      .from('training_plans')
      .update({
        active_injury: {
          ...currentInjury,
          ...updates,
        },
      })
      .eq('id', planId)
      .select()
      .single();

    if (error || !data) return null;
    return rowToPlan(data);
  }

  async clearInjury(planId: string): Promise<TrainingPlan | null> {
    return this.updateInjury(planId, {
      status: 'resolved',
      resolvedDate: new Date().toISOString().slice(0, 10),
    });
  }

  async deactivate(planId: string): Promise<void> {
    await this.supabase
      .from('training_plans')
      .update({ is_active: false })
      .eq('id', planId);
  }
}
