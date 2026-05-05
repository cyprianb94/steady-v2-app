import {
  defaultIntensityTargetForSessionType,
  deriveSessionFocus,
  summariseRunStructure,
  type PlannedSession,
} from '@steady/types';
import { SESSION_TYPE } from '../constants/session-types';
import {
  formatDistance,
  formatIntensityTargetParts,
  formatIntervalRepLength,
  formatStoredPace,
  type DistanceUnits,
} from './units';
import { structuredRunSummaryTitle } from './structured-run-display';

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
  const explicitEffort = formatIntensityTargetParts(session, units, {
    hideCompatibilityPace: true,
  }).effort;
  const effort = explicitEffort ?? (
    session.type === 'INTERVAL'
      ? formatIntensityTargetParts(defaultIntensityTargetForSessionType('INTERVAL'), units, {
          hideCompatibilityPace: true,
        }).effort
      : null
  );

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

  const distanceLabel = session.plannedVolume?.unit === 'min'
    ? `${session.plannedVolume.value}min`
    : session.plannedVolume?.unit === 'km'
      ? formatDistance(session.plannedVolume.value, units)
      : session.distance != null ? formatDistance(session.distance, units) : '?';
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
  const structureSummary = summariseRunStructure(session as PlannedSession);
  const focus = deriveSessionFocus(session as PlannedSession);
  const indicators = [
    session.planNote ? 'Note' : null,
  ].filter((part): part is string => Boolean(part));

  if (structureSummary) {
    return {
      title: structuredRunSummaryTitle(session as PlannedSession, units) ?? structureSummary,
      caption: [focus, ...indicators].join(' · '),
    };
  }

  return {
    title: formatRunTitle(session, units),
    caption: [effort ? `${typeLabel} · ${effort}` : typeLabel, ...indicators].join(' · '),
  };
}
