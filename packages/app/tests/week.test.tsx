import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterPush,
  mockActivityList,
  mockActivityGet,
  mockCrossTrainingGetForWeek,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockActivityList: vi.fn(),
  mockActivityGet: vi.fn(),
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
      get: {
        query: mockActivityGet,
      },
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
  DayCard: ({ dayName, onPress }: any) => (
    <button onClick={onPress} type="button">
      {dayName}
    </button>
  ),
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

import WeekTab from '../app/(tabs)/week';

describe('WeekTab', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockActivityList.mockReset();
    mockActivityGet.mockReset();
    mockActivityList.mockResolvedValue([]);
    mockActivityGet.mockResolvedValue(null);
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

  it('keeps the standard week UI when persisted injury data exists', async () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockPlan.plan = {
      id: 'plan-1',
      weeks: [
        {
          weekNumber: 1,
          phase: 'BUILD' as const,
          plannedKm: 42,
          sessions: [null, null, null, null, null, null, null],
        },
      ],
      activeInjury: {
        name: 'Calf strain',
        markedDate: '2026-04-15',
        rtrStep: 1,
        rtrStepCompletedDates: ['2026-04-15'],
        status: 'returning' as const,
      },
    };

    render(<WeekTab />);

    expect(screen.getByText('Week 1 of 1')).toBeTruthy();
    expect(screen.getByText('Load bar')).toBeTruthy();
    expect(screen.queryByText('Injury banner')).toBeNull();
    expect(screen.queryByText('Cross training')).toBeNull();
    expect(screen.queryByText('RTR')).toBeNull();

    await waitFor(() => {
      expect(mockActivityList).toHaveBeenCalledTimes(1);
    });
    expect(mockCrossTrainingGetForWeek).not.toHaveBeenCalled();
  });

  it('opens the sync-run detail screen when a completed day is tapped', async () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockPlan.plan = {
      id: 'plan-1',
      weeks: [
        {
          weekNumber: 1,
          phase: 'BASE' as const,
          plannedKm: 42,
          sessions: [
            {
              id: 'session-1',
              type: 'EASY',
              date: '2026-04-13',
              distance: 8,
              pace: '5:20',
              actualActivityId: 'activity-1',
            },
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
      ],
      activeInjury: null,
    };
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        userId: 'runner-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-13T07:00:00.000Z',
        distance: 8.1,
        duration: 2580,
        avgPace: 319,
        splits: [],
        matchedSessionId: 'session-1',
      },
    ]);

    render(<WeekTab />);

    await waitFor(() => {
      expect(mockActivityList).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByText('Mon'));
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
  });
});
