import {
  normalizeIntensityTarget,
  normalizePace,
  normalizePaceRange,
  parsePaceSeconds,
  representativePace,
  secondsToPace,
  type IntensityTarget,
  type PaceRange,
} from '@steady/types';

const DEFAULT_PACE_PRESET_OFFSETS = [-15, -10, -5, 0, 5, 10, 15];
export const MIN_TARGET_PACE_SECONDS = 150;
export const MAX_TARGET_PACE_SECONDS = 720;

export function normalizeCustomPace(text: string): string | null {
  return normalizePace(text) ?? null;
}

export function pacePresetsAround(
  currentPace: string | null | undefined,
  fallbackPace = '4:30',
  offsets = DEFAULT_PACE_PRESET_OFFSETS,
): string[] {
  const fallbackSeconds = parsePaceSeconds(fallbackPace) ?? 270;
  const baseSeconds = parsePaceSeconds(currentPace) ?? fallbackSeconds;
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
  const baseSeconds = parsePaceSeconds(value) ?? parsePaceSeconds('4:30')!;
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
