import {
  defaultIntensityTargetForSessionType,
  getOrderedTrainingPaceProfileBands,
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  normalizeSessionIntensityTarget,
  normalizeTrainingPaceProfile,
  representativePace,
  trainingPaceBandToIntensityTarget,
  type IntensityTarget,
  type PaceRange,
  type PlannedSession,
  type SessionType,
  type TrainingPaceProfile,
  type TrainingPaceProfileBand,
  type TrainingPaceProfileKey,
} from '@steady/types';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';
import type { DistanceUnits } from '../../lib/units';

export type SessionEditorResult = Partial<PlannedSession> | null;

const PROFILE_KEYS_BY_SESSION_TYPE: Partial<Record<SessionType, TrainingPaceProfileKey[]>> = {
  EASY: ['recovery', 'easy', 'steady'],
  LONG: ['recovery', 'easy', 'steady', 'marathon'],
  TEMPO: ['threshold', 'marathon'],
  INTERVAL: ['interval'],
};

const DEFAULT_PROFILE_KEY_BY_SESSION_TYPE: Partial<Record<SessionType, TrainingPaceProfileKey>> = {
  EASY: 'easy',
  LONG: 'easy',
  TEMPO: 'threshold',
  INTERVAL: 'interval',
};

interface EditedSessionFallback {
  id: string;
  date: string;
  type: PlannedSession['type'];
}

interface PlannedSessionEditFingerprint {
  type: PlannedSession['type'] | 'REST';
  distance?: number;
  pace?: string;
  intensityTarget?: {
    source: IntensityTarget['source'];
    mode?: IntensityTarget['mode'];
    profileKey?: TrainingPaceProfileKey;
    pace?: string;
    paceRange?: PaceRange;
    effortCue?: IntensityTarget['effortCue'];
  };
  reps?: number;
  repDist?: number;
  repDuration?: PlannedSession['repDuration'];
  recovery?: PlannedSession['recovery'];
  warmup?: PlannedSession['warmup'];
  cooldown?: PlannedSession['cooldown'];
}

function firstRouteParamValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return typeof value === 'string' && value.length > 0 ? value : null;
}

function profileBandForKey(
  profile: TrainingPaceProfile,
  profileKey: TrainingPaceProfileKey,
): TrainingPaceProfileBand | undefined {
  return profile.bands[profileKey];
}

function defaultProfileKeyForSessionType(type: SessionType): TrainingPaceProfileKey | undefined {
  return DEFAULT_PROFILE_KEY_BY_SESSION_TYPE[type];
}

function preferredProfileKeyForSession(
  session: Partial<PlannedSession>,
  profile: TrainingPaceProfile,
): TrainingPaceProfileKey | undefined {
  const target = normalizeIntensityTarget(session.intensityTarget, {
    fallbackPace: session.pace,
  });
  const targetKey = target?.profileKey;
  if (targetKey && profile.bands[targetKey]) {
    return targetKey;
  }

  return session.type ? defaultProfileKeyForSessionType(session.type) : undefined;
}

function preserveSessionStatusFields(
  existing: PlannedSession | null | undefined,
): Partial<PlannedSession> {
  if (!existing) {
    return {};
  }

  const preserved: Partial<PlannedSession> = {};
  if (existing.actualActivityId) preserved.actualActivityId = existing.actualActivityId;
  if (existing.subjectiveInput) preserved.subjectiveInput = existing.subjectiveInput;
  if (existing.subjectiveInputDismissed != null) {
    preserved.subjectiveInputDismissed = existing.subjectiveInputDismissed;
  }
  if (existing.skipped) preserved.skipped = existing.skipped;

  return preserved;
}

function stripUndefinedSessionFields(session: PlannedSession): PlannedSession {
  const next = { ...session };
  const fields = next as Record<string, unknown>;
  for (const key of Object.keys(fields)) {
    if (fields[key] === undefined) {
      delete fields[key];
    }
  }

  return next;
}

export function parseTrainingPaceProfileRouteParam(
  value: string | string[] | undefined,
): TrainingPaceProfile | null {
  const raw = firstRouteParamValue(value);
  if (!raw) {
    return null;
  }

  try {
    return normalizeTrainingPaceProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getSessionEditorProfileBands(
  type: SessionType,
  profile: TrainingPaceProfile | null | undefined,
  currentTarget?: IntensityTarget | null,
): TrainingPaceProfileBand[] {
  if (!profile) {
    return [];
  }

  const currentProfileKey = normalizeIntensityTarget(currentTarget)?.profileKey;
  const keys = [...(PROFILE_KEYS_BY_SESSION_TYPE[type] ?? [])];
  if (currentProfileKey && !keys.includes(currentProfileKey)) {
    keys.push(currentProfileKey);
  }
  const bandsByKey = new Map(
    getOrderedTrainingPaceProfileBands(profile).map((band) => [band.profileKey, band]),
  );

  return keys
    .map((key) => bandsByKey.get(key))
    .filter((band): band is TrainingPaceProfileBand => Boolean(band));
}

export function intensityTargetForTrainingPaceProfileKey(
  profile: TrainingPaceProfile | null | undefined,
  profileKey: TrainingPaceProfileKey | null | undefined,
): IntensityTarget | undefined {
  if (!profile || !profileKey) {
    return undefined;
  }

  const band = profileBandForKey(profile, profileKey);
  return band ? trainingPaceBandToIntensityTarget(band) : undefined;
}

export function defaultSessionEditorIntensityTarget(
  type: SessionType,
  profile: TrainingPaceProfile | null | undefined,
): IntensityTarget | undefined {
  const profileTarget = intensityTargetForTrainingPaceProfileKey(
    profile,
    defaultProfileKeyForSessionType(type),
  );

  return profileTarget ?? defaultIntensityTargetForSessionType(type);
}

export function initialSessionEditorIntensityTarget(
  session: Partial<PlannedSession> | null | undefined,
  type: SessionType,
  profile: TrainingPaceProfile | null | undefined,
): IntensityTarget | undefined {
  if (session && session.type !== 'REST') {
    const existingTarget = normalizeIntensityTarget(session.intensityTarget, {
      fallbackPace: session.pace,
    });
    if (existingTarget) {
      return existingTarget;
    }
  }

  return defaultSessionEditorIntensityTarget(type, profile);
}

export function manualPaceIntensityTarget(pace: string | null | undefined): IntensityTarget | undefined {
  const normalized = normalizePace(pace);
  return normalized
    ? {
        source: 'manual',
        mode: 'pace',
        pace: normalized,
      }
    : undefined;
}

export function manualPaceRangeIntensityTarget(
  paceRange: PaceRange | null | undefined,
): IntensityTarget | undefined {
  const normalized = normalizePaceRange(paceRange);
  return normalized
    ? {
        source: 'manual',
        mode: 'pace',
        paceRange: normalized,
      }
    : undefined;
}

export function targetRepresentativePace(
  target: IntensityTarget | null | undefined,
  fallbackPace?: string | null,
): string | undefined {
  return representativePace(normalizeIntensityTarget(target))
    ?? normalizePace(fallbackPace);
}

export function applyTrainingPaceProfileTarget(
  session: Partial<PlannedSession> | null,
  profile: TrainingPaceProfile | null | undefined,
): Partial<PlannedSession> | null {
  if (!session || session.type === 'REST' || !profile) {
    return session;
  }

  const profileKey = preferredProfileKeyForSession(session, profile);
  const target = intensityTargetForTrainingPaceProfileKey(profile, profileKey);
  if (!target) {
    return session;
  }

  return {
    ...session,
    pace: targetRepresentativePace(target, session.pace) ?? session.pace,
    intensityTarget: target,
  };
}

export function normalizeSessionEditorResult(
  updated: SessionEditorResult,
): Partial<PlannedSession> | null {
  if (!updated || updated.type === 'REST') {
    return null;
  }

  return updated;
}

export function buildSessionEditDescription(
  dayIndex: number,
  updated: SessionEditorResult,
  units: DistanceUnits,
): string {
  const normalized = normalizeSessionEditorResult(updated);
  return normalized
    ? `${DAYS[dayIndex]} → ${sessionLabel(normalized, units)}`
    : `${DAYS[dayIndex]} → Rest`;
}

export function materializeEditedSession(
  existing: PlannedSession | null,
  updated: SessionEditorResult,
  fallback: EditedSessionFallback,
): PlannedSession | null {
  const normalized = normalizeSessionEditorResult(updated);
  if (!normalized) {
    return null;
  }

  const typeChanged = Boolean(
    existing?.type
    && normalized.type
    && normalized.type !== existing.type,
  );
  const existingBase = typeChanged
    ? preserveSessionStatusFields(existing)
    : (existing ?? {});

  return stripUndefinedSessionFields(normalizeSessionIntensityTarget({
    ...existingBase,
    ...normalized,
    id: existing?.id ?? fallback.id,
    date: existing?.date ?? fallback.date,
    type: normalized.type ?? existing?.type ?? fallback.type,
  } as PlannedSession));
}

function intensityTargetFingerprint(
  target: IntensityTarget | null | undefined,
): PlannedSessionEditFingerprint['intensityTarget'] | undefined {
  const normalized = normalizeIntensityTarget(target);
  if (!normalized) {
    return undefined;
  }

  if (normalized.source === 'profile') {
    return {
      source: 'profile',
      profileKey: normalized.profileKey,
    };
  }

  return {
    source: normalized.source,
    mode: normalized.mode,
    profileKey: normalized.profileKey,
    pace: normalized.pace,
    paceRange: normalized.paceRange,
    effortCue: normalized.effortCue,
  };
}

function plannedSessionEditFingerprint(
  session: PlannedSession | null,
): PlannedSessionEditFingerprint {
  if (!session || session.type === 'REST') {
    return { type: 'REST' };
  }

  const normalized = normalizeSessionIntensityTarget(session);
  const fingerprint: PlannedSessionEditFingerprint = {
    type: normalized.type,
    intensityTarget: intensityTargetFingerprint(normalized.intensityTarget),
  };

  if (normalized.distance != null) fingerprint.distance = normalized.distance;
  if (normalized.pace != null) fingerprint.pace = normalized.pace;
  if (normalized.reps != null) fingerprint.reps = normalized.reps;
  if (normalized.repDist != null) fingerprint.repDist = normalized.repDist;
  if (normalized.repDuration != null) fingerprint.repDuration = normalized.repDuration;
  if (normalized.recovery != null) fingerprint.recovery = normalized.recovery;
  if (normalized.warmup != null) fingerprint.warmup = normalized.warmup;
  if (normalized.cooldown != null) fingerprint.cooldown = normalized.cooldown;

  return fingerprint;
}

export function hasMaterialSessionEdit(
  existing: PlannedSession | null,
  updated: SessionEditorResult,
  fallback: EditedSessionFallback,
): boolean {
  const materialized = materializeEditedSession(existing, updated, fallback);
  return JSON.stringify(plannedSessionEditFingerprint(existing))
    !== JSON.stringify(plannedSessionEditFingerprint(materialized));
}
