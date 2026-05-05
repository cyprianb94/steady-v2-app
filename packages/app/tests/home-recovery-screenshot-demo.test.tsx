import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterPush,
  mockActivityList,
  mockCrossTrainingGetForWeek,
  mockGetScreenshotDemoPlan,
  mockGetScreenshotDemoActivities,
  mockGetScreenshotDemoCrossTrainingEntries,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockActivityList: vi.fn(),
  mockCrossTrainingGetForWeek: vi.fn(),
  mockGetScreenshotDemoPlan: vi.fn(),
  mockGetScreenshotDemoActivities: vi.fn(),
  mockGetScreenshotDemoCrossTrainingEntries: vi.fn(),
}));

const mockAuth = {
  session: { user: { id: 'user-1' } },
  isLoading: false,
};

const mockPlan = {
  plan: null as any,
  loading: false,
  currentWeek: null as any,
  currentWeekIndex: 0,
  refresh: vi.fn(),
};

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('../demo/screenshot-demo', () => ({
  isScreenshotDemoMode: () => true,
  getScreenshotDemoPlan: mockGetScreenshotDemoPlan,
  getScreenshotDemoActivities: mockGetScreenshotDemoActivities,
  getScreenshotDemoCrossTrainingEntries: mockGetScreenshotDemoCrossTrainingEntries,
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => ({
    forceSync: async () => null,
    refreshStatus: async () => null,
    status: { connected: true },
    syncRevision: 0,
    syncing: false,
  }),
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-05-06',
}));

vi.mock('../lib/resume-week', () => ({
  clearResumeWeekOverride: vi.fn(),
  setResumeWeekOverride: vi.fn(),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: mockActivityList,
      },
      matchSession: {
        mutate: vi.fn(),
      },
    },
    crossTraining: {
      getForWeek: {
        query: mockCrossTrainingGetForWeek,
      },
      log: {
        mutate: vi.fn(),
      },
      delete: {
        mutate: vi.fn(),
      },
    },
    plan: {
      markInjury: {
        mutate: vi.fn(),
      },
      updateInjury: {
        mutate: vi.fn(),
      },
      clearInjury: {
        mutate: vi.fn(),
      },
    },
  },
}));

vi.mock('../components/home/PhaseThemeProvider', () => ({
  PhaseThemeProvider: ({ children }: any) => <>{children}</>,
}));

vi.mock('../components/home/TodayHeroCard', () => ({
  TodayHeroCard: () => <div>Today hero</div>,
}));

vi.mock('../components/home/RemainingDaysList', () => ({
  RemainingDaysList: () => <div>Remaining days</div>,
}));

vi.mock('../components/home/WeeklyLoadCard', () => ({
  WeeklyVolumeCard: () => <div>WEEKLY VOLUME</div>,
}));

vi.mock('../components/recovery/InjuryBanner', () => ({
  InjuryBanner: ({ injury }: any) => <div>{injury.name}</div>,
}));

vi.mock('../components/recovery/CrossTrainingLog', () => ({
  CrossTrainingLog: () => <div>Cross-Training This Week</div>,
}));

vi.mock('../components/recovery/ReturnToRunning', () => ({
  ReturnToRunning: () => <div>Return To Running</div>,
}));

vi.mock('../components/recovery/RecoveryFlowModal', () => ({
  RecoveryFlowModal: ({ visible }: any) => (visible ? <div>Recovery modal</div> : null),
}));

import HomeScreen from '../app/(tabs)/home';

describe('HomeScreen screenshot demo recovery behavior', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockActivityList.mockReset();
    mockActivityList.mockResolvedValue([]);
    mockCrossTrainingGetForWeek.mockReset();
    mockCrossTrainingGetForWeek.mockResolvedValue([]);
    mockGetScreenshotDemoPlan.mockReset();
    mockGetScreenshotDemoActivities.mockReset();
    mockGetScreenshotDemoActivities.mockReturnValue([]);
    mockGetScreenshotDemoCrossTrainingEntries.mockReset();
    mockGetScreenshotDemoCrossTrainingEntries.mockReturnValue([
      {
        id: 'cross-1',
        userId: 'user-1',
        planId: 'plan-1',
        date: '2026-05-06',
        type: 'Cycling',
        durationMinutes: 45,
        createdAt: '2026-05-06T08:00:00.000Z',
      },
    ]);
    mockPlan.refresh.mockReset();
    mockPlan.refresh.mockResolvedValue(undefined);
    mockPlan.currentWeekIndex = 0;
  });

  it('keeps parked recovery UI available in explicit screenshot demo mode', async () => {
    const week = {
      weekNumber: 4,
      phase: 'BUILD' as const,
      sessions: [
        { id: 'mon', type: 'EASY', date: '2026-05-04', distance: 8, pace: '5:20' },
        {
          id: 'tue',
          type: 'INTERVAL',
          date: '2026-05-05',
          reps: 6,
          repDist: 800,
          pace: '3:50',
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        },
        { id: 'wed', type: 'EASY', date: '2026-05-06', distance: 8, pace: '5:30' },
        { id: 'thu', type: 'TEMPO', date: '2026-05-07', distance: 10, pace: '4:20' },
        null,
        { id: 'sat', type: 'EASY', date: '2026-05-09', distance: 12, pace: '5:15' },
        { id: 'sun', type: 'LONG', date: '2026-05-10', distance: 20, pace: '5:05' },
      ],
      plannedKm: 58,
    };

    mockPlan.plan = {
      id: 'plan-1',
      weeks: [week],
      phases: {},
      raceDate: '2026-08-02',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      coachAnnotation: 'Screenshot-only fixture data should not become a normal Home nudge.',
      activeInjury: {
        name: 'Calf strain',
        markedDate: '2026-04-15',
        rtrStep: 1,
        rtrStepCompletedDates: ['2026-04-15'],
        status: 'returning',
      },
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('Recovery Mode')).toBeTruthy();
    expect(screen.getByText('Calf strain')).toBeTruthy();
    expect(screen.getByText('Cross-Training This Week')).toBeTruthy();
    expect(screen.getByText('Return To Running')).toBeTruthy();
    expect(screen.getByText('End recovery')).toBeTruthy();
    expect(screen.queryByText('WEEKLY VOLUME')).toBeNull();
    expect(screen.queryByText(/Screenshot-only fixture data/i)).toBeNull();

    await waitFor(() => {
      expect(mockGetScreenshotDemoCrossTrainingEntries).toHaveBeenCalled();
    });
    expect(mockCrossTrainingGetForWeek).not.toHaveBeenCalled();
  });
});
