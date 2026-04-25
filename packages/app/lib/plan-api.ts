import {
  normalizeSessionIds,
  type PhaseConfig,
  type PlannedSession,
  type PlanWeek,
  type TrainingPlan,
  type TrainingPlanWithAnnotation,
} from '@steady/types';
import { trpc } from './trpc';
import { getSupabaseClient } from './supabase';
import {
  getScreenshotDemoPlan,
  isScreenshotDemoMode,
} from '../demo/screenshot-demo';

export interface SavePlanInput {
  raceName: string;
  raceDate: string;
  raceDistance: TrainingPlan['raceDistance'];
  targetTime: string;
  phases: PhaseConfig;
  progressionPct: number;
  templateWeek: (PlannedSession | null)[];
  weeks: PlanWeek[];
}

function validateWeeks(weeks: PlanWeek[]) {
  for (const week of weeks) {
    if (!week.sessions || week.sessions.length !== 7) {
      throw new Error(`Week ${week.weekNumber} must have exactly 7 session slots`);
    }
  }
}

function rowToPlan(row: Record<string, unknown>): TrainingPlan {
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
    weeks: normalizeSessionIds(row.weeks as PlanWeek[]),
    activeInjury: (row.active_injury as TrainingPlan['activeInjury']) ?? null,
  };
}

function withClientAnnotations(plan: TrainingPlan | null): TrainingPlanWithAnnotation | null {
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    todayAnnotation: null,
    coachAnnotation: null,
  };
}

function validateSaveInput(input: SavePlanInput) {
  const phaseSum = input.phases.BASE
    + input.phases.BUILD
    + input.phases.RECOVERY
    + input.phases.PEAK
    + input.phases.TAPER;

  if (input.weeks.length > 0 && phaseSum !== input.weeks.length) {
    throw new Error(`Phase sum (${phaseSum}) does not match week count (${input.weeks.length})`);
  }

  validateWeeks(input.weeks);
}

async function getPlanViaSupabase(): Promise<TrainingPlanWithAnnotation | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return trpc.plan.get.query();
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load plan: ${error.message}`);
  }

  return withClientAnnotations(data ? rowToPlan(data) : null);
}

async function savePlanViaSupabase(input: SavePlanInput): Promise<TrainingPlan> {
  validateSaveInput(input);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return trpc.plan.save.mutate(input);
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const { data: existing, error: existingError } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load existing plan: ${existingError.message}`);
  }

  const row = {
    user_id: userId,
    race_name: input.raceName,
    race_date: input.raceDate,
    race_distance: input.raceDistance,
    target_time: input.targetTime,
    phases: input.phases,
    progression_pct: input.progressionPct,
    template_week: input.templateWeek,
    weeks: input.weeks,
    active_injury: (existing?.active_injury as TrainingPlan['activeInjury']) ?? null,
    is_active: true,
  };

  if (existing) {
    const { data, error } = await supabase
      .from('training_plans')
      .update(row)
      .eq('id', existing.id as string)
      .select('*')
      .single();

    if (error) {
      throw new Error(`Failed to save plan: ${error.message}`);
    }

    return rowToPlan(data);
  }

  const { data, error } = await supabase
    .from('training_plans')
    .insert(row)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to save plan: ${error.message}`);
  }

  return rowToPlan(data);
}

async function updatePlanWeeksViaSupabase(weeks: PlanWeek[]): Promise<TrainingPlan | null> {
  validateWeeks(weeks);

  const supabase = getSupabaseClient();
  if (!supabase) {
    return trpc.plan.updateWeeks.mutate({ weeks });
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw sessionError;
  }

  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const { data: existing, error: existingError } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load existing plan: ${existingError.message}`);
  }

  if (!existing) {
    return null;
  }

  const { data, error } = await supabase
    .from('training_plans')
    .update({ weeks })
    .eq('id', existing.id as string)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update plan weeks: ${error.message}`);
  }

  return rowToPlan(data);
}

export async function getPlan(): Promise<TrainingPlanWithAnnotation | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  if (__DEV__) {
    return getPlanViaSupabase();
  }

  return trpc.plan.get.query();
}

export async function savePlan(input: SavePlanInput): Promise<TrainingPlan> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  if (__DEV__) {
    return savePlanViaSupabase(input);
  }

  return trpc.plan.save.mutate(input);
}

export async function updatePlanWeeks(weeks: PlanWeek[]): Promise<TrainingPlan | null> {
  if (isScreenshotDemoMode()) {
    return getScreenshotDemoPlan();
  }

  if (__DEV__) {
    return updatePlanWeeksViaSupabase(weeks);
  }

  return trpc.plan.updateWeeks.mutate({ weeks });
}
