import type { Session } from '@supabase/supabase-js';

let currentSession: Session | null = null;

export function getAccessToken(): string | null {
  return currentSession?.access_token ?? null;
}

export function setCurrentSession(session: Session | null) {
  currentSession = session;
}
