import {
  EFFORT_CUES,
  type EffortCue,
  type IntensityTarget,
  type IntensityTargetMode,
  type PaceRange,
  type TrainingPaceProfileKey,
} from '../session';
import type { TrainingPlan } from '../plan';
import {
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  representativePaceSeconds,
  secondsToPace,
} from './intensity-targets';

export type TrainingPaceProfileRaceDistance = TrainingPlan['raceDistance'];

export interface DeriveTrainingPaceProfileInput {
  raceDistance: TrainingPaceProfileRaceDistance;
  targetTime: string;
}

export type TrainingPaceProfileBandEditability =
  | {
      editable: true;
    }
  | {
      editable: false;
      reason: 'race-target-derived';
    };

export interface TrainingPaceProfileBand {
  profileKey: TrainingPaceProfileKey;
  label: string;
  order: number;
  pace?: string;
  paceRange?: PaceRange;
  defaultEffortCue: EffortCue;
  editability: TrainingPaceProfileBandEditability;
}

export type TrainingPaceProfileBands = Record<TrainingPaceProfileKey, TrainingPaceProfileBand>;

export interface TrainingPaceProfile {
  raceDistance: TrainingPaceProfileRaceDistance;
  targetTime: string;
  targetTimeSeconds: number;
  racePace: string;
  bands: TrainingPaceProfileBands;
}

interface TrainingPaceProfileBandDefinition {
  label: string;
  order: number;
  editability: TrainingPaceProfileBandEditability;
  rangeMultiplier?: readonly [number, number];
}

export const TRAINING_PACE_PROFILE_BAND_ORDER: readonly TrainingPaceProfileKey[] = [
  'recovery',
  'easy',
  'steady',
  'marathon',
  'threshold',
  'interval',
];

export const TRAINING_PACE_PROFILE_DEFAULT_EFFORT_CUES: Record<TrainingPaceProfileKey, EffortCue> = {
  recovery: 'very easy',
  easy: 'conversational',
  steady: 'steady',
  marathon: 'race pace',
  threshold: 'controlled hard',
  interval: 'hard repeatable',
};

const RACE_DISTANCE_KM: Record<TrainingPaceProfileRaceDistance, number> = {
  '5K': 5,
  '10K': 10,
  'Half Marathon': 21.0975,
  Marathon: 42.195,
  Ultra: 50,
};

const FALLBACK_TARGET_TIME_SECONDS: Record<TrainingPaceProfileRaceDistance, number> = {
  '5K': 25 * 60,
  '10K': 50 * 60,
  'Half Marathon': 105 * 60,
  Marathon: 4 * 60 * 60,
  Ultra: 12 * 60 * 60,
};

const EDITABLE_BAND: TrainingPaceProfileBandEditability = { editable: true };
const RACE_TARGET_LOCKED: TrainingPaceProfileBandEditability = {
  editable: false,
  reason: 'race-target-derived',
};

const BAND_DEFINITIONS: Record<TrainingPaceProfileKey, TrainingPaceProfileBandDefinition> = {
  recovery: {
    label: 'Recovery',
    order: 0,
    editability: EDITABLE_BAND,
    rangeMultiplier: [1.35, 1.46],
  },
  easy: {
    label: 'Easy',
    order: 1,
    editability: EDITABLE_BAND,
    rangeMultiplier: [1.2, 1.28],
  },
  steady: {
    label: 'Steady',
    order: 2,
    editability: EDITABLE_BAND,
    rangeMultiplier: [1.08, 1.13],
  },
  marathon: {
    label: 'Race pace',
    order: 3,
    editability: RACE_TARGET_LOCKED,
  },
  threshold: {
    label: 'Threshold',
    order: 4,
    editability: EDITABLE_BAND,
    rangeMultiplier: [0.94, 0.98],
  },
  interval: {
    label: 'Interval',
    order: 5,
    editability: EDITABLE_BAND,
    rangeMultiplier: [0.84, 0.88],
  },
};

function raceDistanceOrFallback(
  raceDistance: TrainingPaceProfileRaceDistance,
): TrainingPaceProfileRaceDistance {
  return Object.prototype.hasOwnProperty.call(RACE_DISTANCE_KM, raceDistance)
    ? raceDistance
    : 'Marathon';
}

function cloneEditability(
  editability: TrainingPaceProfileBandEditability,
): TrainingPaceProfileBandEditability {
  return editability.editable
    ? { editable: true }
    : { editable: false, reason: editability.reason };
}

function cloneBand(band: TrainingPaceProfileBand): TrainingPaceProfileBand {
  const cloned: TrainingPaceProfileBand = {
    profileKey: band.profileKey,
    label: band.label,
    order: band.order,
    defaultEffortCue: band.defaultEffortCue,
    editability: cloneEditability(band.editability),
  };

  if (band.pace) {
    cloned.pace = band.pace;
  }
  if (band.paceRange) {
    cloned.paceRange = { ...band.paceRange };
  }

  return cloned;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTrainingPaceProfileRaceDistance(
  value: unknown,
): value is TrainingPaceProfileRaceDistance {
  return (
    value === '5K'
    || value === '10K'
    || value === 'Half Marathon'
    || value === 'Marathon'
    || value === 'Ultra'
  );
}

function isEffortCue(value: unknown): value is EffortCue {
  return typeof value === 'string' && EFFORT_CUES.includes(value as EffortCue);
}

function getRecordValue(record: UnknownRecord, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

function normalizePersistedPaceRange(value: unknown): PaceRange | null {
  if (!isRecord(value)) {
    return null;
  }

  const min = getRecordValue(value, 'min');
  const max = getRecordValue(value, 'max');
  if (typeof min !== 'string' || typeof max !== 'string') {
    return null;
  }

  return normalizePaceRange({ min, max }) ?? null;
}

function normalizePersistedBand(
  value: unknown,
  fallback: TrainingPaceProfileBand,
): TrainingPaceProfileBand {
  const band = cloneBand(fallback);
  if (!isRecord(value)) {
    return band;
  }

  const defaultEffortCue = getRecordValue(value, 'defaultEffortCue');
  if (isEffortCue(defaultEffortCue)) {
    band.defaultEffortCue = defaultEffortCue;
  }

  if (!band.editability.editable) {
    return band;
  }

  const paceRange = normalizePersistedPaceRange(getRecordValue(value, 'paceRange'));
  const paceValue = getRecordValue(value, 'pace');
  const pace = typeof paceValue === 'string' ? normalizePace(paceValue) : null;

  if (paceRange) {
    band.paceRange = paceRange;
    delete band.pace;
  } else if (pace) {
    band.pace = pace;
    delete band.paceRange;
  }

  return band;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function onePartTargetIsHours(
  value: number,
  raceDistance: TrainingPaceProfileRaceDistance,
): boolean {
  return value <= 10 && (
    raceDistance === 'Half Marathon'
    || raceDistance === 'Marathon'
    || raceDistance === 'Ultra'
  );
}

function parseClockTargetSeconds(
  value: string,
): number | null {
  const parts = value.split(':');
  if (parts.length !== 2 && parts.length !== 3) {
    return null;
  }

  const parsed = parts.map(parsePositiveInteger);
  if (parsed.some((part) => part == null)) {
    return null;
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parsed as [number, number, number];
    if (minutes > 59 || seconds > 59) {
      return null;
    }
    return hours * 3600 + minutes * 60 + seconds;
  }

  const [major, minor] = parsed as [number, number];
  if (minor > 59) {
    return null;
  }

  return major <= 9
    ? major * 3600 + minor * 60
    : major * 60 + minor;
}

export function parseRaceTargetTimeSeconds(
  targetTime: string,
  raceDistance: TrainingPaceProfileRaceDistance = 'Marathon',
): number | null {
  const normalizedRaceDistance = raceDistanceOrFallback(raceDistance);
  const raw = targetTime.trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const cleaned = raw
    .replace(/^sub\s*-?\s*/, '')
    .replace(/^<\s*/, '')
    .replace(/\s+/g, '');

  const hourMatch = cleaned.match(/^(\d+(?:\.\d+)?)h(?:ours?)?$/);
  if (hourMatch) {
    const hours = Number(hourMatch[1]);
    return Number.isFinite(hours) && hours > 0
      ? Math.round(hours * 3600)
      : null;
  }

  const clockSeconds = parseClockTargetSeconds(cleaned);
  if (clockSeconds != null) {
    return clockSeconds > 0 ? clockSeconds : null;
  }

  if (!/^\d+(?:\.\d+)?$/.test(cleaned)) {
    return null;
  }

  const numeric = Number(cleaned);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(
    onePartTargetIsHours(numeric, normalizedRaceDistance)
      ? numeric * 3600
      : numeric * 60,
  );
}

function paceRangeFromRacePace(
  racePaceSeconds: number,
  multipliers: readonly [number, number],
): PaceRange {
  const range = normalizePaceRange({
    min: secondsToPace(racePaceSeconds * multipliers[0]),
    max: secondsToPace(racePaceSeconds * multipliers[1]),
  });

  return range ?? {
    min: secondsToPace(racePaceSeconds),
    max: secondsToPace(racePaceSeconds),
  };
}

function buildBand(
  profileKey: TrainingPaceProfileKey,
  racePaceSeconds: number,
): TrainingPaceProfileBand {
  const definition = BAND_DEFINITIONS[profileKey];
  const band: TrainingPaceProfileBand = {
    profileKey,
    label: definition.label,
    order: definition.order,
    defaultEffortCue: TRAINING_PACE_PROFILE_DEFAULT_EFFORT_CUES[profileKey],
    editability: cloneEditability(definition.editability),
  };

  if (definition.rangeMultiplier) {
    band.paceRange = paceRangeFromRacePace(racePaceSeconds, definition.rangeMultiplier);
  } else {
    band.pace = secondsToPace(racePaceSeconds);
  }

  return band;
}

export function deriveTrainingPaceProfile(
  input: DeriveTrainingPaceProfileInput,
): TrainingPaceProfile {
  const raceDistance = raceDistanceOrFallback(input.raceDistance);
  const targetTimeSeconds = parseRaceTargetTimeSeconds(input.targetTime, raceDistance)
    ?? FALLBACK_TARGET_TIME_SECONDS[raceDistance];
  const racePaceSeconds = targetTimeSeconds / RACE_DISTANCE_KM[raceDistance];
  const bands = TRAINING_PACE_PROFILE_BAND_ORDER.reduce((acc, profileKey) => {
    acc[profileKey] = buildBand(profileKey, racePaceSeconds);
    return acc;
  }, {} as TrainingPaceProfileBands);

  return {
    raceDistance,
    targetTime: input.targetTime,
    targetTimeSeconds,
    racePace: secondsToPace(racePaceSeconds),
    bands,
  };
}

export function normalizeTrainingPaceProfile(value: unknown): TrainingPaceProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const raceDistance = getRecordValue(value, 'raceDistance');
  const targetTime = getRecordValue(value, 'targetTime');
  if (!isTrainingPaceProfileRaceDistance(raceDistance) || typeof targetTime !== 'string') {
    return null;
  }

  const derived = deriveTrainingPaceProfile({ raceDistance, targetTime });
  const persistedBands = getRecordValue(value, 'bands');
  const persistedBandsRecord = isRecord(persistedBands) ? persistedBands : {};
  const bands = TRAINING_PACE_PROFILE_BAND_ORDER.reduce((acc, profileKey) => {
    acc[profileKey] = normalizePersistedBand(
      getRecordValue(persistedBandsRecord, profileKey),
      derived.bands[profileKey],
    );
    return acc;
  }, {} as TrainingPaceProfileBands);

  return {
    ...derived,
    bands,
  };
}

export function getOrderedTrainingPaceProfileBands(
  profile: TrainingPaceProfile,
): TrainingPaceProfileBand[] {
  return TRAINING_PACE_PROFILE_BAND_ORDER
    .map((profileKey) => profile.bands[profileKey])
    .filter((band): band is TrainingPaceProfileBand => Boolean(band))
    .sort((a, b) => a.order - b.order)
    .map(cloneBand);
}

export function trainingPaceBandToIntensityTarget(
  band: TrainingPaceProfileBand,
): IntensityTarget {
  const hasPaceTarget = Boolean(band.pace || band.paceRange);
  const mode: IntensityTargetMode = hasPaceTarget && band.defaultEffortCue
    ? 'both'
    : hasPaceTarget
      ? 'pace'
      : 'effort';
  const target = normalizeIntensityTarget({
    source: 'profile',
    mode,
    profileKey: band.profileKey,
    pace: band.pace,
    paceRange: band.paceRange,
    effortCue: band.defaultEffortCue,
  });

  return target ?? {
    source: 'profile',
    mode: 'effort',
    profileKey: band.profileKey,
    effortCue: band.defaultEffortCue,
  };
}

export function trainingPaceBandRepresentativePaceSeconds(
  band: TrainingPaceProfileBand,
): number | null {
  return representativePaceSeconds(trainingPaceBandToIntensityTarget(band));
}
