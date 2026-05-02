import {
  RECOVERY_KM,
  RECOVERY_KM_PER_MIN,
  RUN_STRUCTURE_SEGMENT_KINDS,
  type IntervalRecovery,
  type IntensityTarget,
  type PlannedSession,
  type RecoveryDuration,
  type RunStructure,
  type RunStructureItem,
  type RunStructureRepeatGroup,
  type RunStructureSegment,
  type RunStructureSegmentKind,
  type RunStructureVolume,
  type SessionDurationSpec,
} from '../session';
import {
  getSessionIntensityTarget,
  normalizeIntensityTarget,
  representativePaceSeconds,
  representativeSessionPaceSeconds,
} from './intensity-targets';

export type SessionDemandLevel = 'rest' | 'recovery' | 'easy' | 'moderate' | 'demanding';

export interface SessionDemand {
  level: SessionDemandLevel;
  isQuality: boolean;
  reasons: string[];
}

export interface StructuredSessionVolume {
  exactKm: number;
  estimatedKm: number;
  plannedMinutes: number;
  structuredSeconds: number;
  structuredExactKm: number;
  structuredEstimatedKm: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSegmentKind(value: unknown): value is RunStructureSegmentKind {
  return typeof value === 'string'
    && RUN_STRUCTURE_SEGMENT_KINDS.includes(value as RunStructureSegmentKind);
}

function roundKm(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundSeconds(value: number): number {
  return Math.round(value);
}

function normalizePositiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

export function normalizePlannedVolume(
  value: SessionDurationSpec | null | undefined,
): SessionDurationSpec | undefined {
  const amount = normalizePositiveNumber(value?.value);
  if (!amount || (value?.unit !== 'km' && value?.unit !== 'min')) {
    return undefined;
  }

  return {
    unit: value.unit,
    value: amount,
  };
}

function normalizeRunStructureVolume(value: unknown): RunStructureVolume | undefined {
  if (!isRecord(value)) return undefined;

  const amount = normalizePositiveNumber(value.value);
  if (!amount) return undefined;

  if (value.unit !== 'km' && value.unit !== 'min' && value.unit !== 'sec') {
    return undefined;
  }

  return {
    unit: value.unit,
    value: amount,
  };
}

function normalizeIntensity(value: unknown): IntensityTarget | undefined {
  return normalizeIntensityTarget(value);
}

function normalizeProgression(value: unknown): RunStructureSegment['progression'] | undefined {
  if (!isRecord(value)) return undefined;

  const progression: RunStructureSegment['progression'] = {};
  const from = normalizeIntensity(value.from);
  const to = normalizeIntensity(value.to);
  if (from) progression.from = from;
  if (to) progression.to = to;

  return progression.from || progression.to ? progression : undefined;
}

function normalizeNote(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function normalizeSegment(value: unknown): RunStructureSegment | undefined {
  if (!isRecord(value) || !isSegmentKind(value.kind)) return undefined;

  const volume = normalizeRunStructureVolume(value.volume);
  if (!volume) return undefined;

  const segment: RunStructureSegment = {
    kind: value.kind,
    volume,
  };

  if (typeof value.id === 'string' && value.id.length > 0) segment.id = value.id;

  const intensityTarget = normalizeIntensity(value.intensityTarget);
  if (intensityTarget) segment.intensityTarget = intensityTarget;

  const progression = normalizeProgression(value.progression);
  if (progression) segment.progression = progression;

  const note = normalizeNote(value.note);
  if (note) segment.note = note;

  return segment;
}

function normalizeRepeatGroup(value: unknown): RunStructureRepeatGroup | undefined {
  if (!isRecord(value) || value.kind !== 'REPEAT') return undefined;

  const repeats = normalizePositiveNumber(value.repeats);
  if (!repeats || !Number.isInteger(repeats)) return undefined;

  if (!Array.isArray(value.segments) || value.segments.length === 0) {
    return undefined;
  }

  const segments = value.segments.map((segment) => (
    isRecord(segment) && segment.kind === 'REPEAT' ? undefined : normalizeSegment(segment)
  ));
  if (segments.some((segment) => !segment)) {
    return undefined;
  }

  const group: RunStructureRepeatGroup = {
    kind: 'REPEAT',
    repeats,
    segments: segments as RunStructureSegment[],
  };

  if (typeof value.id === 'string' && value.id.length > 0) group.id = value.id;

  const note = normalizeNote(value.note);
  if (note) group.note = note;

  return group;
}

function normalizeItem(value: unknown): RunStructureItem | undefined {
  if (!isRecord(value)) return undefined;
  return value.kind === 'REPEAT'
    ? normalizeRepeatGroup(value)
    : normalizeSegment(value);
}

export function normalizeRunStructure(
  value: RunStructure | null | undefined,
): RunStructure | undefined {
  if (!isRecord(value) || !Array.isArray(value.items) || value.items.length === 0) {
    return undefined;
  }

  const items = value.items.map(normalizeItem);
  if (items.some((item) => !item)) {
    return undefined;
  }

  return { items: items as RunStructureItem[] };
}

function recoveryKm(value: IntervalRecovery | null | undefined): number {
  if (!value) return 0;
  if (typeof value === 'string') return RECOVERY_KM[value as RecoveryDuration] ?? 0;
  if (value.unit === 'km') return value.value;
  return value.value * RECOVERY_KM_PER_MIN;
}

function simpleSessionExactKm(session: PlannedSession): number {
  if (session.type === 'REST') return 0;

  let total = 0;
  if (session.type === 'INTERVAL') {
    const reps = session.reps ?? 1;
    if (session.repDuration?.unit === 'km') {
      total += reps * session.repDuration.value;
    } else if (session.repDist) {
      total += reps * (session.repDist / 1000);
    }
    total += reps * recoveryKm(session.recovery);
  } else {
    total += session.distance ?? 0;
  }

  if (session.type === 'INTERVAL' || session.type === 'TEMPO') {
    if (session.warmup?.unit === 'km') total += session.warmup.value;
    if (session.cooldown?.unit === 'km') total += session.cooldown.value;
  }

  return total;
}

function estimateSecondsAsKm(seconds: number, paceSeconds: number | null): number {
  return paceSeconds && seconds > 0 ? seconds / paceSeconds : 0;
}

function topLevelVolume(
  session: PlannedSession,
): Pick<StructuredSessionVolume, 'exactKm' | 'estimatedKm' | 'plannedMinutes'> {
  const planned = normalizePlannedVolume(session.plannedVolume);
  if (planned?.unit === 'km') {
    return { exactKm: planned.value, estimatedKm: 0, plannedMinutes: 0 };
  }
  if (planned?.unit === 'min') {
    return {
      exactKm: 0,
      estimatedKm: estimateSecondsAsKm(
        planned.value * 60,
        representativeSessionPaceSeconds(session),
      ),
      plannedMinutes: planned.value,
    };
  }

  return {
    exactKm: simpleSessionExactKm(session),
    estimatedKm: simpleSessionEstimatedKm(session),
    plannedMinutes: 0,
  };
}

function simpleSessionEstimatedKm(session: PlannedSession): number {
  if (session.type !== 'INTERVAL') {
    return 0;
  }

  if (session.repDuration?.unit !== 'min') {
    return 0;
  }

  const reps = session.reps ?? 1;
  return reps * estimateSecondsAsKm(
    session.repDuration.value * 60,
    representativeSessionPaceSeconds(session),
  );
}

function volumeSeconds(volume: RunStructureVolume): number {
  if (volume.unit === 'sec') return volume.value;
  if (volume.unit === 'min') return volume.value * 60;
  return 0;
}

function segmentPaceSeconds(
  segment: RunStructureSegment,
  session: PlannedSession,
): number | null {
  return representativePaceSeconds(segment.intensityTarget)
    ?? representativePaceSeconds(segment.progression?.from)
    ?? representativePaceSeconds(segment.progression?.to)
    ?? representativeSessionPaceSeconds(session);
}

function addSegmentVolume(
  totals: StructuredSessionVolume,
  segment: RunStructureSegment,
  session: PlannedSession,
  multiplier = 1,
) {
  if (segment.volume.unit === 'km') {
    totals.structuredExactKm += segment.volume.value * multiplier;
    return;
  }

  const seconds = volumeSeconds(segment.volume) * multiplier;
  totals.structuredSeconds += seconds;

  const paceSeconds = segmentPaceSeconds(segment, session);
  if (paceSeconds) {
    totals.structuredEstimatedKm += (seconds / paceSeconds);
  }
}

function addItemVolume(
  totals: StructuredSessionVolume,
  item: RunStructureItem,
  session: PlannedSession,
) {
  if (item.kind === 'REPEAT') {
    item.segments.forEach((segment) => addSegmentVolume(totals, segment, session, item.repeats));
    return;
  }

  addSegmentVolume(totals, item, session);
}

export function structuredSessionVolume(session: PlannedSession | null): StructuredSessionVolume {
  const empty: StructuredSessionVolume = {
    exactKm: 0,
    estimatedKm: 0,
    plannedMinutes: 0,
    structuredSeconds: 0,
    structuredExactKm: 0,
    structuredEstimatedKm: 0,
  };
  if (!session || session.type === 'REST') return empty;

  const totals = { ...empty };
  const topLevel = topLevelVolume(session);
  totals.plannedMinutes = topLevel.plannedMinutes;

  const structure = normalizeRunStructure(session.runStructure);
  if (!structure) {
    return {
      ...totals,
      exactKm: roundKm(topLevel.exactKm),
      estimatedKm: roundKm(topLevel.estimatedKm),
      plannedMinutes: roundSeconds(totals.plannedMinutes),
    };
  }

  structure.items.forEach((item) => addItemVolume(totals, item, session));

  if (totals.structuredExactKm > 0) {
    totals.exactKm = totals.structuredExactKm;
  }

  if (totals.structuredEstimatedKm > 0) {
    totals.estimatedKm = totals.structuredEstimatedKm;
  }

  if (totals.exactKm === 0 && totals.estimatedKm === 0 && topLevel.exactKm > 0) {
    totals.exactKm = topLevel.exactKm;
  }

  return {
    ...totals,
    exactKm: roundKm(totals.exactKm),
    estimatedKm: roundKm(totals.estimatedKm),
    plannedMinutes: roundSeconds(totals.plannedMinutes),
    structuredSeconds: roundSeconds(totals.structuredSeconds),
    structuredExactKm: roundKm(totals.structuredExactKm),
    structuredEstimatedKm: roundKm(totals.structuredEstimatedKm),
  };
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function formatVolume(volume: RunStructureVolume): string {
  if (volume.unit === 'km') return `${formatNumber(volume.value)}km`;
  if (volume.unit === 'min') return `${formatNumber(volume.value)}min`;

  if (volume.value >= 60 && volume.value % 60 === 0) {
    return `${formatNumber(volume.value / 60)}min`;
  }
  if (volume.value > 60 && volume.value % 30 === 0) {
    return `${formatNumber(volume.value / 60)}min`;
  }
  return `${formatNumber(volume.value)}s`;
}

function intensityName(target: IntensityTarget | undefined): string | null {
  if (!target) return null;
  if (target.profileKey === 'marathon') return 'marathon pace';
  if (target.profileKey === 'threshold') return 'threshold';
  if (target.profileKey === 'interval') return 'VO2 range';
  if (target.profileKey === 'recovery') return 'very easy';
  if (target.profileKey === 'easy') return 'easy';
  if (target.effortCue === 'race pace') return 'race pace';
  return target.effortCue ?? null;
}

function segmentIntensityName(segment: RunStructureSegment): string | null {
  return intensityName(segment.intensityTarget)
    ?? intensityName(segment.progression?.to)
    ?? intensityName(segment.progression?.from);
}

function progressionSummary(segment: RunStructureSegment): string | null {
  const from = intensityName(segment.progression?.from);
  const to = intensityName(segment.progression?.to);
  if (!from && !to) return null;
  return `${formatVolume(segment.volume)} progression ${from ?? 'easy'} to ${to ?? 'hard'}`;
}

function summariseSegment(segment: RunStructureSegment): string {
  const progression = progressionSummary(segment);
  if (progression) return progression;

  const volume = formatVolume(segment.volume);
  const intensity = segmentIntensityName(segment);

  if (segment.kind === 'STRIDE') {
    return `${volume} stride`;
  }
  if (segment.kind === 'FLOAT') {
    return `${volume} float`;
  }
  if (segment.kind === 'RECOVERY') {
    return `${volume} recovery`;
  }
  if (intensity) {
    return `${volume} ${intensity}`;
  }
  return volume;
}

function sameVolume(a: RunStructureVolume, b: RunStructureVolume): boolean {
  return a.unit === b.unit && a.value === b.value;
}

function summariseRepeat(group: RunStructureRepeatGroup): string {
  const [first, second] = group.segments;

  if (
    group.segments.length === 2
    && first.kind === 'RUN'
    && second.kind === 'RECOVERY'
    && sameVolume(first.volume, second.volume)
    && !segmentIntensityName(first)
  ) {
    return `${group.repeats} x ${formatVolume(first.volume)} on/off`;
  }

  if (group.segments.length === 2 && first.kind === 'RUN' && second.kind === 'FLOAT') {
    const intensity = segmentIntensityName(first);
    const run = intensity
      ? `${formatVolume(first.volume)} ${intensity}`
      : formatVolume(first.volume);
    return `${group.repeats} x ${run} off ${formatVolume(second.volume)} float`;
  }

  if (group.segments.length === 2 && first.kind === 'RUN' && second.kind === 'RECOVERY') {
    const intensity = segmentIntensityName(first);
    const run = intensity
      ? `${formatVolume(first.volume)} ${intensity}`
      : formatVolume(first.volume);
    const recoveryLabel = segmentIntensityName(second) === 'easy' ? 'jog' : 'recovery';
    return `${group.repeats} x ${run}, ${formatVolume(second.volume)} ${recoveryLabel}`;
  }

  if (group.segments.length === 1 && first.kind === 'STRIDE') {
    return `${group.repeats} x ${formatVolume(first.volume)} strides`;
  }

  return `${group.repeats} x (${group.segments.map(summariseSegment).join(' + ')})`;
}

function summariseItem(item: RunStructureItem): string {
  return item.kind === 'REPEAT' ? summariseRepeat(item) : summariseSegment(item);
}

export function summariseRunStructure(session: PlannedSession | null): string | null {
  const structure = normalizeRunStructure(session?.runStructure);
  if (!structure) return null;
  return structure.items.map(summariseItem).join(', ');
}

function hasSegment(
  structure: RunStructure | undefined,
  predicate: (segment: RunStructureSegment) => boolean,
): boolean {
  if (!structure) return false;

  return structure.items.some((item) => {
    const segments = item.kind === 'REPEAT' ? item.segments : [item];
    return segments.some(predicate);
  });
}

function baseFocus(session: PlannedSession): string {
  switch (session.type) {
    case 'EASY':
      return 'Easy run';
    case 'INTERVAL':
      return 'Intervals';
    case 'TEMPO':
      return 'Tempo';
    case 'LONG':
      return 'Long run';
    case 'RECOVERY':
      return 'Recovery run';
    case 'REST':
      return 'Rest';
  }
}

export function deriveSessionFocus(session: PlannedSession | null): string {
  if (!session) return 'Rest';

  const base = baseFocus(session);
  const structure = normalizeRunStructure(session.runStructure);
  if (!structure || session.type === 'RECOVERY' || session.type === 'REST') {
    return base;
  }

  if (hasSegment(structure, (segment) => Boolean(segment.progression))) {
    return `${base} · Progression`;
  }
  if (hasSegment(structure, (segment) => segment.kind === 'STRIDE')) {
    return `${base} · Strides`;
  }
  if (hasSegment(structure, (segment) => segment.intensityTarget?.profileKey === 'marathon')) {
    return `${base} · Marathon pace`;
  }
  if (hasSegment(structure, (segment) => segment.intensityTarget?.profileKey === 'threshold')) {
    return `${base} · Threshold`;
  }
  if (session.type === 'INTERVAL' && structure.items.length > 1) {
    return `${base} · Fartlek`;
  }

  return base;
}

export function deriveSessionDemand(session: PlannedSession | null): SessionDemand {
  if (!session || session.type === 'REST') {
    return { level: 'rest', isQuality: false, reasons: ['Rest day'] };
  }
  if (session.type === 'RECOVERY') {
    return { level: 'recovery', isQuality: false, reasons: ['Recovery run'] };
  }

  const structure = normalizeRunStructure(session.runStructure);
  const volume = structuredSessionVolume(session);
  const hasStridesOnly = Boolean(structure)
    && hasSegment(structure, (segment) => segment.kind === 'STRIDE')
    && !hasSegment(structure, (segment) => (
      segment.kind === 'RUN'
      && ['marathon', 'threshold', 'interval'].includes(segment.intensityTarget?.profileKey ?? '')
    ));

  if (hasStridesOnly && session.type === 'EASY') {
    return { level: 'easy', isQuality: false, reasons: ['Easy run with strides'] };
  }

  const hasQualityStructure = Boolean(structure) && hasSegment(structure, (segment) => (
    ['marathon', 'threshold', 'interval'].includes(segment.intensityTarget?.profileKey ?? '')
  ));
  const isClassicQuality = session.type === 'INTERVAL' || session.type === 'TEMPO';
  const isLongDemand = session.type === 'LONG' && volume.exactKm >= 24;

  if (hasQualityStructure || isLongDemand) {
    return {
      level: 'demanding',
      isQuality: hasQualityStructure || isClassicQuality,
      reasons: [
        hasQualityStructure ? 'Structured quality work' : null,
        isLongDemand ? 'Long run volume' : null,
      ].filter((reason): reason is string => Boolean(reason)),
    };
  }

  if (isClassicQuality || session.type === 'LONG') {
    return {
      level: 'moderate',
      isQuality: isClassicQuality,
      reasons: [isClassicQuality ? 'Quality session' : 'Long run'],
    };
  }

  return { level: 'easy', isQuality: false, reasons: ['Easy aerobic run'] };
}

export function totalStructuredSessionKm(session: PlannedSession | null): number {
  const volume = structuredSessionVolume(session);
  return roundKm(volume.exactKm + volume.estimatedKm);
}

export function plannedSessionMinutes(session: PlannedSession | null): number {
  return structuredSessionVolume(session).plannedMinutes;
}

export function structuredSessionSeconds(session: PlannedSession | null): number {
  return structuredSessionVolume(session).structuredSeconds;
}

export function getSessionIntentSummary(session: PlannedSession | null): string | null {
  if (!session || session.type === 'REST') return null;

  const structure = summariseRunStructure(session);
  if (structure) return structure;

  const target = getSessionIntensityTarget(session);
  if (session.type === 'RECOVERY') {
    return intensityName(target) ?? 'very easy';
  }
  return null;
}
