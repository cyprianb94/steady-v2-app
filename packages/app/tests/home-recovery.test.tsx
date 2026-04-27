import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterPush,
  mockActivityList,
  mockCrossTrainingGetForWeek,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockActivityList: vi.fn(),
  mockCrossTrainingGetForWeek: vi.fn(),
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

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => ({
    forceSync: async () => null,
    syncRevision: 0,
    syncing: false,
  }),
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-04-15',
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

vi.mock('../components/home/CoachAnnotationCard', () => ({
  CoachAnnotationCard: () => <div>Coach note</div>,
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

describe('HomeScreen recovery behavior', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockActivityList.mockReset();
    mockActivityList.mockResolvedValue([]);
    mockCrossTrainingGetForWeek.mockReset();
    mockCrossTrainingGetForWeek.mockResolvedValue([]);
    mockPlan.refresh.mockReset();
    mockPlan.refresh.mockResolvedValue(undefined);
    mockPlan.currentWeekIndex = 0;
  });

  it('shows the displayed plan week range instead of the device calendar week', async () => {
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
      coachAnnotation: 'Keep the first week controlled.',
      activeInjury: null,
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('MAY 4 – 10 · 2026')).toBeTruthy();
    expect(screen.queryByText('APR 13 – 19 · 2026')).toBeNull();
    expect(screen.getByText('Week 4 · Build Phase')).toBeTruthy();

    await waitFor(() => {
      expect(mockActivityList).toHaveBeenCalled();
    });
  });

  it('keeps the normal MVP home UI when persisted injury data exists', async () => {
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
      coachAnnotation: 'Ease back in steadily.',
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

    expect(screen.getByText('Week 4 · Build Phase')).toBeTruthy();
    expect(screen.getByText('WEEKLY VOLUME')).toBeTruthy();
    expect(screen.queryByText('Recovery Mode')).toBeNull();
    expect(screen.queryByText('Calf strain')).toBeNull();
    expect(screen.queryByText('Cross-Training This Week')).toBeNull();
    expect(screen.queryByText('Return To Running')).toBeNull();
    expect(screen.queryByText('Mark injury')).toBeNull();

    await waitFor(() => {
      expect(mockActivityList).toHaveBeenCalled();
    });
    expect(mockCrossTrainingGetForWeek).not.toHaveBeenCalled();
  });
});
