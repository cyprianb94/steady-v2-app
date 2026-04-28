export type SessionType = 'EASY' | 'INTERVAL' | 'TEMPO' | 'LONG' | 'REST';
export type SubjectiveLegs = 'fresh' | 'normal' | 'heavy' | 'dead';
export type SubjectiveBreathing = 'easy' | 'controlled' | 'labored';
export type SubjectiveOverall = 'could-go-again' | 'done' | 'shattered';
export type SessionDurationUnit = 'km' | 'min';
export type SkippedSessionReason = 'tired' | 'ill' | 'busy' | 'sore' | 'other';

export const INTENSITY_TARGET_SOURCES = ['profile', 'manual'] as const;
export const INTENSITY_TARGET_MODES = ['pace', 'effort', 'both'] as const;
export const TRAINING_PACE_PROFILE_KEYS = [
  'recovery',
  'easy',
  'steady',
  'marathon',
  'threshold',
  'interval',
] as const;
export const EFFORT_CUES = [
  'very easy',
  'conversational',
  'steady',
  'race pace',
  'controlled hard',
  'hard repeatable',
  'sharp',
] as const;

export type IntensityTargetSource = typeof INTENSITY_TARGET_SOURCES[number];
export type IntensityTargetMode = typeof INTENSITY_TARGET_MODES[number];
export type TrainingPaceProfileKey = typeof TRAINING_PACE_PROFILE_KEYS[number];
export type EffortCue = typeof EFFORT_CUES[number];

export interface PaceRange {
  min: string;
  max: string;
}

export interface IntensityTarget {
  source: IntensityTargetSource;
  mode: IntensityTargetMode;
  profileKey?: TrainingPaceProfileKey;
  pace?: string;
  paceRange?: PaceRange;
  effortCue?: EffortCue;
}

export interface SessionDurationSpec {
  unit: SessionDurationUnit;
  value: number;
}

export interface SubjectiveInput {
  legs: SubjectiveLegs;
  breathing: SubjectiveBreathing;
  overall: SubjectiveOverall;
}

export interface SkippedSession {
  reason: SkippedSessionReason;
  markedAt: string;
}

export interface PlannedSession {
  id: string;
  type: SessionType;
  date: string; // ISO date 'YYYY-MM-DD'

  // EASY, TEMPO, LONG
  distance?: number; // km
  pace?: string; // 'M:SS' format e.g. '4:20'
  intensityTarget?: IntensityTarget;

  // INTERVAL
  reps?: number;
  repDist?: number; // metres e.g. 800
  repDuration?: SessionDurationSpec;
  recovery?: IntervalRecovery;

  // Optional easy-effort volume before/after workout sessions.
  warmup?: SessionDurationSpec;
  cooldown?: SessionDurationSpec;

  // Linked actual activity
  actualActivityId?: string;

  // Post-session subjective check-in
  subjectiveInput?: SubjectiveInput;
  subjectiveInputDismissed?: boolean;

  // Runner explicitly marked a planned session as skipped.
  skipped?: SkippedSession;
}

export type RecoveryDuration = '45s' | '60s' | '90s' | '2min' | '3min' | '4min' | '5min';
export type IntervalRecovery = RecoveryDuration | SessionDurationSpec;

export function normalizeSessionDuration(
  value: SessionDurationSpec | number | null | undefined,
): SessionDurationSpec | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value === 'number') {
    return value > 0 ? { unit: 'km', value } : undefined;
  }

  if (typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0) {
    return undefined;
  }

  return {
    unit: value.unit === 'min' ? 'min' : 'km',
    value: value.value,
  };
}

export function sessionDurationKm(
  value: SessionDurationSpec | number | null | undefined,
): number {
  const normalized = normalizeSessionDuration(value);
  return normalized?.unit === 'km' ? normalized.value : 0;
}

export function sessionSupportsWarmupCooldown(type: SessionType): boolean {
  return type === 'INTERVAL' || type === 'TEMPO';
}

export const RECOVERY_KM: Record<RecoveryDuration, number> = {
  '45s': 0.14,
  '60s': 0.18,
  '90s': 0.27,
  '2min': 0.36,
  '3min': 0.55,
  '4min': 0.73,
  '5min': 0.91,
};

export const RECOVERY_KM_PER_MIN = 0.18;
