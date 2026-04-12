import type { SupabaseClient } from '@supabase/supabase-js';
import type { TrainingPlan, PlanWeek, PhaseConfig, PlannedSession, Injury, InjuryUpdate } from '@steady/types';
import { normalizeSessionIds } from '@steady/types';
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
  return {
    id: row.id as string,
    userId: row.user_id as string,
    createdAt: row.created_at as string,
    raceName: row.race_name as string,
    raceDate: row.race_date as string,
    raceDistance: row.race_distance as TrainingPlan['raceDistance'],
    targetTime: row.target_time as string,
    phases: row.phases as PhaseConfig,
    progressionPct: row.progression_pct as number,
    templateWeek: row.template_week as (PlannedSession | null)[],
    weeks,
    activeInjury: (row.active_injury as Injury | null) ?? null,
  };
}

function planToRow(plan: TrainingPlan, isActive: boolean): Record<string, unknown> {
  return {
    id: plan.id,
    user_id: plan.userId,
    created_at: plan.createdAt,
    race_name: plan.raceName,
    race_date: plan.raceDate,
    race_distance: plan.raceDistance,
    target_time: plan.targetTime,
    phases: plan.phases,
    progression_pct: plan.progressionPct,
    template_week: plan.templateWeek,
    weeks: plan.weeks,
    active_injury: plan.activeInjury,
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
    const { data, error } = await this.supabase
      .from('training_plans')
      .update({ weeks })
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
