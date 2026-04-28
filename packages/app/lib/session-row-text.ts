import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../constants/session-types';
import {
  formatDistance,
  formatIntensityTargetParts,
  formatIntervalRepLength,
  formatStoredPace,
  type DistanceUnits,
} from './units';

export interface SessionRowText {
  title: string;
  caption: string;
}

const REST_ROW_TEXT: SessionRowText = {
  title: 'Rest day',
  caption: 'Recovery slot locked in for this day',
};

function targetPaceLabel(session: Partial<PlannedSession>, units: DistanceUnits): string | null {
  return formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
    includeEffort: false,
  }).pace;
}

function effortLabel(session: Partial<PlannedSession>, units: DistanceUnits): string | null {
  const effort = formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
  }).effort;

  return effort === 'conversational' ? 'conversational pace' : effort;
}

function legacyPaceLabel(session: Partial<PlannedSession>, units: DistanceUnits): string | null {
  return session.pace ? formatStoredPace(session.pace, units) : null;
}

function formatRunTitle(session: Partial<PlannedSession>, units: DistanceUnits): string {
  if (session.type === 'INTERVAL') {
    const base = `${session.reps ?? 6}×${formatIntervalRepLength(session)}`;
    const pace = targetPaceLabel(session, units) ?? legacyPaceLabel(session, units);
    return pace ? `${base} · ${pace}` : base;
  }

  const distanceLabel = session.distance != null ? formatDistance(session.distance, units) : '?';
  const pace = targetPaceLabel(session, units) ?? legacyPaceLabel(session, units);
  return pace ? `${distanceLabel} · ${pace}` : distanceLabel;
}

export function formatSessionRowText(
  session: Partial<PlannedSession> | null,
  units: DistanceUnits,
): SessionRowText {
  if (!session || session.type === 'REST') {
    return REST_ROW_TEXT;
  }

  const typeLabel = SESSION_TYPE[session.type ?? 'EASY'].label;
  const effort = effortLabel(session, units);

  return {
    title: formatRunTitle(session, units),
    caption: effort ? `${typeLabel} · ${effort}` : typeLabel,
  };
}
