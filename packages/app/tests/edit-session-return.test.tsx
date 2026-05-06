import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrainingPlanWithAnnotation } from '@steady/types';

const {
  mockRouterBack,
  mockRouterReplace,
  mockUseLocalSearchParams,
  mockPlan,
} = vi.hoisted(() => ({
  mockRouterBack: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockUseLocalSearchParams: vi.fn(),
  mockPlan: {
    current: null as TrainingPlanWithAnnotation | null,
    loading: false,
  },
}));

vi.mock('expo-router', () => ({
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: mockUseLocalSearchParams,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: mockPlan.current,
    loading: mockPlan.loading,
  }),
}));

vi.mock('../components/plan-builder/SessionEditorScreen', () => ({
  SessionEditorScreen: ({ onClose, onSave }: {
    onClose: () => void;
    onSave: (dayIndex: number, updated: { type: 'EASY'; distance: number }) => void;
  }) => (
    <>
      <button type="button" onClick={onClose}>Cancel edit</button>
      <button type="button" onClick={() => onSave(0, { type: 'EASY', distance: 10 })}>Update edit</button>
    </>
  ),
}));

import EditSessionScreen from '../app/edit-session';

function makePlan(): TrainingPlanWithAnnotation {
  const week = {
    weekNumber: 1,
    phase: 'BASE' as const,
    plannedKm: 8,
    sessions: [
      { id: 'w1-easy', type: 'EASY' as const, date: '2026-04-06', distance: 8 },
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  };

  return {
    id: 'plan-1',
    userId: 'runner-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: week.sessions,
    weeks: [week],
    activeInjury: null,
    todayAnnotation: null,
    coachAnnotation: null,
  };
}

describe('EditSessionScreen Block return navigation', () => {
  beforeEach(() => {
    mockRouterBack.mockReset();
    mockRouterReplace.mockReset();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({
      weekIndex: '0',
      dayIndex: '0',
      returnTo: 'block',
      returnWeekNumber: '1',
    });
    mockPlan.current = makePlan();
    mockPlan.loading = false;
  });

  it('returns to Block with the edited week open when cancelled from a Block edit', () => {
    render(<EditSessionScreen />);

    fireEvent.click(screen.getByText('Cancel edit'));

    expect(mockRouterBack).not.toHaveBeenCalled();
    expect(mockRouterReplace).toHaveBeenCalledWith({
      pathname: '/(tabs)/block',
      params: {
        openWeekNumber: '1',
        blockReturnNonce: expect.any(String),
      },
    });
  });

  it('returns to Block with edit payload and the edited week open when saved', () => {
    render(<EditSessionScreen />);

    fireEvent.click(screen.getByText('Update edit'));

    const route = mockRouterReplace.mock.calls[0][0];
    expect(route).toMatchObject({
      pathname: '/(tabs)/block',
      params: {
        editSessionNonce: expect.any(String),
        openWeekNumber: '1',
        blockReturnNonce: expect.any(String),
      },
    });
    expect(JSON.parse(route.params.editSessionResult)).toEqual({
      weekIndex: 0,
      dayIndex: 0,
      updated: { type: 'EASY', distance: 10 },
    });
  });
});
