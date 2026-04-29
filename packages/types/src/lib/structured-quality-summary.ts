import type { Activity, ActivitySplit } from '../activity';
import type { PlannedSession, RecoveryDuration } from '../session';
import { normalizeSessionDuration, RECOVERY_KM, RECOVERY_KM_PER_MIN } from '../session';
import { getSessionIntensityTarget, parsePaceSeconds } from './intensity-targets';

export type StructuredQualitySummaryStatus = 'available' | 'unavailable' | 'not-applicable';
export type StructuredQualitySummaryReason =
  | 'not-structured-quality-session'
  | 'insufficient-structured-data';

export interface StructuredQualityTargetPaceRange {
  min: string;
  max: string;
  minSecondsPerKm: number;
  maxSecondsPerKm: number;
}

export interface StructuredIntervalRepSummary {
  planned: number;
  found: number;
  inTargetRange: number | null;
}

export interface AvailableStructuredQualitySummary {
  status: 'available';
  sessionType: 'INTERVAL' | 'TEMPO';
  qualityDistanceKm: number;
  averagePaceSecondsPerKm: number;
  averageHeartRateBpm: number | null;
  targetPaceRange: StructuredQualityTargetPaceRange | null;
  intervalReps?: StructuredIntervalRepSummary;
}

export interface UnavailableStructuredQualitySummary {
  status: 'unavailable' | 'not-applicable';
  sessionType: PlannedSession['type'];
  reason: StructuredQualitySummaryReason;
}

export type StructuredQualitySummary =
  | AvailableStructuredQualitySummary
  | UnavailableStructuredQualitySummary;

interface QualitySplit {
  distanceKm: number;
  paceSecondsPerKm: number;
  heartRateBpm: number | null;
}

interface IntervalPart {
  kind: 'work' | 'context';
  distanceKm: number;
}

interface SplitSpan {
  index: number;
  split: ActivitySplit;
  distanceKm: number;
  startKm: number;
  endKm: number;
}

const DISTANCE_TOLERANCE_RATIO = 0.2;
const DISTANCE_TOLERANCE_MIN_KM = 0.05;

function unavailable(
  session: PlannedSession,
  reason: StructuredQualitySummaryReason,
): UnavailableStructuredQualitySummary {
  return {
    status: reason === 'not-structured-quality-session' ? 'not-applicable' : 'unavailable',
    sessionType: session.type,
    reason,
  };
}

function splitDistanceKm(split: ActivitySplit): number {
  return typeof split.distance === 'number' && Number.isFinite(split.distance) && split.distance > 0
    ? split.distance
    : 1;
}

function toQualitySplit(split: ActivitySplit): QualitySplit | null {
  const distanceKm = splitDistanceKm(split);
  if (!Number.isFinite(split.pace) || split.pace <= 0) {
    return null;
  }

  return {
    distanceKm,
    paceSecondsPerKm: split.pace,
    heartRateBpm: typeof split.hr === 'number' && Number.isFinite(split.hr) && split.hr > 0
      ? split.hr
      : null,
  };
}

function distanceMatches(actualKm: number, targetKm: number): boolean {
  const tolerance = Math.max(targetKm * DISTANCE_TOLERANCE_RATIO, DISTANCE_TOLERANCE_MIN_KM);
  return Math.abs(actualKm - targetKm) <= tolerance;
}

function intervalRepDistanceKm(session: PlannedSession): number | null {
  const repDuration = normalizeSessionDuration(session.repDuration);
  if (repDuration?.unit === 'km') {
    return repDuration.value;
  }

  if (typeof session.repDist === 'number' && Number.isFinite(session.repDist) && session.repDist > 0) {
    return session.repDist / 1000;
  }

  return null;
}

function intervalRecoveryDistanceKm(session: PlannedSession): number | null {
  const recovery = session.recovery;
  if (!recovery) {
    return 0;
  }

  if (typeof recovery === 'string') {
    return RECOVERY_KM[recovery as RecoveryDuration] ?? 0;
  }

  if (typeof recovery.value !== 'number' || !Number.isFinite(recovery.value) || recovery.value <= 0) {
    return 0;
  }

  return recovery.unit === 'km'
    ? recovery.value
    : recovery.value * RECOVERY_KM_PER_MIN;
}

function buildIntervalParts(
  plannedReps: number,
  repDistanceKm: number,
  warmupKm: number,
  recoveryKm: number,
  cooldownKm: number,
): IntervalPart[] {
  const parts: IntervalPart[] = [];

  if (warmupKm > 0) {
    parts.push({ kind: 'context', distanceKm: warmupKm });
  }

  for (let rep = 0; rep < plannedReps; rep += 1) {
    parts.push({ kind: 'work', distanceKm: repDistanceKm });

    if (recoveryKm > 0) {
      parts.push({ kind: 'context', distanceKm: recoveryKm });
    }
  }

  if (cooldownKm > 0) {
    parts.push({ kind: 'context', distanceKm: cooldownKm });
  }

  return parts;
}

function buildSplitSpans(splits: ActivitySplit[]): SplitSpan[] {
  let cursorKm = 0;

  return splits.map((split, index) => {
    const distanceKm = splitDistanceKm(split);
    const startKm = cursorKm;
    const endKm = startKm + distanceKm;
    cursorKm = endKm;

    return {
      index,
      split,
      distanceKm,
      startKm,
      endKm,
    };
  });
}

function splitMidpointKm(span: SplitSpan): number {
  return span.startKm + span.distanceKm / 2;
}

function hasRecoverySeparators(workSpans: SplitSpan[]): boolean {
  return workSpans.every((span, index) => (
    index === 0 || span.index > workSpans[index - 1].index + 1
  ));
}

function classifyIntervalWorkSplitsByRepDistance(
  splits: ActivitySplit[],
  plannedReps: number,
  repDistanceKm: number,
  warmupKm: number,
  recoveryKm: number,
  cooldownKm: number,
): QualitySplit[] | null {
  const spans = buildSplitSpans(splits);
  const totalDistanceKm = spans.at(-1)?.endKm ?? 0;
  const cooldownStartKm = Math.max(0, totalDistanceKm - cooldownKm);
  let workSpans = spans.filter((span) => distanceMatches(span.distanceKm, repDistanceKm));

  if (warmupKm > 0) {
    workSpans = workSpans.filter((span) => splitMidpointKm(span) >= warmupKm);
  }

  if (cooldownKm > 0 && workSpans.length > plannedReps) {
    workSpans = workSpans.filter((span) => splitMidpointKm(span) <= cooldownStartKm);
  }

  if (workSpans.length !== plannedReps) {
    return null;
  }

  if (recoveryKm > 0 && plannedReps > 1 && !hasRecoverySeparators(workSpans)) {
    return null;
  }

  return workSpans
    .map((span) => toQualitySplit(span.split))
    .filter((split): split is QualitySplit => split != null);
}

function classifyIntervalWorkSplits(
  session: PlannedSession,
  splits: ActivitySplit[],
  plannedReps: number,
  repDistanceKm: number,
  warmupKm: number,
  cooldownKm: number,
): QualitySplit[] | null {
  const recoveryKm = intervalRecoveryDistanceKm(session);
  if (recoveryKm == null) {
    return null;
  }

  const parts = buildIntervalParts(plannedReps, repDistanceKm, warmupKm, recoveryKm, cooldownKm);
  const hasContextParts = parts.some((part) => part.kind === 'context');

  if (!hasContextParts) {
    return splits
      .filter((split) => distanceMatches(splitDistanceKm(split), repDistanceKm))
      .slice(0, plannedReps)
      .map(toQualitySplit)
      .filter((split): split is QualitySplit => split != null);
  }

  if (parts.length === splits.length) {
    const matchesPattern = parts.every((part, index) => (
      distanceMatches(splitDistanceKm(splits[index]), part.distanceKm)
    ));
    if (matchesPattern) {
      return parts
        .map((part, index) => (part.kind === 'work' ? toQualitySplit(splits[index]) : null))
        .filter((split): split is QualitySplit => split != null);
    }
  }

  return classifyIntervalWorkSplitsByRepDistance(
    splits,
    plannedReps,
    repDistanceKm,
    warmupKm,
    recoveryKm,
    cooldownKm,
  );
}

function targetPaceRange(session: PlannedSession): StructuredQualityTargetPaceRange | null {
  const target = getSessionIntensityTarget(session);
  const range = target?.paceRange
    ?? (target?.pace ? { min: target.pace, max: target.pace } : undefined);
  if (!range) {
    return null;
  }

  const minSecondsPerKm = parsePaceSeconds(range.min);
  const maxSecondsPerKm = parsePaceSeconds(range.max);
  if (minSecondsPerKm == null || maxSecondsPerKm == null) {
    return null;
  }

  return {
    min: range.min,
    max: range.max,
    minSecondsPerKm,
    maxSecondsPerKm,
  };
}

function summarizeSplits(splits: QualitySplit[]): Pick<
  AvailableStructuredQualitySummary,
  'qualityDistanceKm' | 'averagePaceSecondsPerKm' | 'averageHeartRateBpm'
> | null {
  const totalDistanceKm = splits.reduce((total, split) => total + split.distanceKm, 0);
  if (totalDistanceKm <= 0) {
    return null;
  }

  const totalSeconds = splits.reduce(
    (total, split) => total + split.paceSecondsPerKm * split.distanceKm,
    0,
  );
  const heartRateSplits = splits.filter((split) => split.heartRateBpm != null);
  const averageHeartRateBpm = heartRateSplits.length > 0
    ? Math.round(
      heartRateSplits.reduce(
        (total, split) => total + split.heartRateBpm! * split.distanceKm,
        0,
      ) / heartRateSplits.reduce((total, split) => total + split.distanceKm, 0),
    )
    : null;

  return {
    qualityDistanceKm: Math.round(totalDistanceKm * 100) / 100,
    averagePaceSecondsPerKm: Math.round(totalSeconds / totalDistanceKm),
    averageHeartRateBpm,
  };
}

function buildIntervalSummary(
  session: PlannedSession,
  activity: Activity,
): StructuredQualitySummary {
  const plannedReps = session.reps;
  const repDistanceKm = intervalRepDistanceKm(session);
  const warmupKm = distanceDurationKm(session.warmup);
  const cooldownKm = distanceDurationKm(session.cooldown);
  if (
    !plannedReps
    || plannedReps <= 0
    || !repDistanceKm
    || warmupKm == null
    || cooldownKm == null
    || activity.splits.length === 0
  ) {
    return unavailable(session, 'insufficient-structured-data');
  }

  const qualitySplits = classifyIntervalWorkSplits(
    session,
    activity.splits,
    plannedReps,
    repDistanceKm,
    warmupKm,
    cooldownKm,
  );

  if (!qualitySplits || qualitySplits.length !== plannedReps) {
    return unavailable(session, 'insufficient-structured-data');
  }

  const summary = summarizeSplits(qualitySplits);
  if (!summary) {
    return unavailable(session, 'insufficient-structured-data');
  }

  const targetRange = targetPaceRange(session);
  const inTargetRange = targetRange
    ? qualitySplits.filter((split) => (
      split.paceSecondsPerKm >= targetRange.minSecondsPerKm
      && split.paceSecondsPerKm <= targetRange.maxSecondsPerKm
    )).length
    : null;

  return {
    status: 'available',
    sessionType: 'INTERVAL',
    ...summary,
    intervalReps: {
      planned: plannedReps,
      found: qualitySplits.length,
      inTargetRange,
    },
    targetPaceRange: targetRange,
  };
}

function distanceDurationKm(
  value: PlannedSession['warmup'] | PlannedSession['cooldown'],
): number | null {
  const normalized = normalizeSessionDuration(value);
  if (!normalized) {
    return 0;
  }

  return normalized.unit === 'km' ? normalized.value : null;
}

function splitWindowByDistance(
  splits: ActivitySplit[],
  startKm: number,
  distanceKm: number,
): QualitySplit[] {
  const endKm = startKm + distanceKm;
  let cursorKm = 0;
  const window: QualitySplit[] = [];

  for (const split of splits) {
    const splitDistance = splitDistanceKm(split);
    const splitStartKm = cursorKm;
    const splitEndKm = cursorKm + splitDistance;
    cursorKm = splitEndKm;

    const overlapStartKm = Math.max(startKm, splitStartKm);
    const overlapEndKm = Math.min(endKm, splitEndKm);
    const overlapKm = overlapEndKm - overlapStartKm;
    if (overlapKm <= 0) {
      continue;
    }

    const qualitySplit = toQualitySplit(split);
    if (!qualitySplit) {
      continue;
    }

    window.push({
      ...qualitySplit,
      distanceKm: overlapKm,
    });
  }

  return window;
}

function buildTempoSummary(
  session: PlannedSession,
  activity: Activity,
): StructuredQualitySummary {
  const tempoDistanceKm = session.distance;
  const warmupKm = distanceDurationKm(session.warmup);
  if (
    typeof tempoDistanceKm !== 'number'
    || !Number.isFinite(tempoDistanceKm)
    || tempoDistanceKm <= 0
    || warmupKm == null
    || activity.splits.length === 0
  ) {
    return unavailable(session, 'insufficient-structured-data');
  }

  const qualitySplits = splitWindowByDistance(activity.splits, warmupKm, tempoDistanceKm);
  const summary = summarizeSplits(qualitySplits);
  if (!summary || !distanceMatches(summary.qualityDistanceKm, tempoDistanceKm)) {
    return unavailable(session, 'insufficient-structured-data');
  }

  return {
    status: 'available',
    sessionType: 'TEMPO',
    ...summary,
    targetPaceRange: targetPaceRange(session),
  };
}

export function buildStructuredQualitySummary(
  session: PlannedSession,
  activity: Activity,
): StructuredQualitySummary {
  if (session.type === 'INTERVAL') {
    return buildIntervalSummary(session, activity);
  }

  if (session.type === 'TEMPO') {
    return buildTempoSummary(session, activity);
  }

  return unavailable(session, 'not-structured-quality-session');
}
