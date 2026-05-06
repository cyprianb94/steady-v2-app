import {
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  representativePace,
  type IntensityTarget,
  type PaceRange,
} from '@steady/types';

const DEFAULT_PACE_PRESET_OFFSETS = [-15, -10, -5, 0, 5, 10, 15];
export const MIN_TARGET_PACE_SECONDS = 150;
export const MAX_TARGET_PACE_SECONDS = 720;

export function paceToSeconds(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function secondsToPace(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeCustomPace(text: string): string | null {
  const cleaned = text.trim().replace(/\s*\/\s*km$/i, '');
  const match = cleaned.match(/^(\d{1,2}):([0-5]?\d)$/);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds > 59) {
    return null;
  }

  const total = minutes * 60 + seconds;
  return total > 0 ? secondsToPace(total) : null;
}

export function pacePresetsAround(
  currentPace: string | null | undefined,
  fallbackPace = '4:30',
  offsets = DEFAULT_PACE_PRESET_OFFSETS,
): string[] {
  const fallbackSeconds = paceToSeconds(fallbackPace) ?? 270;
  const baseSeconds = paceToSeconds(currentPace) ?? fallbackSeconds;
  const presets = offsets
    .map((offset) => baseSeconds + offset)
    .filter((seconds) => seconds >= MIN_TARGET_PACE_SECONDS && seconds <= MAX_TARGET_PACE_SECONDS)
    .map(secondsToPace);

  return Array.from(new Set(presets));
}

export function isManualRangeTarget(target: IntensityTarget | null | undefined): boolean {
  return target?.source === 'manual' && Boolean(normalizePaceRange(target.paceRange));
}

export function paceRangeAroundPace(value: string | null | undefined): PaceRange {
  const baseSeconds = paceToSeconds(value) ?? paceToSeconds('4:30')!;
  const fasterSeconds = Math.max(MIN_TARGET_PACE_SECONDS, baseSeconds - 5);
  const slowerSeconds = Math.min(MAX_TARGET_PACE_SECONDS, baseSeconds + 5);

  return {
    min: secondsToPace(fasterSeconds),
    max: secondsToPace(Math.max(fasterSeconds, slowerSeconds)),
  };
}

export function manualPaceRangeDraft(
  target: IntensityTarget | null | undefined,
  fallbackPace: string,
): PaceRange {
  const range = normalizePaceRange(target?.paceRange);
  const normalized = normalizeIntensityTarget(target);
  const targetPace = representativePace(normalized) ?? normalizePace(fallbackPace);
  return range ?? paceRangeAroundPace(targetPace);
}
