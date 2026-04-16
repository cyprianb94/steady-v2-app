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
  session: null as any,
  isLoading: false,
};

const mockPlan = {
  plan: null as any,
  loading: false,
  currentWeekIndex: 0,
  refresh: vi.fn(),
};

const mockStrava = {
  requestAutoSync: vi.fn(),
  forceSync: vi.fn(),
  syncRevision: 0,
  syncing: false,
};

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => mockStrava,
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-04-15',
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
      log: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    plan: {
      updateInjury: { mutate: vi.fn() },
      clearInjury: { mutate: vi.fn() },
    },
  },
}));

vi.mock('../components/week/WeekHeader', () => ({
  WeekHeader: ({ weekNumber, totalWeeks }: any) => <div>{`Week ${weekNumber} of ${totalWeeks}`}</div>,
}));

vi.mock('../components/week/LoadBar', () => ({
  LoadBar: () => <div>Load bar</div>,
}));

vi.mock('../components/week/DayCard', () => ({
  DayCard: ({ dayName }: any) => <div>{dayName}</div>,
}));

vi.mock('../components/recovery/InjuryBanner', () => ({
  InjuryBanner: () => <div>Injury banner</div>,
}));

vi.mock('../components/recovery/CrossTrainingLog', () => ({
  CrossTrainingLog: () => <div>Cross training</div>,
}));

vi.mock('../components/recovery/ReturnToRunning', () => ({
  ReturnToRunning: () => <div>RTR</div>,
}));

vi.mock('../components/recovery/RecoveryFlowModal', () => ({
  RecoveryFlowModal: () => null,
}));

vi.mock('../components/home/SessionDetailSheet', () => ({
  SessionDetailSheet: () => null,
}));

import WeekTab from '../app/(tabs)/week';

describe('WeekTab', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockActivityList.mockReset();
    mockActivityList.mockResolvedValue([]);
    mockCrossTrainingGetForWeek.mockReset();
    mockCrossTrainingGetForWeek.mockResolvedValue([]);
    mockPlan.plan = null;
    mockPlan.loading = false;
    mockPlan.currentWeekIndex = 0;
    mockPlan.refresh = vi.fn().mockResolvedValue(undefined);
    mockAuth.session = null;
    mockAuth.isLoading = false;
    mockStrava.requestAutoSync.mockReset();
    mockStrava.requestAutoSync.mockResolvedValue(null);
    mockStrava.forceSync.mockReset();
    mockStrava.forceSync.mockResolvedValue(null);
    mockStrava.syncRevision = 0;
    mockStrava.syncing = false;
  });

  it('shows the shared sign-in prompt when the runner is signed out', () => {
    render(<WeekTab />);

    expect(screen.getByText('Sign in to see your plan')).toBeTruthy();
    expect(screen.getByText('Use the Settings tab to continue with Google, then come back here.')).toBeTruthy();
  });

  it('clamps an out-of-range current week index instead of rendering a blank screen', async () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockPlan.plan = {
      id: 'plan-1',
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE' as const,
          plannedKm: 42,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
      activeInjury: null,
    };
    mockPlan.currentWeekIndex = 4;

    render(<WeekTab />);

    expect(screen.getByText('Week 1 of 1')).toBeTruthy();
    expect(screen.getByText('Load bar')).toBeTruthy();
    await waitFor(() => {
      expect(mockActivityList).toHaveBeenCalledTimes(1);
    });
  });
});
