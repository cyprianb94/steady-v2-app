import type { PlannedSession } from '@steady/types';
import { SESSION_TYPE } from '../../constants/session-types';
import {
  formatDistance,
  formatIntensityTargetParts,
  formatIntervalRepLength,
  formatStoredPace,
  type DistanceUnits,
} from '../../lib/units';

export interface BlockSessionRowText {
  title: string;
  caption: string;
}

const REST_ROW_TEXT: BlockSessionRowText = {
  title: 'Rest day',
  caption: 'Recovery slot locked in for this day',
};

function lowercaseSessionType(type: PlannedSession['type'] | undefined): string {
  switch (type) {
    case 'TEMPO':
      return 'tempo';
    case 'LONG':
      return 'long';
    case 'INTERVAL':
      return 'interval';
    case 'EASY':
    default:
      return 'easy';
  }
}

function targetPaceLabel(session: Partial<PlannedSession>, units: DistanceUnits): string | null {
  return formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
    includeEffort: false,
  }).pace;
}

function effortLabel(session: Partial<PlannedSession>, units: DistanceUnits): string | null {
  return formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
  }).effort;
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
  const pace = targetPaceLabel(session, units);
  if (pace) {
    return `${distanceLabel} ${lowercaseSessionType(session.type)} · ${pace}`;
  }

  const fallbackPace = legacyPaceLabel(session, units);
  if (fallbackPace) {
    return `${distanceLabel} ${lowercaseSessionType(session.type)} · ${fallbackPace}`;
  }

  return `${distanceLabel} ${lowercaseSessionType(session.type)}`;
}

export function formatBlockSessionRowText(
  session: Partial<PlannedSession> | null,
  units: DistanceUnits,
): BlockSessionRowText {
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
