import type { PlannedSession } from '@steady/types';

export interface SessionEditReturnPayload {
  weekIndex: number;
  dayIndex: number;
  updated: Partial<PlannedSession> | null;
  nonce: string;
}

let pendingSessionEditReturn: SessionEditReturnPayload | null = null;
let sessionEditReturnCounter = 0;

export function stashSessionEditReturn(
  payload: Omit<SessionEditReturnPayload, 'nonce'>,
): SessionEditReturnPayload {
  sessionEditReturnCounter += 1;
  pendingSessionEditReturn = {
    ...payload,
    nonce: `${Date.now()}-${sessionEditReturnCounter}`,
  };

  return pendingSessionEditReturn;
}

export function consumeSessionEditReturn(): SessionEditReturnPayload | null {
  const payload = pendingSessionEditReturn;
  pendingSessionEditReturn = null;
  return payload;
}
