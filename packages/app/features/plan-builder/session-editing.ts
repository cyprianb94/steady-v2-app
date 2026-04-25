import type { PlannedSession } from '@steady/types';
import { DAYS, sessionLabel } from '../../lib/plan-helpers';
import type { DistanceUnits } from '../../lib/units';

export type SessionEditorResult = Partial<PlannedSession> | null;

interface EditedSessionFallback {
  id: string;
  date: string;
  type: PlannedSession['type'];
}

export function normalizeSessionEditorResult(
  updated: SessionEditorResult,
): Partial<PlannedSession> | null {
  if (!updated || updated.type === 'REST') {
    return null;
  }

  return updated;
}

export function buildSessionEditDescription(
  dayIndex: number,
  updated: SessionEditorResult,
  units: DistanceUnits,
): string {
  const normalized = normalizeSessionEditorResult(updated);
  return normalized
    ? `${DAYS[dayIndex]} → ${sessionLabel(normalized, units)}`
    : `${DAYS[dayIndex]} → Rest`;
}

export function materializeEditedSession(
  existing: PlannedSession | null,
  updated: SessionEditorResult,
  fallback: EditedSessionFallback,
): PlannedSession | null {
  const normalized = normalizeSessionEditorResult(updated);
  if (!normalized) {
    return null;
  }

  return {
    ...(existing ?? {}),
    ...normalized,
    id: existing?.id ?? fallback.id,
    date: existing?.date ?? fallback.date,
    type: normalized.type ?? existing?.type ?? fallback.type,
  } as PlannedSession;
}
