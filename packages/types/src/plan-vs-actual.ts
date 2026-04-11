import type { Activity } from './activity';
import type { PlannedSession } from './session';
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

function paceToSeconds(pace: string): number {
  const [minutes, seconds] = pace.split(':').map(Number);
  return minutes * 60 + seconds;
}

function secondsToPace(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
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

function buildPaceVerdict(plannedPaceSeconds: number | null, actualPaceSeconds: number): PvaVerdict | null {
  if (plannedPaceSeconds == null) return null;

  const delta = plannedPaceSeconds - actualPaceSeconds;
  const direction = delta >= 0 ? 'faster' : 'slower';

  if (delta > PACE_FAST_SEC) {
    return {
      kind: 'pace',
      status: 'warn',
      fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
    };
  }

  if (delta < -PACE_SLOW_SEC) {
    return {
      kind: 'pace',
      status: 'info',
      fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
    };
  }

  return {
    kind: 'pace',
    status: 'ok',
    fact: `Pace ${formatSignedPaceDelta(delta)} ${direction} than planned`,
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

function buildRows(session: PlannedSession, activity: Activity, plannedDistance: number, plannedPaceSeconds: number | null): PvaRow[] {
  const rows: PvaRow[] = [
    {
      label: 'Distance',
      planned: `${formatDistance(plannedDistance)} km`,
      actual: `${formatDistance(activity.distance)} km`,
    },
  ];

  if (plannedPaceSeconds != null) {
    rows.push({
      label: 'Pace',
      planned: secondsToPace(plannedPaceSeconds),
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
  plannedPaceSeconds: number | null,
  actualPaceSeconds: number,
  avgHR: number | undefined,
): PvaHeadline {
  const distanceDeltaPct = plannedDistance === 0
    ? 0
    : Number((((actualDistance - plannedDistance) / plannedDistance)).toFixed(4));
  const shortfallPct = -distanceDeltaPct;
  const paceDelta = plannedPaceSeconds == null ? 0 : plannedPaceSeconds - actualPaceSeconds;
  const isFast = plannedPaceSeconds != null && paceDelta > PACE_FAST_SEC;
  const isSlow = plannedPaceSeconds != null && paceDelta < -PACE_SLOW_SEC;
  const isHrHigh = avgHR != null && avgHR > HR_ZONE2_MAX_BPM;

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
  const plannedPaceSeconds = session.pace ? paceToSeconds(session.pace) : null;

  const verdicts: PvaVerdict[] = [
    buildDistanceVerdict(plannedDistance, activity.distance),
  ];

  const paceVerdict = buildPaceVerdict(plannedPaceSeconds, activity.avgPace);
  if (paceVerdict) verdicts.push(paceVerdict);

  const heartRateVerdict = buildHeartRateVerdict(session, activity.avgHR);
  if (heartRateVerdict) verdicts.push(heartRateVerdict);

  return {
    headline: pickHeadline(plannedDistance, activity.distance, plannedPaceSeconds, activity.avgPace, activity.avgHR),
    verdicts,
    rows: buildRows(session, activity, plannedDistance, plannedPaceSeconds),
  };
}
