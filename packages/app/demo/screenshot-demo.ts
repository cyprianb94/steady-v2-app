import type { Session } from '@supabase/supabase-js';
import {
  addDaysIso,
  weekKm,
  type Activity,
  type CrossTrainingEntry,
  type PlanWeek,
  type PlannedSession,
  type Shoe,
  type TrainingPlan,
  type TrainingPlanWithAnnotation,
} from '@steady/types';

export type ScreenshotDemoState = 'normal' | 'recovery';

export const SCREENSHOT_DEMO_TODAY = '2026-04-23';

const DEMO_USER_ID = 'screenshot-demo-user';
const DEMO_PLAN_ID = 'screenshot-demo-plan';
const BLOCK_START_DATE = '2026-03-23';

function readQueryParam(name: string): string | null {
  const location = (globalThis as { location?: { search?: string } }).location;
  const search = location?.search?.replace(/^\?/, '');
  if (!search) return null;

  for (const part of search.split('&')) {
    const [rawKey, rawValue = ''] = part.split('=');
    if (decodeURIComponent(rawKey) === name) {
      return decodeURIComponent(rawValue);
    }
  }

  return null;
}

export function isScreenshotDemoMode(): boolean {
  return (
    process.env.EXPO_PUBLIC_STEADY_SCREENSHOT_DEMO === '1'
    || readQueryParam('steadyDemo') === '1'
  );
}

export function getScreenshotDemoState(): ScreenshotDemoState {
  const value = readQueryParam('steadyState')
    ?? process.env.EXPO_PUBLIC_STEADY_SCREENSHOT_STATE
    ?? 'normal';

  return value === 'recovery' ? 'recovery' : 'normal';
}

function session(
  weekNumber: number,
  dayIndex: number,
  date: string,
  base: Omit<PlannedSession, 'id' | 'date'>,
): PlannedSession {
  return {
    ...base,
    id: `w${weekNumber}-d${dayIndex}-${base.type.toLowerCase()}`,
    date,
  };
}

function weekPhase(weekNumber: number): PlanWeek['phase'] {
  if (weekNumber <= 3) return 'BASE';
  if (weekNumber <= 10) return 'BUILD';
  if (weekNumber <= 12) return 'RECOVERY';
  if (weekNumber <= 14) return 'PEAK';
  return 'TAPER';
}

function buildWeek(weekNumber: number): PlanWeek {
  const startDate = addDaysIso(BLOCK_START_DATE, (weekNumber - 1) * 7);
  const volumeBump = Math.min(weekNumber - 1, 8);
  const easyKm = 7 + Math.floor(volumeBump / 2);
  const longKm = 18 + volumeBump * 2;
  const tempoKm = weekNumber >= 4 ? 7 + Math.floor(volumeBump / 2) : 6;
  const isCurrentWeek = weekNumber === 5;
  const isPastWeek = weekNumber < 5;

  const sessions: (PlannedSession | null)[] = [
    session(weekNumber, 0, startDate, {
      type: 'EASY',
      distance: easyKm,
      pace: '5:20',
      actualActivityId: isCurrentWeek ? 'act-easy-monday' : isPastWeek ? `act-w${weekNumber}-easy` : undefined,
    }),
    session(weekNumber, 1, addDaysIso(startDate, 1), {
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      pace: weekNumber >= 5 ? '3:55' : '4:00',
      recovery: '90s',
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
      actualActivityId: isCurrentWeek ? 'act-interval-tuesday' : isPastWeek ? `act-w${weekNumber}-interval` : undefined,
    }),
    session(weekNumber, 2, addDaysIso(startDate, 2), {
      type: 'REST',
    }),
    session(weekNumber, 3, addDaysIso(startDate, 3), {
      type: 'TEMPO',
      distance: tempoKm,
      pace: '4:18',
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    }),
    session(weekNumber, 4, addDaysIso(startDate, 4), {
      type: 'EASY',
      distance: Math.max(6, easyKm - 2),
      pace: '5:25',
    }),
    session(weekNumber, 5, addDaysIso(startDate, 5), {
      type: 'LONG',
      distance: longKm,
      pace: '5:08',
    }),
    session(weekNumber, 6, addDaysIso(startDate, 6), {
      type: 'REST',
    }),
  ];

  return {
    weekNumber,
    phase: weekPhase(weekNumber),
    sessions,
    plannedKm: weekKm(sessions),
  };
}

const DEMO_WEEKS = Array.from({ length: 16 }, (_, index) => buildWeek(index + 1));

function basePlan(): TrainingPlan {
  return {
    id: DEMO_PLAN_ID,
    userId: DEMO_USER_ID,
    createdAt: '2026-03-01T09:00:00.000Z',
    raceName: 'Manchester Marathon',
    raceDate: '2026-07-12',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:30',
    phases: {
      BASE: 3,
      BUILD: 7,
      RECOVERY: 2,
      PEAK: 2,
      TAPER: 2,
    },
    progressionPct: 7,
    templateWeek: DEMO_WEEKS[4]!.sessions,
    weeks: DEMO_WEEKS,
    activeInjury: null,
  };
}

export function getScreenshotDemoPlan(): TrainingPlanWithAnnotation {
  const plan = basePlan();

  if (getScreenshotDemoState() === 'recovery') {
    plan.activeInjury = {
      name: 'Calf strain',
      markedDate: '2026-04-22',
      reassessedTarget: 'sub-3:45',
      rtrStep: 0,
      rtrStepCompletedDates: [],
      status: 'recovering',
    };
  }

  return {
    ...plan,
    todayAnnotation:
      'Tempo today. Your last tempo faded late. Start at 4:18/km and hold it.',
    coachAnnotation:
      'This is a heavy build week. Keep Friday genuinely easy before the long run.',
  };
}

function split(km: number, pace: number, hr: number): Activity['splits'][number] {
  return {
    km,
    pace,
    hr,
    elevation: km % 3 === 0 ? 4 : 1,
  };
}

export const SCREENSHOT_DEMO_ACTIVITIES: Activity[] = [
  {
    id: 'act-easy-monday',
    userId: DEMO_USER_ID,
    source: 'strava',
    externalId: 'strava-easy-monday',
    name: 'Morning Easy Run',
    startTime: '2026-04-20T07:16:00.000Z',
    distance: 8.1,
    duration: 2630,
    elevationGain: 34,
    avgPace: 325,
    avgHR: 139,
    maxHR: 154,
    splits: [split(1, 333, 128), split(2, 327, 134), split(3, 322, 138), split(4, 320, 142), split(5, 326, 140), split(6, 324, 143), split(7, 321, 145), split(8, 318, 147)],
    matchedSessionId: 'w5-d0-easy',
    shoeId: 'shoe-pegasus',
  },
  {
    id: 'act-interval-tuesday',
    userId: DEMO_USER_ID,
    source: 'strava',
    externalId: 'strava-interval-tuesday',
    name: 'Track reps',
    startTime: '2026-04-21T18:04:00.000Z',
    distance: 9.6,
    duration: 2500,
    elevationGain: 18,
    avgPace: 260,
    avgHR: 166,
    maxHR: 184,
    splits: [split(1, 316, 132), split(2, 238, 158), split(3, 236, 166), split(4, 241, 171), split(5, 243, 176), split(6, 248, 179), split(7, 254, 181), split(8, 319, 151), split(9, 324, 146)],
    matchedSessionId: 'w5-d1-interval',
    shoeId: 'shoe-streakfly',
    subjectiveInput: {
      legs: 'heavy',
      breathing: 'labored',
      overall: 'done',
    },
  },
  {
    id: 'act-tempo-today',
    userId: DEMO_USER_ID,
    source: 'strava',
    externalId: 'strava-tempo-today',
    name: 'Lunch tempo',
    startTime: '2026-04-23T12:32:00.000Z',
    distance: 10.2,
    duration: 2720,
    elevationGain: 42,
    avgPace: 267,
    avgHR: 164,
    maxHR: 178,
    splits: [split(1, 256, 143), split(2, 258, 152), split(3, 260, 158), split(4, 262, 162), split(5, 264, 165), split(6, 267, 168), split(7, 270, 170), split(8, 276, 173), split(9, 281, 175), split(10, 283, 176)],
    shoeId: 'shoe-streakfly',
    notes: 'Good rhythm until 7km, then had to work for it.',
    niggles: [
      {
        id: 'niggle-calf-1',
        userId: DEMO_USER_ID,
        activityId: 'act-tempo-today',
        bodyPart: 'calf',
        side: 'left',
        severity: 'mild',
        when: ['after'],
        createdAt: '2026-04-23T13:30:00.000Z',
      },
    ],
  },
];

export const SCREENSHOT_DEMO_SHOES: Shoe[] = [
  {
    id: 'shoe-pegasus',
    userId: DEMO_USER_ID,
    stravaGearId: 'g-pegasus',
    brand: 'Nike',
    model: 'Pegasus 41',
    nickname: 'daily pair',
    retired: false,
    retireAtKm: 650,
    totalKm: 318,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-04-20T00:00:00.000Z',
  },
  {
    id: 'shoe-streakfly',
    userId: DEMO_USER_ID,
    stravaGearId: 'g-streakfly',
    brand: 'Nike',
    model: 'Streakfly 2',
    nickname: 'fast pair',
    retired: false,
    retireAtKm: 420,
    totalKm: 176,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-04-23T00:00:00.000Z',
  },
];

export const SCREENSHOT_DEMO_CROSS_TRAINING: CrossTrainingEntry[] = [
  {
    id: 'cross-1',
    userId: DEMO_USER_ID,
    planId: DEMO_PLAN_ID,
    date: '2026-04-23',
    type: 'Cycling',
    durationMinutes: 45,
    createdAt: '2026-04-23T08:00:00.000Z',
  },
  {
    id: 'cross-2',
    userId: DEMO_USER_ID,
    planId: DEMO_PLAN_ID,
    date: '2026-04-24',
    type: 'Swimming',
    durationMinutes: 30,
    createdAt: '2026-04-24T08:00:00.000Z',
  },
];

export const SCREENSHOT_DEMO_SESSION = {
  access_token: 'screenshot-demo-token',
  refresh_token: 'screenshot-demo-refresh',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: DEMO_USER_ID,
    email: 'runner@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    app_metadata: {},
    user_metadata: {},
    created_at: '2026-03-01T09:00:00.000Z',
  },
} as Session;

export function getScreenshotDemoActivities(): Activity[] {
  return SCREENSHOT_DEMO_ACTIVITIES;
}

export function getScreenshotDemoActivity(activityId: string): Activity | null {
  return SCREENSHOT_DEMO_ACTIVITIES.find((activity) => activity.id === activityId) ?? null;
}

export function getScreenshotDemoCrossTrainingEntries(): CrossTrainingEntry[] {
  return SCREENSHOT_DEMO_CROSS_TRAINING;
}

export function getScreenshotDemoCoachMessages() {
  return [
    {
      id: 'demo-coach-1',
      role: 'assistant' as const,
      content: 'Tempo today. Your last tempo faded late. Start at 4:18/km and hold it.',
      createdAt: '2026-04-23T08:15:00.000Z',
    },
    {
      id: 'demo-coach-2',
      role: 'user' as const,
      content: 'Should I still do the long run if my calf is tight?',
      createdAt: '2026-04-23T08:17:00.000Z',
    },
    {
      id: 'demo-coach-3',
      role: 'assistant' as const,
      content: 'Not if it changes your stride. Swap Saturday for 45min cycling and keep Sunday off. If it settles, resume with 6km easy on Monday.',
      createdAt: '2026-04-23T08:18:00.000Z',
    },
  ];
}

export const screenshotDemoTrpc = {
  activity: {
    list: {
      query: async () => getScreenshotDemoActivities(),
    },
    get: {
      query: async ({ activityId }: { activityId: string }) => {
        const activity = getScreenshotDemoActivity(activityId);
        if (!activity) {
          throw new Error(`Demo activity not found: ${activityId}`);
        }
        return activity;
      },
    },
    matchSession: {
      mutate: async () => null,
    },
    saveRunDetail: {
      mutate: async ({ activityId }: { activityId: string }) => {
        const activity = getScreenshotDemoActivity(activityId);
        if (!activity) {
          throw new Error(`Demo activity not found: ${activityId}`);
        }
        return { activity, niggles: activity.niggles ?? [] };
      },
    },
  },
  coach: {
    send: {
      mutate: async () => ({
        conversationId: 'demo-conversation',
        reply: getScreenshotDemoCoachMessages()[2],
      }),
    },
  },
  crossTraining: {
    getForWeek: {
      query: async () => getScreenshotDemoCrossTrainingEntries(),
    },
    getForDateRange: {
      query: async () => getScreenshotDemoCrossTrainingEntries(),
    },
    log: {
      mutate: async () => getScreenshotDemoCrossTrainingEntries()[0],
    },
    delete: {
      mutate: async () => null,
    },
  },
  plan: {
    get: {
      query: async () => getScreenshotDemoPlan(),
    },
    save: {
      mutate: async () => getScreenshotDemoPlan(),
    },
    updateWeeks: {
      mutate: async () => getScreenshotDemoPlan(),
    },
    markInjury: {
      mutate: async () => getScreenshotDemoPlan(),
    },
    updateInjury: {
      mutate: async () => getScreenshotDemoPlan(),
    },
    clearInjury: {
      mutate: async () => getScreenshotDemoPlan(),
    },
  },
  profile: {
    me: {
      query: async () => ({ id: DEMO_USER_ID, email: 'runner@example.com', units: 'metric' }),
    },
    updatePreferences: {
      mutate: async ({ units }: { units: 'metric' | 'imperial' }) => ({
        id: DEMO_USER_ID,
        email: 'runner@example.com',
        units,
      }),
    },
  },
  shoe: {
    list: {
      query: async () => SCREENSHOT_DEMO_SHOES,
    },
  },
  strava: {
    config: {
      query: async () => ({ clientId: 'demo-strava-client-id' }),
    },
    status: {
      query: async () => ({
        connected: true,
        athleteId: '123456',
        lastSyncedAt: '2026-04-23T12:45:00.000Z',
      }),
    },
    sync: {
      mutate: async () => ({
        matched: 1,
        new: 1,
        matchedSessions: [
          {
            sessionDate: SCREENSHOT_DEMO_TODAY,
            sessionType: 'TEMPO',
          },
        ],
      }),
    },
    connect: {
      mutate: async () => null,
    },
    disconnect: {
      mutate: async () => null,
    },
  },
};
