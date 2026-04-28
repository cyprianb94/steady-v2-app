import {
  normalizePlanWeekSessionDurations,
  normalizeSessionDurations,
  normalizeSessionIds,
  normalizeTrainingPlanSessionDurations,
  normalizeTrainingPaceProfile,
  propagateTrainingPaceProfileUpdate,
  type PhaseConfig,
  type PlannedSession,
  type PlanWeek,
  type TrainingPlan,
  type TrainingPaceProfile,
  type TrainingPlanWithAnnotation,
} from '@steady/types';
import { trpc } from './trpc';
import { getSupabaseClient } from './supabase';
import {
  getScreenshotDemoPlan,
  isScreenshotDemoMode,
} from '../demo/screenshot-demo';
import { todayIsoLocal } from './plan-helpers';

export interface SavePlanInput {
  raceName: string;
  raceDate: string;
  raceDistance: TrainingPlan['raceDistance'];
  targetTime: string;
  phases: PhaseConfig;
  progressionPct: number;
  progressionEveryWeeks?: number;
  trainingPaceProfile?: TrainingPaceProfile | null;
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
    weeks: normalizeSessionIds(row.weeks as PlanWeek[]),
    trainingPaceProfile: normalizeTrainingPaceProfile(row.training_pace_profile),
    activeInjury: (row.active_injury as TrainingPlan['activeInjury']) ?? null,
  });
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

function normalizeTemplateWeek(templateWeek: (PlannedSession | null)[]): (PlannedSession | null)[] {
  return templateWeek.map(normalizeSessionDurations);
}

function normalizeWeeks(weeks: PlanWeek[]): PlanWeek[] {
  return normalizeSessionIds(weeks.map(normalizePlanWeekSessionDurations));
}

function trainingPaceProfileForSave(
  input: SavePlanInput,
  existing: Record<string, unknown> | null,
): TrainingPaceProfile | null {
  if (input.trainingPaceProfile !== undefined) {
    return normalizeTrainingPaceProfile(input.trainingPaceProfile);
  }

  return normalizeTrainingPaceProfile(existing?.training_pace_profile);
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
  const templateWeek = normalizeTemplateWeek(input.templateWeek);
  const weeks = normalizeWeeks(input.weeks);

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
    progression_every_weeks: input.progressionEveryWeeks ?? 2,
    template_week: templateWeek,
    weeks,
    training_pace_profile: trainingPaceProfileForSave(input, existing),
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

async function getTrainingPaceProfileViaSupabase(): Promise<TrainingPaceProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return trpc.plan.getTrainingPaceProfile.query();
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
    .select('training_pace_profile')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load training pace profile: ${error.message}`);
  }

  return normalizeTrainingPaceProfile(data?.training_pace_profile);
}

async function completedSessionIdsViaSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('matched_session_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to load matched activities: ${error.message}`);
  }

  return (Array.isArray(data) ? data : [])
    .map((row) => row.matched_session_id)
    .filter((sessionId): sessionId is string => typeof sessionId === 'string' && sessionId.length > 0);
}

async function saveTrainingPaceProfileViaSupabase(
  trainingPaceProfile: TrainingPaceProfile | null,
): Promise<TrainingPaceProfile | null> {
  const normalizedProfile = normalizeTrainingPaceProfile(trainingPaceProfile);
  const supabase = getSupabaseClient();
  if (!supabase) {
    return trpc.plan.updateTrainingPaceProfile.mutate({
      trainingPaceProfile: normalizedProfile,
    });
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

  const completedSessionIds = await completedSessionIdsViaSupabase(supabase, userId);
  const propagatedPlan = propagateTrainingPaceProfileUpdate(
    rowToPlan(existing),
    normalizedProfile,
    {
      today: todayIsoLocal(),
      completedSessionIds,
    },
  );

  const { data, error } = await supabase
    .from('training_plans')
    .update({
      training_pace_profile: propagatedPlan.trainingPaceProfile,
      weeks: propagatedPlan.weeks,
    })
    .eq('id', existing.id as string)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to save training pace profile: ${error.message}`);
  }

  return normalizeTrainingPaceProfile(data.training_pace_profile);
}

async function updatePlanWeeksViaSupabase(weeks: PlanWeek[]): Promise<TrainingPlan | null> {
  validateWeeks(weeks);
  const normalizedWeeks = normalizeWeeks(weeks);

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
    .update({ weeks: normalizedWeeks })
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

export async function getTrainingPaceProfile(): Promise<TrainingPaceProfile | null> {
  if (isScreenshotDemoMode()) {
    const demoPlan = await getScreenshotDemoPlan();
    return normalizeTrainingPaceProfile(demoPlan.trainingPaceProfile);
  }

  if (__DEV__) {
    return getTrainingPaceProfileViaSupabase();
  }

  return trpc.plan.getTrainingPaceProfile.query();
}

export async function saveTrainingPaceProfile(
  trainingPaceProfile: TrainingPaceProfile | null,
): Promise<TrainingPaceProfile | null> {
  const normalizedProfile = normalizeTrainingPaceProfile(trainingPaceProfile);

  if (isScreenshotDemoMode()) {
    return normalizedProfile;
  }

  if (__DEV__) {
    return saveTrainingPaceProfileViaSupabase(normalizedProfile);
  }

  return trpc.plan.updateTrainingPaceProfile.mutate({
    trainingPaceProfile: normalizedProfile,
  });
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
