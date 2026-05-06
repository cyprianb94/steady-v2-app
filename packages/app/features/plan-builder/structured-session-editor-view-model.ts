import {
  normalizeIntensityTarget,
  normalizePace,
  structuredSessionVolume,
  type IntensityTarget,
  type PlannedSession,
  type RunStructureItem,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
  type RunStructureVolumeUnit,
  type SessionType,
  type TrainingPaceProfile,
  type TrainingPaceProfileKey,
} from '@steady/types';
import { C } from '../../constants/colours';
import { formatIntensityTargetParts } from '../../lib/units';
import {
  getSessionEditorProfileBands,
  intensityTargetForTrainingPaceProfileKey,
} from './session-editing';

export const VOLUME_UNITS: RunStructureVolumeUnit[] = ['km', 'min', 'sec'];
export const SEGMENT_KINDS: RunStructureSegmentKind[] = [
  'WARMUP',
  'RUN',
  'RECOVERY',
  'FLOAT',
  'REST',
  'STRIDE',
  'COOLDOWN',
];

const DISTANCE_PRESETS = [0.2, 0.4, 0.6, 0.8, 1, 1.5, 2, 3, 5, 8, 10];
const MINUTE_PRESETS = [0.5, 1, 1.5, 2, 3, 5, 10, 20, 30, 45, 60];
const SECOND_PRESETS = [20, 30, 45, 60, 90];

export interface StructuredSessionMetric {
  value: string;
  color: string;
  caption: string;
}

export interface StructuredTargetOption {
  key: string;
  label: string;
  caption?: string;
}

export function formatVolume(volume: RunStructureVolume): string {
  if (volume.unit === 'sec') return `${volume.value}s`;
  return `${volume.value}${volume.unit}`;
}

export function volumePresets(unit: RunStructureVolumeUnit): number[] {
  if (unit === 'km') return DISTANCE_PRESETS;
  if (unit === 'sec') return SECOND_PRESETS;
  return MINUTE_PRESETS;
}

export function volumeMetricColor(unit: RunStructureVolumeUnit): string {
  return unit === 'km' ? C.metricDistance : C.metricTime;
}

export function segmentPaceSessionType(
  parentType: SessionType,
  segmentKind: RunStructureSegmentKind,
): SessionType {
  if (segmentKind === 'WARMUP' || segmentKind === 'RECOVERY' || segmentKind === 'COOLDOWN') {
    return 'RECOVERY';
  }
  if (segmentKind === 'FLOAT') {
    return 'EASY';
  }
  if (segmentKind === 'STRIDE') {
    return 'INTERVAL';
  }
  if (segmentKind === 'REST') {
    return 'REST';
  }
  return parentType;
}

export function targetForProfileKey(
  profile: TrainingPaceProfile | null | undefined,
  profileKey: TrainingPaceProfileKey,
): IntensityTarget {
  return intensityTargetForTrainingPaceProfileKey(profile, profileKey)
    ?? {
      source: 'profile',
      mode: 'effort',
      profileKey,
    };
}

export function segmentPaceOptions(
  parentType: SessionType,
  segmentValue: RunStructureSegment,
  profile: TrainingPaceProfile | null | undefined,
  units: 'metric' | 'imperial',
): StructuredTargetOption[] {
  const type = segmentPaceSessionType(parentType, segmentValue.kind);
  if (type === 'REST') return [];

  return getSessionEditorProfileBands(type, profile, segmentValue.intensityTarget)
    .map((band) => {
      const target = targetForProfileKey(profile, band.profileKey);
      const parts = formatIntensityTargetParts(target, units, { withUnit: true });
      return {
        key: band.profileKey,
        label: band.label,
        caption: parts.label ?? band.defaultEffortCue,
      };
    });
}

export function selectedSegmentPaceKey(segmentValue: RunStructureSegment): string | null {
  const target = normalizeIntensityTarget(segmentValue.intensityTarget);
  if (target?.source === 'profile' && target.profileKey) {
    return target.profileKey;
  }
  if (target?.source === 'manual' && target.profileKey && !target.pace && !target.paceRange) {
    return target.profileKey;
  }
  return normalizePace(target?.pace) ?? null;
}

export function volumesMatch(a: RunStructureVolume, b: RunStructureVolume): boolean {
  return a.unit === b.unit && a.value === b.value;
}

export function intensityTargetsMatch(
  a: IntensityTarget | null | undefined,
  b: IntensityTarget | null | undefined,
): boolean {
  return JSON.stringify(normalizeIntensityTarget(a) ?? null) === JSON.stringify(normalizeIntensityTarget(b) ?? null);
}

export function segmentIntensityLabel(
  segmentValue: RunStructureSegment,
  units: 'metric' | 'imperial',
): string {
  const profile = segmentValue.intensityTarget?.profileKey;
  const effort = segmentValue.intensityTarget?.effortCue;
  const targetParts = formatIntensityTargetParts(segmentValue.intensityTarget, units, { withUnit: true });
  if (segmentValue.progression?.from || segmentValue.progression?.to) {
    const from = segmentValue.progression.from?.profileKey ?? segmentValue.progression.from?.effortCue ?? 'easy';
    const to = segmentValue.progression.to?.profileKey ?? segmentValue.progression.to?.effortCue ?? 'finish';
    return `${from} to ${to}`;
  }

  if (targetParts.label) return targetParts.label;
  if (profile && effort) return `${profile} range · ${effort}`;
  if (profile) return `${profile} range`;
  if (effort) return effort;
  return 'No target set';
}

function isQualitySegment(segmentValue: RunStructureSegment): boolean {
  const key = segmentValue.intensityTarget?.profileKey;
  return segmentValue.kind === 'STRIDE'
    || key === 'marathon'
    || key === 'threshold'
    || key === 'interval';
}

function addSegmentVolume(
  current: { km: number; seconds: number },
  segmentValue: RunStructureSegment,
  multiplier = 1,
) {
  if (segmentValue.volume.unit === 'km') {
    current.km += segmentValue.volume.value * multiplier;
  } else if (segmentValue.volume.unit === 'min') {
    current.seconds += segmentValue.volume.value * 60 * multiplier;
  } else {
    current.seconds += segmentValue.volume.value * multiplier;
  }
}

function qualityVolume(items: RunStructureItem[]): { km: number; seconds: number } {
  const quality = { km: 0, seconds: 0 };
  items.forEach((item) => {
    if (item.kind === 'REPEAT') {
      item.segments.forEach((child) => {
        if (isQualitySegment(child)) {
          addSegmentVolume(quality, child, item.repeats);
        }
      });
      return;
    }

    if (isQualitySegment(item)) {
      addSegmentVolume(quality, item);
    }
  });
  return quality;
}

function formatVolumeSummary(volume: { km: number; seconds: number }): string {
  if (volume.km > 0) {
    const rounded = Math.round(volume.km * 10) / 10;
    return `${rounded}km`;
  }
  if (volume.seconds > 0) {
    const minutes = volume.seconds / 60;
    return minutes >= 1 ? `${Math.round(minutes * 10) / 10}min` : `${volume.seconds}s`;
  }
  return '0';
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function structuredKm(volume: ReturnType<typeof structuredSessionVolume>): number {
  return roundKm(volume.structuredExactKm + volume.structuredEstimatedKm);
}

export function distanceMetric(session: PlannedSession): StructuredSessionMetric {
  const volume = structuredSessionVolume(session);
  const structureKm = structuredKm(volume);
  if (structureKm > 0) {
    return {
      value: `${structureKm}km`,
      color: C.metricDistance,
      caption: volume.structuredEstimatedKm > 0 ? 'estimated' : 'exact',
    };
  }
  if (volume.exactKm > 0) {
    return { value: `${volume.exactKm}km`, color: C.metricDistance, caption: 'exact' };
  }
  if (volume.estimatedKm > 0) {
    return { value: `${volume.estimatedKm}km`, color: C.metricDistance, caption: 'estimated' };
  }
  return { value: '-', color: C.metricDistance, caption: 'no distance' };
}

export function timeMetric(session: PlannedSession): StructuredSessionMetric {
  const volume = structuredSessionVolume(session);
  if (volume.structuredSeconds > 0) {
    const minutes = Math.round((volume.structuredSeconds / 60) * 10) / 10;
    return { value: `${minutes}min`, color: C.metricTime, caption: 'structured' };
  }
  if (volume.plannedMinutes > 0) {
    return { value: `${volume.plannedMinutes}min`, color: C.metricTime, caption: 'planned' };
  }
  return { value: '-', color: C.metricTime, caption: 'from pace' };
}

export function qualityMetric(
  items: RunStructureItem[],
  session: PlannedSession,
): StructuredSessionMetric {
  const quality = qualityVolume(items);
  const volume = structuredSessionVolume(session);
  const totalKm = volume.structuredExactKm + volume.structuredEstimatedKm;

  if (quality.km > 0 && totalKm > 0) {
    return {
      value: `${Math.round((quality.km / totalKm) * 100)}%`,
      color: C.metricEffort,
      caption: 'of session',
    };
  }

  if (quality.seconds > 0 && volume.structuredSeconds > 0) {
    return {
      value: `${Math.round((quality.seconds / volume.structuredSeconds) * 100)}%`,
      color: C.metricEffort,
      caption: 'of session',
    };
  }

  return { value: '0%', color: C.metricEffort, caption: 'of session' };
}

export function groupVolume(item: Extract<RunStructureItem, { kind: 'REPEAT' }>): string {
  const volume = { km: 0, seconds: 0 };
  item.segments.forEach((child) => addSegmentVolume(volume, child, item.repeats));
  return formatVolumeSummary(volume);
}

export function parsePositiveNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function segmentKindLabel(kind: RunStructureSegmentKind): string {
  switch (kind) {
    case 'WARMUP':
      return 'Warm-up';
    case 'RUN':
      return 'Run';
    case 'RECOVERY':
      return 'Recovery';
    case 'FLOAT':
      return 'Float';
    case 'REST':
      return 'Rest';
    case 'STRIDE':
      return 'Stride';
    case 'COOLDOWN':
      return 'Cool-down';
  }
}

export function typeHeaderLabel(type: SessionType): string {
  switch (type) {
    case 'INTERVAL':
      return 'interval';
    case 'TEMPO':
      return 'tempo';
    case 'LONG':
      return 'long';
    case 'EASY':
    default:
      return 'easy';
  }
}
