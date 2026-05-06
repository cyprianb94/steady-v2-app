import {
  defaultIntensityTargetForSessionType,
  getOrderedTrainingPaceProfileBands,
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  normalizeSessionIntensityTarget,
  sessionSupportsWarmupCooldown,
  normalizeTrainingPaceProfile,
  representativePace,
  trainingPaceBandToIntensityTarget,
  weekKm,
  type IntensityTarget,
  type PaceRange,
  type PlannedSession,
  type PlanWeek,
  type SessionDurationSpec,
  type SessionDurationUnit,
  type SessionType,
  type TrainingPaceProfile,
  type TrainingPaceProfileBand,
  type TrainingPaceProfileKey,
} from '@steady/types';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';
import { firstRouteParamValue } from '../../lib/route-params';
import type { DistanceUnits } from '../../lib/units';

export type SessionEditorResult = (Partial<PlannedSession> & {
  clearPlannedVolume?: boolean;
  clearRunStructure?: boolean;
}) | null;

export interface SessionEditorDurationState {
  unit: SessionDurationUnit;
  value: number | null;
}

export interface BuildSimpleSessionEditorSaveInput {
  type: SessionType;
  distance: number;
  plannedMinutes: number;
  reps: number;
  repDuration: SessionEditorDurationState;
  recovery: SessionEditorDurationState;
  warmup: SessionEditorDurationState;
  cooldown: SessionEditorDurationState;
  pace: string;
  intensityTarget?: IntensityTarget;
  planNote: string;
  structureClearPending: boolean;
}

const PROFILE_KEYS_BY_SESSION_TYPE: Partial<Record<SessionType, TrainingPaceProfileKey[]>> = {
  EASY: ['recovery', 'easy', 'steady'],
  RECOVERY: ['recovery', 'easy'],
  LONG: ['recovery', 'easy', 'steady', 'marathon'],
  TEMPO: ['threshold', 'marathon'],
  INTERVAL: ['interval'],
};

const DEFAULT_PROFILE_KEY_BY_SESSION_TYPE: Partial<Record<SessionType, TrainingPaceProfileKey>> = {
  EASY: 'easy',
  RECOVERY: 'recovery',
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
  format?: PlannedSession['format'];
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
  plannedVolume?: PlannedSession['plannedVolume'];
  planNote?: PlannedSession['planNote'];
  runStructure?: PlannedSession['runStructure'];
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
      if (existingTarget.source === 'profile' && existingTarget.profileKey) {
        return intensityTargetForTrainingPaceProfileKey(profile, existingTarget.profileKey)
          ?? existingTarget;
      }

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

export function sessionEditorDurationSpec(
  state: SessionEditorDurationState,
): SessionDurationSpec | undefined {
  return state.value != null && state.value > 0
    ? { unit: state.unit, value: state.value }
    : undefined;
}

export function buildSimpleSessionEditorSave({
  type,
  distance,
  plannedMinutes,
  reps,
  repDuration,
  recovery,
  warmup,
  cooldown,
  pace,
  intensityTarget,
  planNote,
  structureClearPending,
}: BuildSimpleSessionEditorSaveInput): SessionEditorResult {
  const isRest = type === 'REST';
  const isRecovery = type === 'RECOVERY';
  const trimmedPlanNote = planNote.trim();
  const structureClearFields = structureClearPending
    ? {
        clearRunStructure: true,
        clearPlannedVolume: !isRecovery,
      }
    : {};

  if (isRest) {
    return {
      type: 'REST',
      format: 'simple',
      planNote: trimmedPlanNote.length > 0 ? trimmedPlanNote : undefined,
      ...structureClearFields,
    };
  }

  const targetForSave = intensityTarget ?? manualPaceIntensityTarget(pace);
  const session: Partial<PlannedSession> = {
    type,
    format: 'simple',
    ...structureClearFields,
  };
  if (!isRecovery) {
    session.pace = pace;
  }
  if (targetForSave) {
    session.intensityTarget = targetForSave;
  }
  session.planNote = trimmedPlanNote.length > 0 ? trimmedPlanNote : undefined;
  if (isRecovery) {
    session.plannedVolume = { unit: 'min', value: plannedMinutes };
    return session;
  }

  if (sessionSupportsWarmupCooldown(type)) {
    session.warmup = sessionEditorDurationSpec(warmup);
    session.cooldown = sessionEditorDurationSpec(cooldown);
  }

  if (type === 'INTERVAL') {
    const repDurationSpec = sessionEditorDurationSpec(repDuration);
    const recoverySpec = sessionEditorDurationSpec(recovery);
    const intervalFields: Partial<PlannedSession> = {
      reps,
      repDist: undefined,
      repDuration: repDurationSpec,
      recovery: recoverySpec,
    };

    if (repDuration.unit === 'km' && repDuration.value != null) {
      intervalFields.repDist = Math.round(repDuration.value * 1000);
    }

    Object.assign(session, intervalFields);
  } else {
    Object.assign(session, { distance });
  }

  return session;
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

  if (session.type === 'RECOVERY') {
    const { pace: _pace, ...sessionWithoutPace } = session;
    return {
      ...sessionWithoutPace,
      intensityTarget: target,
    };
  }

  return {
    ...session,
    pace: targetRepresentativePace(target, session.pace) ?? session.pace,
    intensityTarget: target,
  };
}

export function resolveProfileLinkedSessionTarget(
  session: PlannedSession | null,
  profile: TrainingPaceProfile | null | undefined,
  options: { today?: string } = {},
): PlannedSession | null {
  if (!session || session.type === 'REST' || !profile) {
    return session;
  }

  if (session.actualActivityId || (options.today && session.date <= options.today)) {
    return session;
  }

  const existingTarget = normalizeIntensityTarget(session.intensityTarget);
  if (existingTarget?.source !== 'profile' || !existingTarget.profileKey) {
    return session;
  }

  const target = intensityTargetForTrainingPaceProfileKey(profile, existingTarget.profileKey);
  if (!target) {
    return session;
  }

  return normalizeSessionIntensityTarget({
    ...session,
    intensityTarget: target,
  });
}

export function resolveProfileLinkedWeekTargets(
  week: PlanWeek,
  profile: TrainingPaceProfile | null | undefined,
  options: { today?: string } = {},
): PlanWeek {
  const sessions = week.sessions.map((session) => (
    resolveProfileLinkedSessionTarget(session, profile, options)
  ));

  return {
    ...week,
    sessions,
    plannedKm: weekKm(sessions),
  };
}

export function normalizeSessionEditorResult(
  updated: SessionEditorResult,
): SessionEditorResult {
  if (!updated) {
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

  const {
    clearPlannedVolume,
    clearRunStructure,
    ...normalizedSession
  } = normalized;
  const typeChanged = Boolean(
    existing?.type
    && normalizedSession.type
    && normalizedSession.type !== existing.type,
  );
  const existingBase = typeChanged
    ? preserveSessionStatusFields(existing)
    : (existing ?? {});
  const merged = {
    ...existingBase,
    ...normalizedSession,
    id: existing?.id ?? fallback.id,
    date: existing?.date ?? fallback.date,
    type: normalizedSession.type ?? existing?.type ?? fallback.type,
  } as PlannedSession;

  if (merged.format === 'simple') {
    delete merged.runStructure;
    if (merged.type !== 'RECOVERY' && normalizedSession.plannedVolume === undefined) {
      delete merged.plannedVolume;
    }
  }

  if (merged.type === 'RECOVERY' || merged.type === 'REST') {
    delete merged.distance;
    delete merged.pace;
    delete merged.reps;
    delete merged.repDist;
    delete merged.repDuration;
    delete merged.recovery;
    delete merged.warmup;
    delete merged.cooldown;
    delete merged.runStructure;
    merged.format = 'simple';
  }

  if (merged.type === 'REST') {
    delete merged.actualActivityId;
    delete merged.subjectiveInput;
    delete merged.subjectiveInputDismissed;
    delete merged.skipped;
    delete merged.plannedVolume;
    delete merged.intensityTarget;
  }

  if (clearRunStructure) {
    delete merged.runStructure;
  }

  if (clearPlannedVolume) {
    delete merged.plannedVolume;
  }

  return stripUndefinedSessionFields(normalizeSessionIntensityTarget({
    ...merged,
  }));
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
  if (!session) {
    return { type: 'REST' };
  }

  const normalized = normalizeSessionIntensityTarget(session);
  if (normalized.type === 'REST') {
    const fingerprint: PlannedSessionEditFingerprint = {
      type: 'REST',
      format: normalized.format ?? 'simple',
    };
    if (normalized.planNote != null) fingerprint.planNote = normalized.planNote;
    return fingerprint;
  }

  const fingerprint: PlannedSessionEditFingerprint = {
    type: normalized.type,
    format: normalized.runStructure ? 'structured' : (normalized.format ?? 'simple'),
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
  if (normalized.plannedVolume != null) fingerprint.plannedVolume = normalized.plannedVolume;
  if (normalized.planNote != null) fingerprint.planNote = normalized.planNote;
  if (normalized.runStructure != null) fingerprint.runStructure = normalized.runStructure;

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
