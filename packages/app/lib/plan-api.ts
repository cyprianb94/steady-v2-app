import {
  getDisplayWeekIndex,
  normalizeSessionIds,
  type PhaseConfig,
  type PhaseName,
  type PlannedSession,
  type PlanWeek,
  type TrainingPlan,
  type TrainingPlanWithAnnotation,
} from '@steady/types';
import { isLikelyNetworkError } from './network-errors';
import { getSupabaseClient } from './supabase';
import { trpc } from './trpc';

const FALLBACK_COACH_NOTE = 'Your plan is ready - build consistency one week at a time.';

const PHASE_FALLBACKS: Record<PhaseName, string> = {
  BASE: 'Building your aerobic foundation - consistency matters more than intensity right now.',
  BUILD: 'Volume is climbing - trust the process and recover well between sessions.',
  RECOVERY: 'Recovery week - volume is intentionally lower. Let your body absorb the work.',
  PEAK: "Peak phase - you're at your sharpest. Focus on execution and quality.",
  TAPER: 'Taper phase - less is more. Stay sharp but keep the legs fresh for race day.',
};

interface TrainingPlanRow {
  id: string;
  user_id: string;
  created_at: string;
  race_name: string;
  race_date: string;
  race_distance: TrainingPlan['raceDistance'];
  target_time: string;
  phases: PhaseConfig;
  progression_pct: number;
  template_week: (PlannedSession | null)[];
  weeks: PlanWeek[];
  active_injury: TrainingPlan['activeInjury'] | null;
}

export interface SavePlanPayload {
  userId: string;
  raceName: string;
  raceDate: string;
  raceDistance: TrainingPlan['raceDistance'];
  targetTime: string;
  phases: PhaseConfig;
  progressionPct: number;
  templateWeek: (PlannedSession | null)[];
  weeks: PlanWeek[];
}

function rowToPlan(row: TrainingPlanRow): TrainingPlan {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    raceName: row.race_name,
    raceDate: row.race_date,
    raceDistance: row.race_distance,
    targetTime: row.target_time,
    phases: row.phases,
    progressionPct: row.progression_pct,
    templateWeek: row.template_week,
    weeks: normalizeSessionIds(row.weeks),
    activeInjury: row.active_injury ?? null,
  };
}

function withFallbackCoachAnnotation(
  plan: TrainingPlan | null,
): TrainingPlanWithAnnotation | null {
  if (!plan) return null;

  const today = new Date().toISOString().slice(0, 10);
  const currentWeek = plan.weeks[getDisplayWeekIndex(plan.weeks, today)];

  return {
    ...plan,
    coachAnnotation: currentWeek
      ? PHASE_FALLBACKS[currentWeek.phase]
      : FALLBACK_COACH_NOTE,
  };
}

function requirePlanSupabaseClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Missing Supabase configuration for plan persistence.');
  }
  return supabase;
}

function validatePlanPayload(payload: SavePlanPayload) {
  const phaseSum = (
    payload.phases.BASE
    + payload.phases.BUILD
    + payload.phases.RECOVERY
    + payload.phases.PEAK
    + payload.phases.TAPER
  );

  if (payload.weeks.length > 0 && phaseSum !== payload.weeks.length) {
    throw new Error(`Phase sum (${phaseSum}) does not match week count (${payload.weeks.length})`);
  }

  for (const week of payload.weeks) {
    if (!week.sessions || week.sessions.length !== 7) {
      throw new Error(`Week ${week.weekNumber} must have exactly 7 session slots`);
    }
  }
}

async function getActivePlanDirect(userId: string): Promise<TrainingPlanWithAnnotation | null> {
  const supabase = requirePlanSupabaseClient();
  const { data, error } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load plan: ${error.message}`);
  }

  return withFallbackCoachAnnotation(data ? rowToPlan(data as TrainingPlanRow) : null);
}

async function savePlanDirect(payload: SavePlanPayload): Promise<TrainingPlan> {
  const supabase = requirePlanSupabaseClient();
  const { data: existing, error: existingError } = await supabase
    .from('training_plans')
    .select('*')
    .eq('user_id', payload.userId)
    .eq('is_active', true)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to prepare plan save: ${existingError.message}`);
  }

  const row = {
    user_id: payload.userId,
    race_name: payload.raceName,
    race_date: payload.raceDate,
    race_distance: payload.raceDistance,
    target_time: payload.targetTime,
    phases: payload.phases,
    progression_pct: payload.progressionPct,
    template_week: payload.templateWeek,
    weeks: payload.weeks,
    is_active: true,
    active_injury: (existing as TrainingPlanRow | null)?.active_injury ?? null,
  };

  const query = existing
    ? supabase
      .from('training_plans')
      .update(row)
      .eq('id', (existing as TrainingPlanRow).id)
      .eq('user_id', payload.userId)
    : supabase
      .from('training_plans')
      .insert(row);

  const { data, error } = await query.select('*').single();

  if (error) {
    throw new Error(`Failed to save plan: ${error.message}`);
  }

  return rowToPlan(data as TrainingPlanRow);
}

export async function getActivePlan(
  userId: string,
): Promise<TrainingPlanWithAnnotation | null> {
  try {
    return await trpc.plan.get.query();
  } catch (error) {
    if (!isLikelyNetworkError(error) || !getSupabaseClient()) {
      throw error;
    }
    return getActivePlanDirect(userId);
  }
}

export async function savePlan(payload: SavePlanPayload): Promise<TrainingPlan> {
  validatePlanPayload(payload);

  try {
    return await trpc.plan.save.mutate({
      raceName: payload.raceName,
      raceDate: payload.raceDate,
      raceDistance: payload.raceDistance,
      targetTime: payload.targetTime,
      phases: payload.phases,
      progressionPct: payload.progressionPct,
      templateWeek: payload.templateWeek,
      weeks: payload.weeks,
    });
  } catch (error) {
    if (!isLikelyNetworkError(error) || !getSupabaseClient()) {
      throw error;
    }
    return savePlanDirect(payload);
  }
}
