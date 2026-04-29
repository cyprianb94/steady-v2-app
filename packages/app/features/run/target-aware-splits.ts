import {
  getSessionIntensityTarget,
  parsePaceSeconds,
  RECOVERY_KM,
  RECOVERY_KM_PER_MIN,
  sessionDurationKm,
  type ActivitySplit,
  type PlannedSession,
  type RecoveryDuration,
} from '@steady/types';
import {
  formatPace,
  formatSplitLabel,
  inferSplitLabelMode,
  type DistanceUnits,
  type SplitLabelMode,
} from '../../lib/units';

export type TargetAwareSplitComparisonMode = 'average' | 'target';
export type TargetAwareSplitKind = 'split' | 'warmup' | 'work' | 'recovery' | 'cooldown';
export type TargetAwareSplitTargetStatus = 'fast' | 'on-target' | 'slow';
export type AveragePaceComparisonDirection = 'fast' | 'slow' | 'average';

export interface AveragePaceComparison {
  direction: AveragePaceComparisonDirection;
  label: string;
  widthPercent: number;
}

export interface TargetAwareSplitRow {
  id: string;
  kind: TargetAwareSplitKind;
  label: string;
  distanceKm: number | null;
  paceSeconds: number;
  paceLabel: string;
  heartRate: number | null;
  heartRateLabel: string;
  elapsedSeconds: number | null;
  elapsedLabel: string | null;
  repIndex: number | null;
  comparisonLabel: string | null;
  targetStatus: TargetAwareSplitTargetStatus | null;
}

export interface TargetAwareSplitsModel {
  summaryLabel: 'per km' | 'segments';
  labelMode: SplitLabelMode;
  comparisonMode: TargetAwareSplitComparisonMode;
  comparisonHeader: 'VS AVERAGE' | 'VS TARGET';
  rows: TargetAwareSplitRow[];
}

export interface BuildTargetAwareSplitsOptions {
  session?: PlannedSession | null;
  splits: ActivitySplit[];
  units: DistanceUnits;
}

interface PaceTargetRange {
  fastestSeconds: number;
  slowestSeconds: number;
}

interface PlannedIntervalPart {
  kind: Exclude<TargetAwareSplitKind, 'split'>;
  distanceKm: number;
  repIndex: number | null;
}

interface SplitSpan {
  index: number;
  distanceKm: number;
  startKm: number;
  endKm: number;
}

const DISTANCE_TOLERANCE_KM = 0.05;
const DISTANCE_TOLERANCE_RATIO = 0.08;
const PACE_TARGET_TOLERANCE_SECONDS = 2;
const AVERAGE_RAIL_MAX_WIDTH_PERCENT = 46;

function parseLabelDistanceKm(label: string | undefined): number | null {
  if (!label) {
    return null;
  }

  const trimmed = label.trim();
  const kmMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*km$/i);
  if (kmMatch) {
    return Number(kmMatch[1]);
  }

  const metreMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*m$/i);
  if (metreMatch) {
    return Number(metreMatch[1]) / 1000;
  }

  return null;
}

function splitDistanceKm(split: ActivitySplit): number | null {
  if (typeof split.distance === 'number' && Number.isFinite(split.distance) && split.distance > 0) {
    return split.distance;
  }

  return parseLabelDistanceKm(split.label);
}

function intervalRepDistanceKm(session: PlannedSession): number {
  if (session.repDuration?.unit === 'km' && session.repDuration.value > 0) {
    return session.repDuration.value;
  }

  return session.repDist && session.repDist > 0 ? session.repDist / 1000 : 0;
}

function recoveryDistanceKm(session: PlannedSession): number {
  const recovery = session.recovery;
  if (!recovery) {
    return 0;
  }

  if (typeof recovery === 'string') {
    return RECOVERY_KM[recovery as RecoveryDuration] ?? 0;
  }

  if (recovery.unit === 'km') {
    return recovery.value > 0 ? recovery.value : 0;
  }

  return recovery.value > 0 ? recovery.value * RECOVERY_KM_PER_MIN : 0;
}

function matchesDistance(actualKm: number | null, expectedKm: number): boolean {
  if (actualKm == null || expectedKm <= 0) {
    return false;
  }

  const tolerance = Math.max(DISTANCE_TOLERANCE_KM, expectedKm * DISTANCE_TOLERANCE_RATIO);
  return Math.abs(actualKm - expectedKm) <= tolerance;
}

function buildPlannedIntervalParts(session: PlannedSession): PlannedIntervalPart[] {
  const reps = session.reps && session.reps > 0 ? session.reps : 0;
  const repKm = intervalRepDistanceKm(session);
  if (session.type !== 'INTERVAL' || reps === 0 || repKm <= 0) {
    return [];
  }

  const parts: PlannedIntervalPart[] = [];
  const warmupKm = sessionDurationKm(session.warmup);
  const cooldownKm = sessionDurationKm(session.cooldown);
  const recoveryKm = recoveryDistanceKm(session);

  if (warmupKm > 0) {
    parts.push({ kind: 'warmup', distanceKm: warmupKm, repIndex: null });
  }

  for (let index = 1; index <= reps; index += 1) {
    parts.push({ kind: 'work', distanceKm: repKm, repIndex: index });
    if (recoveryKm > 0) {
      parts.push({ kind: 'recovery', distanceKm: recoveryKm, repIndex: null });
    }
  }

  if (cooldownKm > 0) {
    parts.push({ kind: 'cooldown', distanceKm: cooldownKm, repIndex: null });
  }

  return parts;
}

function buildSplitSpans(splits: ActivitySplit[]): SplitSpan[] | null {
  let cursorKm = 0;
  const spans: SplitSpan[] = [];

  for (const [index, split] of splits.entries()) {
    const distanceKm = splitDistanceKm(split);
    if (distanceKm == null || distanceKm <= 0) {
      return null;
    }

    const startKm = cursorKm;
    const endKm = startKm + distanceKm;
    spans.push({
      index,
      distanceKm,
      startKm,
      endKm,
    });
    cursorKm = endKm;
  }

  return spans;
}

function splitSpanMidpointKm(span: SplitSpan): number {
  return span.startKm + span.distanceKm / 2;
}

function hasRecoverySeparators(workSpans: SplitSpan[]): boolean {
  return workSpans.every((span, index) => (
    index === 0 || span.index > workSpans[index - 1].index + 1
  ));
}

function classifyIntervalSplitsByRepDistance(
  session: PlannedSession,
  splits: ActivitySplit[],
): Array<Pick<TargetAwareSplitRow, 'kind' | 'repIndex'>> | null {
  const reps = session.reps && session.reps > 0 ? session.reps : 0;
  const repKm = intervalRepDistanceKm(session);
  const spans = buildSplitSpans(splits);
  if (reps === 0 || repKm <= 0 || spans == null) {
    return null;
  }

  const warmupKm = sessionDurationKm(session.warmup);
  const cooldownKm = sessionDurationKm(session.cooldown);
  const recoveryKm = recoveryDistanceKm(session);
  const totalDistanceKm = spans.length > 0 ? spans[spans.length - 1].endKm : 0;
  const cooldownStartKm = Math.max(0, totalDistanceKm - cooldownKm);
  let workSpans = spans.filter((span) => matchesDistance(span.distanceKm, repKm));

  if (warmupKm > 0) {
    workSpans = workSpans.filter((span) => splitSpanMidpointKm(span) >= warmupKm);
  }

  if (cooldownKm > 0 && workSpans.length > reps) {
    workSpans = workSpans.filter((span) => splitSpanMidpointKm(span) <= cooldownStartKm);
  }

  if (workSpans.length !== reps) {
    return null;
  }

  if (recoveryKm > 0 && reps > 1 && !hasRecoverySeparators(workSpans)) {
    return null;
  }

  const firstWorkIndex = workSpans[0].index;
  const lastWorkIndex = workSpans[workSpans.length - 1].index;
  const workRepBySplitIndex = new Map(
    workSpans.map((span, index) => [span.index, index + 1]),
  );

  return splits.map((_, index) => {
    const repIndex = workRepBySplitIndex.get(index);
    if (repIndex != null) {
      return { kind: 'work', repIndex };
    }

    if (index < firstWorkIndex) {
      return { kind: warmupKm > 0 ? 'warmup' : 'split', repIndex: null };
    }

    if (index > lastWorkIndex) {
      if (recoveryKm > 0 && index === lastWorkIndex + 1) {
        return { kind: 'recovery', repIndex: null };
      }

      return { kind: cooldownKm > 0 ? 'cooldown' : 'split', repIndex: null };
    }

    return { kind: recoveryKm > 0 ? 'recovery' : 'split', repIndex: null };
  });
}

function classifyIntervalSplits(
  session: PlannedSession | null | undefined,
  splits: ActivitySplit[],
): Array<Pick<TargetAwareSplitRow, 'kind' | 'repIndex'>> | null {
  if (!session || session.type !== 'INTERVAL') {
    return null;
  }

  const parts = buildPlannedIntervalParts(session);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === splits.length) {
    const splitDistances = splits.map(splitDistanceKm);
    const allPartsMatch = parts.every((part, index) => matchesDistance(splitDistances[index], part.distanceKm));
    if (allPartsMatch) {
      return parts.map((part) => ({ kind: part.kind, repIndex: part.repIndex }));
    }
  }

  return classifyIntervalSplitsByRepDistance(session, splits);
}

function classifyTempoSplits(
  session: PlannedSession | null | undefined,
  splits: ActivitySplit[],
): Array<Pick<TargetAwareSplitRow, 'kind' | 'repIndex'>> | null {
  if (!session || session.type !== 'TEMPO' || !session.distance || session.distance <= 0) {
    return null;
  }

  const warmupKm = sessionDurationKm(session.warmup);
  const tempoKm = session.distance;
  const cooldownKm = sessionDurationKm(session.cooldown);
  const parts: PlannedIntervalPart[] = [
    ...(warmupKm > 0 ? [{ kind: 'warmup' as const, distanceKm: warmupKm, repIndex: null }] : []),
    { kind: 'work', distanceKm: tempoKm, repIndex: null },
    ...(cooldownKm > 0 ? [{ kind: 'cooldown' as const, distanceKm: cooldownKm, repIndex: null }] : []),
  ];

  if (parts.length === splits.length) {
    const splitDistances = splits.map(splitDistanceKm);
    const allPartsMatch = parts.every((part, index) => matchesDistance(splitDistances[index], part.distanceKm));
    if (allPartsMatch) {
      return parts.map((part) => ({ kind: part.kind, repIndex: part.repIndex }));
    }
  }

  const spans = buildSplitSpans(splits);
  if (!spans) {
    return null;
  }

  const tempoStartKm = warmupKm;
  const tempoEndKm = warmupKm + tempoKm;
  const classifications = spans.map((span): Pick<TargetAwareSplitRow, 'kind' | 'repIndex'> => {
    const midpoint = splitSpanMidpointKm(span);
    if (midpoint < tempoStartKm) {
      return { kind: warmupKm > 0 ? 'warmup' : 'split', repIndex: null };
    }
    if (midpoint <= tempoEndKm) {
      return { kind: 'work', repIndex: null };
    }
    return { kind: cooldownKm > 0 ? 'cooldown' : 'split', repIndex: null };
  });

  return classifications.some((classification) => classification.kind === 'work')
    ? classifications
    : null;
}

function classifyTargetSplits(
  session: PlannedSession | null | undefined,
  splits: ActivitySplit[],
): Array<Pick<TargetAwareSplitRow, 'kind' | 'repIndex'>> | null {
  if (session?.type === 'INTERVAL') {
    return classifyIntervalSplits(session, splits);
  }

  if (session?.type === 'TEMPO') {
    return classifyTempoSplits(session, splits);
  }

  return null;
}

function targetRange(session: PlannedSession | null | undefined): PaceTargetRange | null {
  if (!session) {
    return null;
  }

  const target = getSessionIntensityTarget(session);
  if (!target?.paceRange) {
    return null;
  }

  const minSeconds = parsePaceSeconds(target.paceRange.min);
  const maxSeconds = parsePaceSeconds(target.paceRange.max);
  if (minSeconds == null || maxSeconds == null) {
    return null;
  }

  return {
    fastestSeconds: Math.min(minSeconds, maxSeconds),
    slowestSeconds: Math.max(minSeconds, maxSeconds),
  };
}

function formatElapsed(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function elapsedSeconds(split: ActivitySplit): number | null {
  const distanceKm = splitDistanceKm(split);
  if (distanceKm == null || split.pace <= 0) {
    return null;
  }

  return distanceKm * split.pace;
}

function targetComparison(
  split: ActivitySplit,
  range: PaceTargetRange | null,
  isWorkRep: boolean,
): Pick<TargetAwareSplitRow, 'comparisonLabel' | 'targetStatus'> {
  if (!range || !isWorkRep) {
    return { comparisonLabel: null, targetStatus: null };
  }

  if (split.pace < range.fastestSeconds - PACE_TARGET_TOLERANCE_SECONDS) {
    return { comparisonLabel: 'FAST', targetStatus: 'fast' };
  }

  if (split.pace > range.slowestSeconds + PACE_TARGET_TOLERANCE_SECONDS) {
    return { comparisonLabel: 'SLOW', targetStatus: 'slow' };
  }

  return { comparisonLabel: 'ON TARGET', targetStatus: 'on-target' };
}

function defaultClassification(): Pick<TargetAwareSplitRow, 'kind' | 'repIndex'> {
  return { kind: 'split', repIndex: null };
}

export function buildAveragePaceComparison({
  splitPaceSeconds,
  averagePaceSeconds,
  maxDeltaSeconds,
}: {
  splitPaceSeconds: number;
  averagePaceSeconds: number;
  maxDeltaSeconds: number;
}): AveragePaceComparison {
  const deltaSeconds = Math.round(splitPaceSeconds - averagePaceSeconds);
  const absDeltaSeconds = Math.abs(deltaSeconds);

  if (absDeltaSeconds === 0 || maxDeltaSeconds <= 0) {
    return {
      direction: 'average',
      label: 'avg',
      widthPercent: 0,
    };
  }

  const direction: AveragePaceComparisonDirection = deltaSeconds < 0 ? 'fast' : 'slow';
  return {
    direction,
    label: `${absDeltaSeconds}s ${direction}`,
    widthPercent: Math.min(
      AVERAGE_RAIL_MAX_WIDTH_PERCENT,
      (absDeltaSeconds / maxDeltaSeconds) * AVERAGE_RAIL_MAX_WIDTH_PERCENT,
    ),
  };
}

export function buildTargetAwareSplitsModel({
  session,
  splits,
  units,
}: BuildTargetAwareSplitsOptions): TargetAwareSplitsModel {
  const labelMode = inferSplitLabelMode(session, splits);
  const range = targetRange(session);
  const targetClassifications = classifyTargetSplits(session, splits);
  const hasTargetComparableRows = targetClassifications?.some((classification) => classification.kind === 'work') ?? false;
  const comparisonMode: TargetAwareSplitComparisonMode = range && hasTargetComparableRows ? 'target' : 'average';

  return {
    summaryLabel: labelMode === 'segment' ? 'segments' : 'per km',
    labelMode,
    comparisonMode,
    comparisonHeader: comparisonMode === 'target' ? 'VS TARGET' : 'VS AVERAGE',
    rows: splits.map((split, index) => {
      const classification = targetClassifications?.[index] ?? defaultClassification();
      const distanceKm = splitDistanceKm(split);
      const elapsed = session?.type === 'INTERVAL' && classification.kind === 'work'
        ? elapsedSeconds(split)
        : null;
      const comparison = comparisonMode === 'target'
        ? targetComparison(split, range, classification.kind === 'work')
        : { comparisonLabel: null, targetStatus: null };

      return {
        id: `${split.km}-${split.label ?? index}`,
        kind: classification.kind,
        label: classification.kind === 'work' && classification.repIndex
          ? `Rep ${classification.repIndex}`
          : formatSplitLabel(split, units, { mode: labelMode }),
        distanceKm,
        paceSeconds: split.pace,
        paceLabel: formatPace(split.pace, units),
        heartRate: typeof split.hr === 'number' ? split.hr : null,
        heartRateLabel: split.hr ? `${Math.round(split.hr)} bpm` : '—',
        elapsedSeconds: elapsed,
        elapsedLabel: elapsed == null ? null : formatElapsed(elapsed),
        repIndex: classification.repIndex,
        comparisonLabel: comparison.comparisonLabel,
        targetStatus: comparison.targetStatus,
      };
    }),
  };
}
