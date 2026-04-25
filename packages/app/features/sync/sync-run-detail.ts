import {
  normalizeNiggleWhen,
  shoeLifetimeKm,
  type Activity,
  type Niggle,
  type PlannedSession,
  type Shoe,
} from '@steady/types';
import { activityLocalDate } from '../../lib/plan-helpers';

export type EditableNiggle = Pick<Niggle, 'bodyPart' | 'bodyPartOtherText' | 'severity' | 'when' | 'side'>;
export type ShoeWearState = 'ok' | 'warn' | 'critical';

export function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
  return session != null && session.type !== 'REST';
}

export function listRunnableSessions(sessions: readonly (PlannedSession | null)[]): PlannedSession[] {
  return sessions.filter(isRunnableSession);
}

export function listMatchableSessions(
  sessions: readonly (PlannedSession | null)[],
  today: string,
): PlannedSession[] {
  return listRunnableSessions(sessions).filter((session) => session.date <= today);
}

export function isSessionSelectable(session: PlannedSession, activityId: string): boolean {
  return !session.actualActivityId || session.actualActivityId === activityId;
}

export function isActivityDateCompatibleWithSession(activity: Activity, session: PlannedSession): boolean {
  return activityLocalDate(activity.startTime) === session.date;
}

export function resolveDefaultMatchSessionId({
  activity,
  preferredSession,
  today,
  todaySession,
  sessionOptions,
}: {
  activity: Activity | null;
  preferredSession?: PlannedSession | null;
  today: string;
  todaySession: PlannedSession | null;
  sessionOptions: readonly PlannedSession[];
}): string | null {
  if (!activity) {
    return null;
  }

  if (activity.matchedSessionId) {
    const matchedSession = sessionOptions.find((session) => session.id === activity.matchedSessionId);
    if (
      matchedSession
      && isSessionSelectable(matchedSession, activity.id)
      && isActivityDateCompatibleWithSession(activity, matchedSession)
    ) {
      return activity.matchedSessionId;
    }
  }

  if (
    preferredSession
    && sessionOptions.some((session) => session.id === preferredSession.id)
    && isSessionSelectable(preferredSession, activity.id)
    && isActivityDateCompatibleWithSession(activity, preferredSession)
  ) {
    return preferredSession.id;
  }

  if (
    todaySession
    && activityLocalDate(activity.startTime) === today
    && isSessionSelectable(todaySession, activity.id)
  ) {
    return todaySession.id;
  }

  return null;
}

export function toEditableNiggles(niggles: readonly Niggle[] | undefined): EditableNiggle[] {
  return (niggles ?? []).map((niggle) => ({
    bodyPart: niggle.bodyPart,
    bodyPartOtherText: niggle.bodyPartOtherText,
    severity: niggle.severity,
    when: normalizeNiggleWhen(niggle.when),
    side: niggle.side,
  }));
}

export function shoeWearState(shoe: Shoe): ShoeWearState {
  if (!shoe.retireAtKm || shoe.retireAtKm <= 0) {
    return 'ok';
  }

  const wearRatio = shoeLifetimeKm(shoe) / shoe.retireAtKm;
  if (wearRatio >= 0.85) {
    return 'critical';
  }
  if (wearRatio >= 0.6) {
    return 'warn';
  }

  return 'ok';
}
