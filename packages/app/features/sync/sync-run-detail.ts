import type { Activity, Niggle, PlannedSession, Shoe } from '@steady/types';

export type EditableNiggle = Pick<Niggle, 'bodyPart' | 'severity' | 'when' | 'side'>;
export type ShoeWearState = 'ok' | 'warn' | 'critical';

export function isRunnableSession(session: PlannedSession | null): session is PlannedSession {
  return session != null && session.type !== 'REST';
}

export function listRunnableSessions(sessions: readonly (PlannedSession | null)[]): PlannedSession[] {
  return sessions.filter(isRunnableSession);
}

export function resolveDefaultMatchSessionId({
  activity,
  today,
  todaySession,
  sessionOptions,
}: {
  activity: Activity | null;
  today: string;
  todaySession: PlannedSession | null;
  sessionOptions: readonly PlannedSession[];
}): string | null {
  if (!activity) {
    return null;
  }

  if (todaySession && activity.startTime.slice(0, 10) === today) {
    return todaySession.id;
  }

  if (activity.matchedSessionId && sessionOptions.some((session) => session.id === activity.matchedSessionId)) {
    return activity.matchedSessionId;
  }

  return null;
}

export function toEditableNiggles(niggles: readonly Niggle[] | undefined): EditableNiggle[] {
  return (niggles ?? []).map((niggle) => ({
    bodyPart: niggle.bodyPart,
    severity: niggle.severity,
    when: niggle.when,
    side: niggle.side,
  }));
}

export function shoeWearState(shoe: Shoe): ShoeWearState {
  if (!shoe.retireAtKm || shoe.retireAtKm <= 0) {
    return 'ok';
  }

  const wearRatio = shoe.totalKm / shoe.retireAtKm;
  if (wearRatio >= 0.85) {
    return 'critical';
  }
  if (wearRatio >= 0.6) {
    return 'warn';
  }

  return 'ok';
}
