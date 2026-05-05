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

export type StructuredRunDisplayBlock =
  | {
      kind: 'line';
      line: StructuredRunDisplayLine;
    }
  | {
      kind: 'repeat';
      repeatLabel: string;
      lines: StructuredRunDisplayLine[];
    };

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
  const label = segmentLabel(segment, intensity);

  return [
    volumeToken(segment.volume, units),
    ...(label ? [token(` ${label}`)] : []),
    ...paceSuffix(segment, trainingPaceProfile, units),
  ];
}

function segmentLabel(segment: RunStructureSegment, intensity: string | null): string | null {
  if (segment.kind === 'WARMUP') {
    return ['warmup', intensity].filter(Boolean).join(' ');
  }
  if (segment.kind === 'COOLDOWN') {
    return ['cooldown', intensity].filter(Boolean).join(' ');
  }
  if (segment.kind === 'STRIDE') {
    return 'stride';
  }
  if (segment.kind === 'FLOAT') {
    return 'float';
  }
  if (segment.kind === 'RECOVERY') {
    return intensity === 'easy' ? 'jog' : 'recovery';
  }
  if (segment.kind === 'REST') {
    return 'rest';
  }

  return intensity;
}

function repeatBlock(
  group: RunStructureRepeatGroup,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayBlock {
  return {
    kind: 'repeat',
    repeatLabel: `${group.repeats}×`,
    lines: group.segments.map((segment) => segmentTokens(segment, trainingPaceProfile, units)),
  };
}

function itemBlock(
  item: RunStructureItem,
  trainingPaceProfile: TrainingPaceProfile | null | undefined,
  units: DistanceUnits,
): StructuredRunDisplayBlock {
  return item.kind === 'REPEAT'
    ? repeatBlock(item, trainingPaceProfile, units)
    : {
        kind: 'line',
        line: segmentTokens(item, trainingPaceProfile, units),
      };
}

function compactSegmentLabel(segment: RunStructureSegment): string | null {
  if (segment.progression?.from || segment.progression?.to) return 'progression';

  const intensity = segmentIntensityName(segment);
  if (segment.kind === 'STRIDE') return 'strides';
  if (segment.kind === 'FLOAT') return 'float';
  if (segment.kind === 'RECOVERY') return 'recovery';
  if (segment.kind === 'WARMUP') return 'warmup';
  if (segment.kind === 'COOLDOWN') return 'cooldown';
  return intensity;
}

function isQualityLabel(label: string | null): boolean {
  return Boolean(label && !['easy', 'very easy', 'recovery', 'jog', 'warmup', 'cooldown', 'float'].includes(label));
}

function primaryRepeatSegment(group: RunStructureRepeatGroup): RunStructureSegment {
  return group.segments.find((segment) => isQualityLabel(compactSegmentLabel(segment)))
    ?? group.segments.find((segment) => segment.kind === 'RUN')
    ?? group.segments[0]!;
}

function compactRepeatSummary(
  group: RunStructureRepeatGroup,
  units: DistanceUnits,
): string {
  const segment = primaryRepeatSegment(group);
  const label = compactSegmentLabel(segment);
  const volume = formatVolume(segment.volume, units);
  const suffix = label ? ` ${label}` : '';
  return `${group.repeats}×${volume}${suffix}`;
}

function compactItemSummary(
  item: RunStructureItem,
  units: DistanceUnits,
): string {
  if (item.kind === 'REPEAT') {
    return compactRepeatSummary(item, units);
  }

  const label = compactSegmentLabel(item);
  const volume = formatVolume(item.volume, units);
  return label ? `${volume} ${label}` : volume;
}

function isQualityItem(item: RunStructureItem): boolean {
  if (item.kind === 'REPEAT') {
    return item.segments.some((segment) => isQualityLabel(compactSegmentLabel(segment)));
  }

  return isQualityLabel(compactSegmentLabel(item));
}

export function buildStructuredRunDisplayBlocks(
  session: PlannedSession | null,
  units: DistanceUnits,
  trainingPaceProfile?: TrainingPaceProfile | null,
): StructuredRunDisplayBlock[] | null {
  const structure = normalizeRunStructure(session?.runStructure);
  if (!structure) return null;

  return structure.items.map((item) => itemBlock(item, trainingPaceProfile, units));
}

export function buildStructuredRunDisplayLines(
  session: PlannedSession | null,
  units: DistanceUnits,
  trainingPaceProfile?: TrainingPaceProfile | null,
): StructuredRunDisplayLine[] | null {
  const blocks = buildStructuredRunDisplayBlocks(session, units, trainingPaceProfile);
  if (!blocks) return null;

  return blocks.flatMap((block) => {
    if (block.kind === 'line') {
      return [block.line];
    }

    return block.lines.map((line, index) => (
      index === 0 ? [token(`${block.repeatLabel} `), ...line] : line
    ));
  });
}

export function structuredRunDisplayText(lines: StructuredRunDisplayLine[]): string {
  return lines.map((line) => line.map((part) => part.text).join('')).join(', ');
}

export function structuredRunSummaryTitle(
  session: PlannedSession | null,
  units: DistanceUnits,
): string | null {
  const structure = normalizeRunStructure(session?.runStructure);
  if (!structure) return null;

  const primary = structure.items.find(isQualityItem) ?? structure.items[0];
  return `Structured ${compactItemSummary(primary, units)}`;
}
