import {
  EFFORT_CUES,
  INTENSITY_TARGET_MODES,
  INTENSITY_TARGET_SOURCES,
  TRAINING_PACE_PROFILE_KEYS,
  type EffortCue,
  type IntensityTarget,
  type IntensityTargetMode,
  type IntensityTargetSource,
  type PaceRange,
  type PlannedSession,
  type SessionType,
  type TrainingPaceProfileKey,
} from '../session';

export type IntensityTargetType = 'none' | 'pace' | 'paceRange' | 'effort' | 'both';

export interface NormalizeIntensityTargetOptions {
  fallbackPace?: string | null;
}

export interface NormalizeSessionIntensityTargetOptions {
  applyDefaults?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value as T[number]);
}

function cloneTarget(target: IntensityTarget): IntensityTarget {
  const cloned = { ...target };
  if (target.paceRange) {
    cloned.paceRange = { ...target.paceRange };
  } else {
    delete cloned.paceRange;
  }
  return cloned;
}

function paceTargetFields(target: IntensityTarget | undefined): {
  hasPaceTarget: boolean;
  hasEffortCue: boolean;
} {
  return {
    hasPaceTarget: Boolean(target?.pace || target?.paceRange),
    hasEffortCue: Boolean(target?.effortCue),
  };
}

function deriveMode(target: IntensityTarget | undefined): IntensityTargetMode | undefined {
  const { hasPaceTarget, hasEffortCue } = paceTargetFields(target);
  if (hasPaceTarget && hasEffortCue) return 'both';
  if (hasPaceTarget) return 'pace';
  if (hasEffortCue) return 'effort';
  return undefined;
}

function resolvedMode(
  requestedMode: IntensityTargetMode | undefined,
  target: IntensityTarget | undefined,
): IntensityTargetMode | undefined {
  const { hasPaceTarget, hasEffortCue } = paceTargetFields(target);
  if (!hasPaceTarget && !hasEffortCue) return undefined;

  if (requestedMode === 'both') {
    return hasPaceTarget && hasEffortCue ? 'both' : deriveMode(target);
  }

  if (requestedMode === 'pace') {
    return hasPaceTarget ? 'pace' : deriveMode(target);
  }

  if (requestedMode === 'effort') {
    return hasEffortCue ? 'effort' : deriveMode(target);
  }

  return deriveMode(target);
}

function structuredPaceTarget(pace: string): IntensityTarget {
  return {
    source: 'manual',
    mode: 'pace',
    pace,
  };
}

const DEFAULT_INTENSITY_TARGETS: Partial<Record<SessionType, IntensityTarget>> = {
  EASY: {
    source: 'manual',
    mode: 'effort',
    profileKey: 'easy',
    effortCue: 'conversational',
  },
  LONG: {
    source: 'manual',
    mode: 'effort',
    profileKey: 'easy',
    effortCue: 'conversational',
  },
  TEMPO: {
    source: 'manual',
    mode: 'both',
    profileKey: 'threshold',
    paceRange: { min: '4:15', max: '4:25' },
    effortCue: 'controlled hard',
  },
  INTERVAL: {
    source: 'manual',
    mode: 'pace',
    profileKey: 'interval',
    paceRange: { min: '3:45', max: '3:55' },
    effortCue: 'hard repeatable',
  },
};

export function normalizePace(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const cleaned = value.trim().replace(/\s*\/\s*(km|mi)$/i, '');
  const match = cleaned.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (!match) {
    return undefined;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return undefined;
  }

  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds <= 0) {
    return undefined;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function parsePaceSeconds(value: unknown): number | null {
  const normalized = normalizePace(value);
  if (!normalized) {
    return null;
  }

  const [minutes, seconds] = normalized.split(':').map(Number);
  return minutes * 60 + seconds;
}

export function secondsToPace(totalSeconds: number): string {
  const roundedSeconds = Math.max(1, Math.round(totalSeconds));
  const minutes = Math.floor(roundedSeconds / 60);
  const seconds = roundedSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function normalizePaceRange(value: unknown): PaceRange | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const min = normalizePace(value.min);
  const max = normalizePace(value.max);
  if (!min || !max) {
    return undefined;
  }

  const minSeconds = parsePaceSeconds(min)!;
  const maxSeconds = parsePaceSeconds(max)!;
  return minSeconds <= maxSeconds
    ? { min, max }
    : { min: max, max: min };
}

export function defaultIntensityTargetForSessionType(
  type: SessionType,
): IntensityTarget | undefined {
  const target = DEFAULT_INTENSITY_TARGETS[type];
  return target ? cloneTarget(target) : undefined;
}

export function recoveryIntensityTarget(): IntensityTarget {
  return {
    source: 'manual',
    mode: 'effort',
    profileKey: 'recovery',
    effortCue: 'very easy',
  };
}

export function normalizeIntensityTarget(
  value: unknown,
  options: NormalizeIntensityTargetOptions = {},
): IntensityTarget | undefined {
  const fallbackPace = normalizePace(options.fallbackPace);

  if (!isRecord(value)) {
    return fallbackPace ? structuredPaceTarget(fallbackPace) : undefined;
  }

  const source: IntensityTargetSource = isOneOf(value.source, INTENSITY_TARGET_SOURCES)
    ? value.source
    : 'manual';
  const requestedMode = isOneOf(value.mode, INTENSITY_TARGET_MODES)
    ? value.mode
    : undefined;
  const profileKey: TrainingPaceProfileKey | undefined = isOneOf(
    value.profileKey,
    TRAINING_PACE_PROFILE_KEYS,
  )
    ? value.profileKey
    : undefined;
  const effortCue: EffortCue | undefined = isOneOf(value.effortCue, EFFORT_CUES)
    ? value.effortCue
    : undefined;

  const target: IntensityTarget = {
    source,
    mode: requestedMode ?? 'pace',
  };

  if (profileKey) target.profileKey = profileKey;

  const pace = normalizePace(value.pace);
  const paceRange = normalizePaceRange(value.paceRange);
  if (pace) target.pace = pace;
  if (paceRange) target.paceRange = paceRange;
  if (effortCue) target.effortCue = effortCue;

  if (!target.pace && !target.paceRange && requestedMode !== 'effort' && fallbackPace) {
    target.pace = fallbackPace;
  }

  const mode = resolvedMode(requestedMode, target);
  if (!mode) {
    return undefined;
  }

  target.mode = mode;

  if (!target.profileKey) {
    delete target.profileKey;
  }
  if (!target.pace) {
    delete target.pace;
  }
  if (!target.paceRange) {
    delete target.paceRange;
  }
  if (!target.effortCue) {
    delete target.effortCue;
  }

  return target;
}

export function representativePaceSeconds(target: IntensityTarget | null | undefined): number | null {
  const normalized = normalizeIntensityTarget(target);
  if (!normalized) {
    return null;
  }

  const paceSeconds = parsePaceSeconds(normalized.pace);
  if (paceSeconds != null) {
    return paceSeconds;
  }

  if (!normalized.paceRange) {
    return null;
  }

  const min = parsePaceSeconds(normalized.paceRange.min);
  const max = parsePaceSeconds(normalized.paceRange.max);
  return min != null && max != null ? Math.round((min + max) / 2) : null;
}

export function representativePace(target: IntensityTarget | null | undefined): string | undefined {
  const seconds = representativePaceSeconds(target);
  return seconds != null ? secondsToPace(seconds) : undefined;
}

export function getSessionIntensityTarget(
  session: PlannedSession | null | undefined,
): IntensityTarget | undefined {
  if (!session || session.type === 'REST') {
    return undefined;
  }

  return normalizeIntensityTarget(session.intensityTarget, {
    fallbackPace: session.pace,
  });
}

export function representativeSessionPaceSeconds(
  session: PlannedSession | null | undefined,
): number | null {
  const targetPace = representativePaceSeconds(getSessionIntensityTarget(session));
  if (targetPace != null) {
    return targetPace;
  }

  return parsePaceSeconds(session?.pace);
}

export function representativeSessionPace(
  session: PlannedSession | null | undefined,
): string | undefined {
  const seconds = representativeSessionPaceSeconds(session);
  return seconds != null ? secondsToPace(seconds) : undefined;
}

export function normalizeSessionIntensityTarget(
  session: PlannedSession,
  options: NormalizeSessionIntensityTargetOptions = {},
): PlannedSession {
  if (session.type === 'REST') {
    const { intensityTarget: _intensityTarget, ...rest } = session;
    return rest;
  }

  const existingOrLegacy = getSessionIntensityTarget(session);
  const target = existingOrLegacy
    ?? (options.applyDefaults ? defaultIntensityTargetForSessionType(session.type) : undefined);
  const normalizedTarget = normalizeIntensityTarget(target);
  const normalized: PlannedSession = { ...session };

  if (normalizedTarget) {
    normalized.intensityTarget = normalizedTarget;
  } else {
    delete normalized.intensityTarget;
  }

  const representative = representativePace(normalizedTarget);
  if (representative) {
    normalized.pace = representative;
  } else {
    const normalizedLegacyPace = normalizePace(session.pace);
    if (normalizedLegacyPace) {
      normalized.pace = normalizedLegacyPace;
    } else if (session.pace == null) {
      delete normalized.pace;
    }
  }

  return normalized;
}

export function detectIntensityTargetType(
  value: IntensityTarget | PlannedSession | null | undefined,
): IntensityTargetType {
  const target = isRecord(value) && 'type' in value
    ? getSessionIntensityTarget(value as PlannedSession)
    : normalizeIntensityTarget(value);
  if (!target) {
    return 'none';
  }

  const hasPaceTarget = Boolean(target.pace || target.paceRange);
  const hasEffortCue = Boolean(target.effortCue);
  if (target.mode === 'both' && hasPaceTarget && hasEffortCue) {
    return 'both';
  }
  if (target.paceRange) {
    return 'paceRange';
  }
  if (target.pace) {
    return 'pace';
  }
  if (hasEffortCue) {
    return 'effort';
  }
  return 'none';
}

export function formatIntensityTarget(
  value: IntensityTarget | PlannedSession | null | undefined,
): string {
  const target = isRecord(value) && 'type' in value
    ? getSessionIntensityTarget(value as PlannedSession)
    : normalizeIntensityTarget(value);
  if (!target) {
    return '—';
  }

  const parts: string[] = [];
  if (target.paceRange) {
    parts.push(`${target.paceRange.min}-${target.paceRange.max} /km`);
  } else if (target.pace) {
    parts.push(`${target.pace} /km`);
  }

  if (target.effortCue) {
    parts.push(target.effortCue);
  }

  return parts.length > 0 ? parts.join(', ') : '—';
}

export function intensityTargetContext(
  value: IntensityTarget | PlannedSession | null | undefined,
): string | null {
  const formatted = formatIntensityTarget(value);
  return formatted === '—' ? null : `target ${formatted}`;
}
