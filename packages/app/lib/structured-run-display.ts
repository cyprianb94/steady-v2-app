import {
  normalizeIntensityTarget,
  normalizeRunStructure,
  trainingPaceBandToIntensityTarget,
  type IntensityTarget,
  type PlannedSession,
  type RunStructureItem,
  type RunStructureRepeatGroup,
  type RunStructureSegment,
  type RunStructureVolume,
  type TrainingPaceProfile,
} from '@steady/types';
import {
  formatDistance,
  formatIntensityTargetParts,
  type DistanceUnits,
} from './units';

export type StructuredRunDisplayKind = 'distance' | 'pace' | 'time' | 'neutral';

export interface StructuredRunDisplayToken {
  text: string;
  kind: StructuredRunDisplayKind;
}

export type StructuredRunDisplayLine = StructuredRunDisplayToken[];

function token(text: string, kind: StructuredRunDisplayKind = 'neutral'): StructuredRunDisplayToken {
  return { text, kind };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatVolume(volume: RunStructureVolume, units: DistanceUnits): string {
  if (volume.unit === 'km') {
    return formatDistance(volume.value, units);
  }
  if (volume.unit === 'min') {
    return `${formatNumber(volume.value)}min`;
  }

  if (volume.value >= 60 && volume.value % 60 === 0) {
    return `${formatNumber(volume.value / 60)}min`;
  }
  if (volume.value > 60 && volume.value % 30 === 0) {
    return `${formatNumber(volume.value / 60)}min`;
  }
  return `${formatNumber(volume.value)}s`;
}

function volumeToken(volume: RunStructureVolume, units: DistanceUnits): StructuredRunDisplayToken {
  return token(formatVolume(volume, units), volume.unit === 'km' ? 'distance' : 'time');
}

function resolveProfileTarget(
  targetValue: IntensityTarget | null | undefined,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
): IntensityTarget | undefined {
  const target = normalizeIntensityTarget(targetValue);
  const profileKey = target?.profileKey;
  const profileBand = profileKey ? trainingPaceProfile?.bands[profileKey] : undefined;

  if (profileBand) {
    return trainingPaceBandToIntensityTarget(profileBand);
  }

  return target;
}

function intensityName(targetValue: IntensityTarget | null | undefined): string | null {
  const target = normalizeIntensityTarget(targetValue);
  if (!target) return null;
  if (target.profileKey === 'marathon') return 'marathon pace';
  if (target.profileKey === 'threshold') return 'threshold';
  if (target.profileKey === 'interval') return 'VO2 range';
  if (target.profileKey === 'recovery') return 'very easy';
  if (target.profileKey === 'easy') return 'easy';
  if (target.profileKey === 'steady') return 'steady';
  if (target.effortCue === 'race pace') return 'race pace';
  return target.effortCue ?? null;
}

function segmentIntensityName(segment: RunStructureSegment): string | null {
  return intensityName(segment.intensityTarget)
    ?? intensityName(segment.progression?.to)
    ?? intensityName(segment.progression?.from);
}

function targetPace(
  targetValue: IntensityTarget | null | undefined,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): string | null {
  const target = resolveProfileTarget(targetValue, trainingPaceProfile);
  return formatIntensityTargetParts(target, units, {
    withUnit: true,
    includeEffort: false,
  }).pace;
}

function segmentPace(
  segment: RunStructureSegment,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): string | null {
  if (segment.progression?.from || segment.progression?.to) {
    const from = targetPace(segment.progression.from, trainingPaceProfile, units);
    const to = targetPace(segment.progression.to, trainingPaceProfile, units);
    if (from && to) return `${from} -> ${to}`;
    return from ?? to;
  }

  return targetPace(segment.intensityTarget, trainingPaceProfile, units);
}

function paceSuffix(
  segment: RunStructureSegment,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine {
  const pace = segmentPace(segment, trainingPaceProfile, units);
  return pace ? [token(' · '), token(pace, 'pace')] : [];
}

function progressionTokens(
  segment: RunStructureSegment,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine | null {
  const from = intensityName(segment.progression?.from);
  const to = intensityName(segment.progression?.to);
  if (!from && !to) return null;

  return [
    volumeToken(segment.volume, units),
    token(` progression ${from ?? 'easy'} to ${to ?? 'hard'}`),
    ...paceSuffix(segment, trainingPaceProfile, units),
  ];
}

function segmentTokens(
  segment: RunStructureSegment,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine {
  const progression = progressionTokens(segment, trainingPaceProfile, units);
  if (progression) return progression;

  const intensity = segmentIntensityName(segment);
  const kindLabel = segment.kind === 'STRIDE'
    ? 'stride'
    : segment.kind === 'FLOAT'
      ? 'float'
      : segment.kind === 'RECOVERY'
        ? 'recovery'
        : null;
  const label = kindLabel ?? intensity;

  return [
    volumeToken(segment.volume, units),
    ...(label ? [token(` ${label}`)] : []),
    ...paceSuffix(segment, trainingPaceProfile, units),
  ];
}

function sameVolume(a: RunStructureVolume, b: RunStructureVolume): boolean {
  return a.unit === b.unit && a.value === b.value;
}

function repeatRunRecoveryTokens(
  group: RunStructureRepeatGroup,
  first: RunStructureSegment,
  second: RunStructureSegment,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine {
  const intensity = segmentIntensityName(first);
  const recoveryLabel = segmentIntensityName(second) === 'easy' ? 'jog' : 'recovery';

  return [
    token(`${group.repeats} x `),
    volumeToken(first.volume, units),
    ...(intensity ? [token(` ${intensity}`)] : []),
    ...paceSuffix(first, trainingPaceProfile, units),
    token(', '),
    volumeToken(second.volume, units),
    token(` ${recoveryLabel}`),
    ...paceSuffix(second, trainingPaceProfile, units),
  ];
}

function repeatTokens(
  group: RunStructureRepeatGroup,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine {
  const [first, second] = group.segments;

  if (
    group.segments.length === 2
    && first.kind === 'RUN'
    && second.kind === 'RECOVERY'
    && sameVolume(first.volume, second.volume)
    && !segmentIntensityName(first)
  ) {
    return [
      token(`${group.repeats} x `),
      volumeToken(first.volume, units),
      token(' on/off'),
    ];
  }

  if (group.segments.length === 2 && first.kind === 'RUN' && second.kind === 'FLOAT') {
    const intensity = segmentIntensityName(first);
    return [
      token(`${group.repeats} x `),
      volumeToken(first.volume, units),
      ...(intensity ? [token(` ${intensity}`)] : []),
      ...paceSuffix(first, trainingPaceProfile, units),
      token(' off '),
      volumeToken(second.volume, units),
      token(' float'),
      ...paceSuffix(second, trainingPaceProfile, units),
    ];
  }

  if (group.segments.length === 2 && first.kind === 'RUN' && second.kind === 'RECOVERY') {
    return repeatRunRecoveryTokens(group, first, second, trainingPaceProfile, units);
  }

  if (group.segments.length === 1 && first.kind === 'STRIDE') {
    return [
      token(`${group.repeats} x `),
      volumeToken(first.volume, units),
      token(' strides'),
      ...paceSuffix(first, trainingPaceProfile, units),
    ];
  }

  const parts: StructuredRunDisplayLine = [token(`${group.repeats} x (`)];
  group.segments.forEach((segment, index) => {
    if (index > 0) {
      parts.push(token(' + '));
    }
    parts.push(...segmentTokens(segment, trainingPaceProfile, units));
  });
  parts.push(token(')'));
  return parts;
}

function itemTokens(
  item: RunStructureItem,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayLine {
  return item.kind === 'REPEAT'
    ? repeatTokens(item, trainingPaceProfile, units)
    : segmentTokens(item, trainingPaceProfile, units);
}

export function buildStructuredRunDisplayLines(
  session: PlannedSession | null,
  units: DistanceUnits,
  trainingPaceProfile?: TrainingPaceProfile | null,
): StructuredRunDisplayLine[] | null {
  const structure = normalizeRunStructure(session?.runStructure);
  if (!structure) return null;

  return structure.items.map((item) => itemTokens(item, trainingPaceProfile, units));
}

export function structuredRunDisplayText(lines: StructuredRunDisplayLine[]): string {
  return lines.map((line) => line.map((part) => part.text).join('')).join(', ');
}
