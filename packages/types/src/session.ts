export type SessionType = 'EASY' | 'INTERVAL' | 'TEMPO' | 'LONG' | 'REST';
export type SubjectiveLegs = 'fresh' | 'normal' | 'heavy' | 'dead';
export type SubjectiveBreathing = 'easy' | 'controlled' | 'labored';
export type SubjectiveOverall = 'could-go-again' | 'done' | 'shattered';
export type SessionDurationUnit = 'km' | 'min';

export interface SessionDurationSpec {
  unit: SessionDurationUnit;
  value: number;
}

export interface SubjectiveInput {
  legs: SubjectiveLegs;
  breathing: SubjectiveBreathing;
  overall: SubjectiveOverall;
}

export interface PlannedSession {
  id: string;
  type: SessionType;
  date: string; // ISO date 'YYYY-MM-DD'

  // EASY, TEMPO, LONG
  distance?: number; // km
  pace?: string; // 'M:SS' format e.g. '4:20'

  // INTERVAL
  reps?: number;
  repDist?: number; // metres e.g. 800
  recovery?: RecoveryDuration;

  // Optional easy-effort volume before/after the main set.
  warmup?: SessionDurationSpec;
  cooldown?: SessionDurationSpec;

  // Linked actual activity
  actualActivityId?: string;

  // Post-session subjective check-in
  subjectiveInput?: SubjectiveInput;
  subjectiveInputDismissed?: boolean;
}

export type RecoveryDuration = '45s' | '60s' | '90s' | '2min' | '3min' | '4min' | '5min';

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

export const RECOVERY_KM: Record<RecoveryDuration, number> = {
  '45s': 0.14,
  '60s': 0.18,
  '90s': 0.27,
  '2min': 0.36,
  '3min': 0.55,
  '4min': 0.73,
  '5min': 0.91,
};
