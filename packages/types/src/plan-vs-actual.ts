import type { Activity } from './activity';
import type { IntensityTarget, PlannedSession } from './session';
import { getSessionIntensityTarget, parsePaceSeconds, secondsToPace } from './lib/intensity-targets';
import { sessionKm } from './lib/session-km';

// Distance within +/-5% is considered "close enough" to plan.
export const DISTANCE_TOLERANCE_PCT = 0.05;
// At 15% short or more, the run is materially cut short.
export const DISTANCE_SHORT_PCT = 0.15;
// More than 5 sec/km faster than target is meaningfully quicker than prescribed.
export const PACE_FAST_SEC = 5;
// More than 10 sec/km slower than target reads as a deliberate easing-off.
export const PACE_SLOW_SEC = 10;
// v1 uses a global Zone 2 ceiling until per-user HR zones arrive.
export const HR_ZONE2_MAX_BPM = 150;

export type PvaHeadline =
  | 'on-target'
  | 'crushed-it'
  | 'eased-in'
  | 'cut-short'
  | 'bonus-effort'
  | 'under-distance'
  | 'over-pace'
  | 'hr-high';

export type PvaVerdictKind = 'distance' | 'pace' | 'hr' | 'duration' | 'elevation';
export type PvaVerdictStatus = 'ok' | 'warn' | 'info';

export interface PvaVerdict {
  kind: PvaVerdictKind;
  status: PvaVerdictStatus;
  fact: string;
}

export interface PvaRow {
  label: string;
  planned: string;
  actual: string;
}

export interface PvaResult {
  headline: PvaHeadline;
  verdicts: PvaVerdict[];
  rows: PvaRow[];
}

type PaceRelation = 'fast' | 'slow' | null;

type ResolvedPaceTarget = {
  plannedLabel: string;
  effortLedEasyRecovery: boolean;
} & (
  | {
      kind: 'single';
      seconds: number;
    }
  | {
      kind: 'range';
      fastestSeconds: number;
      slowestSeconds: number;
    }
);

interface PaceAssessment {
  target: ResolvedPaceTarget | null;
  relation: PaceRelation;
  verdict: PvaVerdict | null;
}

function formatDistance(distance: number): string {
  const fixed = distance.toFixed(2);
  if (fixed.endsWith('00')) {
    return distance.toFixed(1);
  }
  if (fixed.endsWith('0')) {
    return fixed.slice(0, -1);
  }
  return fixed;
}

function formatSignedPaceDelta(deltaSeconds: number): string {
  return `${Math.abs(deltaSeconds)} sec/km`;
}

function lowerSessionType(session: PlannedSession): string {
  switch (session.type) {
    case 'INTERVAL':
      return 'interval';
    case 'TEMPO':
      return 'tempo';
    case 'LONG':
      return 'long run';
    case 'EASY':
    default:
      return 'easy';
  }
}

function isEasyRecoveryEffortLedTarget(session: PlannedSession, target: IntensityTarget): boolean {
  if (session.type !== 'EASY' && session.type !== 'LONG') {
    return false;
  }

  const easyRecoveryProfile = target.profileKey === 'easy' || target.profileKey === 'recovery';
  const easyRecoveryCue = target.effortCue === 'very easy' || target.effortCue === 'conversational';
  return Boolean(target.effortCue && (easyRecoveryProfile || easyRecoveryCue));
}

function resolvePaceTarget(session: PlannedSession): ResolvedPaceTarget | null {
  const target = getSessionIntensityTarget(session);
  if (!target) {
    return null;
  }

  const effortLedEasyRecovery = isEasyRecoveryEffortLedTarget(session, target);

  if (target.paceRange) {
    const fastestSeconds = parsePaceSeconds(target.paceRange.min);
    const slowestSeconds = parsePaceSeconds(target.paceRange.max);
    if (fastestSeconds == null || slowestSeconds == null) {
      return null;
    }

    return {
      kind: 'range',
      fastestSeconds,
      slowestSeconds,
      plannedLabel: `${secondsToPace(fastestSeconds)}-${secondsToPace(slowestSeconds)}`,
      effortLedEasyRecovery,
    };
  }

  const seconds = parsePaceSeconds(target.pace);
  if (seconds == null) {
    return null;
  }

  return {
    kind: 'single',
    seconds,
    plannedLabel: secondsToPace(seconds),
    effortLedEasyRecovery,
  };
}

function getPlannedHeartRateLabel(session: PlannedSession): string {
  switch (session.type) {
    case 'EASY':
    case 'LONG':
      return 'Zone 2';
    case 'TEMPO':
      return 'Zone 4';
    case 'INTERVAL':
      return 'Zone 5';
    default:
      return '—';
  }
}

function buildDistanceVerdict(plannedDistance: number, actualDistance: number): PvaVerdict {
  const delta = Number((actualDistance - plannedDistance).toFixed(2));
  const shortfallPct = plannedDistance === 0
    ? 0
    : Number((((plannedDistance - actualDistance) / plannedDistance)).toFixed(4));
  const overagePct = plannedDistance === 0
    ? 0
    : Number((((actualDistance - plannedDistance) / plannedDistance)).toFixed(4));

  if (shortfallPct >= DISTANCE_SHORT_PCT) {
    return {
      kind: 'distance',
      status: 'warn',
      fact: `${formatDistance(Math.abs(delta))} km short of plan`,
    };
  }

  if (shortfallPct > DISTANCE_TOLERANCE_PCT) {
    return {
      kind: 'distance',
      status: 'warn',
      fact: `${formatDistance(Math.abs(delta))} km under plan`,
    };
  }

  if (overagePct > DISTANCE_TOLERANCE_PCT) {
    return {
      kind: 'distance',
      status: 'info',
      fact: `${formatDistance(delta)} km beyond plan`,
    };
  }

  return {
    kind: 'distance',
    status: 'ok',
    fact: 'On target distance',
  };
}

function slowerEffortLedVerdict(): PvaVerdict {
  return {
    kind: 'pace',
    status: 'ok',
    fact: 'Effort target led this session; slower pace is not auto-graded',
  };
}

function assessPace(session: PlannedSession, actualPaceSeconds: number): PaceAssessment {
  const target = resolvePaceTarget(session);
  if (!target) {
    return { target: null, relation: null, verdict: null };
  }

  if (target.kind === 'range') {
    if (actualPaceSeconds < target.fastestSeconds) {
      const delta = target.fastestSeconds - actualPaceSeconds;
      return {
        target,
        relation: 'fast',
        verdict: {
          kind: 'pace',
          status: 'warn',
          fact: `Pace ${formatSignedPaceDelta(delta)} faster than target range`,
        },
      };
    }

    if (actualPaceSeconds > target.slowestSeconds) {
      const delta = actualPaceSeconds - target.slowestSeconds;
      if (target.effortLedEasyRecovery) {
        return {
          target,
          relation: null,
          verdict: slowerEffortLedVerdict(),
        };
      }

      return {
        target,
        relation: 'slow',
        verdict: {
          kind: 'pace',
          status: 'info',
          fact: `Eased off ${formatSignedPaceDelta(delta)} slower than ${lowerSessionType(session)} range`,
        },
      };
    }

    return {
      target,
      relation: null,
      verdict: {
        kind: 'pace',
        status: 'ok',
        fact: 'Pace inside target range',
      },
    };
  }

  const delta = target.seconds - actualPaceSeconds;
  const direction = delta >= 0 ? 'faster' : 'slower';

  if (delta > PACE_FAST_SEC) {
    return {
      target,
      relation: 'fast',
      verdict: {
        kind: 'pace',
        status: 'warn',
        fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
      },
    };
  }

  if (delta < -PACE_SLOW_SEC) {
    if (target.effortLedEasyRecovery) {
      return {
        target,
        relation: null,
        verdict: slowerEffortLedVerdict(),
      };
    }

    return {
      target,
      relation: 'slow',
      verdict: {
        kind: 'pace',
        status: 'info',
        fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
      },
    };
  }

  return {
    target,
    relation: null,
    verdict: {
      kind: 'pace',
      status: 'ok',
      fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
    },
  };
}

function buildHeartRateVerdict(session: PlannedSession, avgHR: number | undefined): PvaVerdict | null {
  if (avgHR == null) return null;

  if (getPlannedHeartRateLabel(session) === 'Zone 2') {
    if (avgHR > HR_ZONE2_MAX_BPM) {
      return {
        kind: 'hr',
        status: 'warn',
        fact: `HR climbed above Zone 2 at ${avgHR} bpm`,
      };
    }

    return {
      kind: 'hr',
      status: 'ok',
      fact: 'HR sat in Zone 2 throughout',
    };
  }

  return {
    kind: 'hr',
    status: 'info',
    fact: `Avg HR ${avgHR} bpm`,
  };
}

function buildRows(session: PlannedSession, activity: Activity, plannedDistance: number, paceTarget: ResolvedPaceTarget | null): PvaRow[] {
  const rows: PvaRow[] = [
    {
      label: 'Distance',
      planned: `${formatDistance(plannedDistance)} km`,
      actual: `${formatDistance(activity.distance)} km`,
    },
  ];

  if (paceTarget) {
    rows.push({
      label: 'Pace',
      planned: paceTarget.plannedLabel,
      actual: secondsToPace(activity.avgPace),
    });
  }

  if (activity.avgHR != null) {
    rows.push({
      label: 'Heart rate',
      planned: getPlannedHeartRateLabel(session),
      actual: `${activity.avgHR} bpm`,
    });
  }

  return rows;
}

function pickHeadline(
  plannedDistance: number,
  actualDistance: number,
  paceRelation: PaceRelation,
  heartRateVerdict: PvaVerdict | null,
): PvaHeadline {
  const distanceDeltaPct = plannedDistance === 0
    ? 0
    : Number((((actualDistance - plannedDistance) / plannedDistance)).toFixed(4));
  const shortfallPct = -distanceDeltaPct;
  const isFast = paceRelation === 'fast';
  const isSlow = paceRelation === 'slow';
  const isHrHigh = heartRateVerdict?.kind === 'hr' && heartRateVerdict.status === 'warn';

  if (shortfallPct >= DISTANCE_SHORT_PCT) return 'cut-short';
  if (shortfallPct > DISTANCE_TOLERANCE_PCT) return 'under-distance';
  if (isHrHigh) return 'hr-high';
  if (isFast && distanceDeltaPct > DISTANCE_TOLERANCE_PCT) return 'crushed-it';
  if (distanceDeltaPct > DISTANCE_TOLERANCE_PCT) return 'bonus-effort';
  if (isFast) return 'over-pace';
  if (isSlow) return 'eased-in';
  return 'on-target';
}

export function summariseVsPlan(session: PlannedSession, activity: Activity): PvaResult {
  const plannedDistance = sessionKm(session);
  const paceAssessment = assessPace(session, activity.avgPace);

  const verdicts: PvaVerdict[] = [
    buildDistanceVerdict(plannedDistance, activity.distance),
  ];

  if (paceAssessment.verdict) verdicts.push(paceAssessment.verdict);

  const heartRateVerdict = buildHeartRateVerdict(session, activity.avgHR);
  if (heartRateVerdict) verdicts.push(heartRateVerdict);

  return {
    headline: pickHeadline(
      plannedDistance,
      activity.distance,
      paceAssessment.relation,
      heartRateVerdict,
    ),
    verdicts,
    rows: buildRows(session, activity, plannedDistance, paceAssessment.target),
  };
}
