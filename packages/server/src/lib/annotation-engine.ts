import type { PlannedSession, PhaseName } from '@steady/types';

export interface AnnotationInput {
  todaySession: PlannedSession | null;
  tomorrowSession: PlannedSession | null;
  phase: PhaseName;
  weekNumber: number;
  totalWeeks: number;
  allSessions: (PlannedSession | null)[];
}

export interface HomeAnnotations {
  todayAnnotation: string;
  coachAnnotation: string | null;
}

const PHASE_FALLBACKS: Record<PhaseName, string> = {
  BASE: 'Building your aerobic foundation — consistency matters more than intensity right now.',
  BUILD: 'Volume is climbing — trust the process and recover well between sessions.',
  RECOVERY: 'Recovery week — volume is intentionally lower. Let your body absorb the work.',
  PEAK: "Peak phase — you're at your sharpest. Focus on execution and quality.",
  TAPER: 'Taper phase — less is more. Stay sharp but keep the legs fresh for race day.',
};

function generateTodayAnnotation(input: AnnotationInput): string {
  const { todaySession, phase, weekNumber, totalWeeks, allSessions } = input;

  // Rest day
  if (!todaySession || todaySession.type === 'REST') {
    return 'Rest day — your body builds fitness during recovery, not just during runs.';
  }

  // Recovery phase override
  if (phase === 'RECOVERY') {
    return PHASE_FALLBACKS.RECOVERY;
  }

  // Longest run of the week
  if (todaySession.type === 'LONG') {
    const maxDist = Math.max(
      0,
      ...allSessions.filter(Boolean).map((session) => session!.distance ?? 0),
    );
    if (todaySession.distance && todaySession.distance >= maxDist) {
      return 'Longest run of the week — fuel well, start slow, and let the pace come to you.';
    }
  }

  // Today is key session (intervals or tempo)
  if (todaySession.type === 'INTERVAL') {
    return 'Key session — this is where the adaptation happens. Warm up well and hit your paces.';
  }

  if (todaySession.type === 'TEMPO') {
    return 'Quality tempo today — find your rhythm and hold it steady. This builds race-day confidence.';
  }

  if (weekNumber === 1) {
    return 'First week — keep it controlled and let consistency set the tone.';
  }

  if (weekNumber === totalWeeks) {
    return 'Final week — protect freshness and arrive ready to race.';
  }

  // Phase-level fallback
  return PHASE_FALLBACKS[phase];
}

export function generateHomeAnnotations(input: AnnotationInput): HomeAnnotations {
  return {
    todayAnnotation: generateTodayAnnotation(input),
    // AI freeze: keep the legacy field null so deterministic "coach notes"
    // cannot reappear while Steady AI is paused.
    coachAnnotation: null,
  };
}
