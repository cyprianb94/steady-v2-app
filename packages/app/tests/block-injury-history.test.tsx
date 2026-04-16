import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';

const { mockGetForDateRange, mockRefresh, mockRouterPush, mockAuth, planState } = vi.hoisted(() => ({
  mockGetForDateRange: vi.fn(),
  mockRefresh: vi.fn(),
  mockRouterPush: vi.fn(),
  mockAuth: {
    session: { user: { id: 'runner-1' } },
    isLoading: false,
  },
  planState: {
    current: null as TrainingPlanWithAnnotation | null,
    currentWeekIndex: 0,
  },
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: planState.current,
    loading: false,
    currentWeek: planState.current?.weeks[planState.currentWeekIndex] ?? null,
    currentWeekIndex: planState.currentWeekIndex,
    refresh: mockRefresh,
  }),
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => ({
    requestAutoSync: async () => null,
    forceSync: async () => null,
    syncRevision: 0,
    syncing: false,
  }),
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-05-01',
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: vi.fn().mockResolvedValue([]),
      },
    },
    crossTraining: {
      getForDateRange: {
        query: mockGetForDateRange,
      },
    },
    plan: {
      updateWeeks: {
        mutate: vi.fn(),
      },
    },
  },
}));

import BlockTab from '../app/(tabs)/block';

function addDays(startDate: string, offset: number): string {
  const value = new Date(`${startDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function makeSession(id: string, date: string, type: PlannedSession['type'] = 'EASY'): PlannedSession {
  return {
    id,
    type,
    date,
    distance: type === 'LONG' ? 16 : 8,
    pace: '5:15',
  };
}

function makeWeek(
  weekNumber: number,
  phase: TrainingPlanWithAnnotation['weeks'][number]['phase'],
  startDate: string,
): TrainingPlanWithAnnotation['weeks'][number] {
  return {
    weekNumber,
    phase,
    plannedKm: 40,
    sessions: Array.from({ length: 7 }, (_, index) => makeSession(`w${weekNumber}-${index}`, addDays(startDate, index))),
  };
}

function withNormalizedText(expected: string) {
  return (_content: string, node: Element | null) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() === expected;
}

describe('BlockTab injury history', () => {
  beforeEach(() => {
    mockGetForDateRange.mockReset();
    mockGetForDateRange.mockResolvedValue([
      {
        id: 'xt-1',
        date: '2026-04-16',
        type: 'Cycling',
        durationMinutes: 45,
        createdAt: '2026-04-16T10:00:00.000Z',
      },
    ]);
    mockRefresh.mockReset();
    mockRefresh.mockResolvedValue(undefined);
    planState.currentWeekIndex = 3;
    planState.current = {
      id: 'plan-1',
      userId: 'user-1',
      createdAt: '2026-04-01',
      raceName: 'Spring Marathon',
      raceDate: '2026-06-01',
      raceDistance: 'Marathon',
      targetTime: 'sub-3:20',
      phases: {
        BASE: 1,
        BUILD: 2,
        RECOVERY: 0,
        PEAK: 1,
        TAPER: 0,
      },
      progressionPct: 0,
      templateWeek: makeWeek(1, 'BASE', '2026-04-06').sessions,
      weeks: [
        makeWeek(1, 'BASE', '2026-04-06'),
        makeWeek(2, 'BUILD', '2026-04-13'),
        makeWeek(3, 'BUILD', '2026-04-20'),
        makeWeek(4, 'PEAK', '2026-04-27'),
      ],
      activeInjury: {
        name: 'Calf strain',
        markedDate: '2026-04-15',
        rtrStep: 3,
        rtrStepCompletedDates: ['2026-04-16', '2026-04-20', '2026-04-24'],
        status: 'resolved',
        resolvedDate: '2026-04-24',
      },
      todayAnnotation: 'Peak work starts soon.',
      coachAnnotation: 'Ease into the peak block.',
    };
  });

  it('keeps the normal block rendering when injury history is persisted', async () => {
    render(<BlockTab />);

    await waitFor(() => {
      expect(
        screen.getByText(withNormalizedText('Current phase: Peak. Week 1 of 1. Race-specific sharpness is coming together.')),
      ).toBeTruthy();
    });

    expect(screen.queryByText('INJURY')).toBeNull();
    expect(screen.queryByText('Cycling 45m')).toBeNull();
    expect(mockGetForDateRange).not.toHaveBeenCalled();
  });

  it('describes the underlying training phase instead of injury history when the UI is hidden', async () => {
    planState.currentWeekIndex = 1;

    render(<BlockTab />);

    await waitFor(() => {
      expect(
        screen.getByText(withNormalizedText('Current phase: Build. Week 1 of 2. Peak volume approaching.')),
      ).toBeTruthy();
    });

    expect(screen.queryByText('Injury history. Week 1 of 2. Recovery is complete and this period stays visible in the block.')).toBeNull();
    expect(mockGetForDateRange).not.toHaveBeenCalled();
  });
});
