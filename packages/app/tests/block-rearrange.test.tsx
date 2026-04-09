import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';

const { mockRefresh, mockUpdateWeeks, planState } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockUpdateWeeks: vi.fn(),
  planState: { current: null as TrainingPlanWithAnnotation | null },
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: planState.current,
    loading: false,
    currentWeek: planState.current?.weeks[0] ?? null,
    currentWeekIndex: 0,
    refresh: mockRefresh,
  }),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: { list: { query: vi.fn(() => new Promise(() => {})) } },
    crossTraining: { getForDateRange: { query: vi.fn().mockResolvedValue([]) } },
    plan: { updateWeeks: { mutate: mockUpdateWeeks } },
  },
}));

import BlockTab from '../app/(tabs)/block';

function session(id: string, type: PlannedSession['type'], overrides: Partial<PlannedSession> = {}): PlannedSession {
  return { id, type, date: '2026-04-06', distance: 8, ...overrides };
}

function makeWeek(
  weekNumber: number,
  sessions: (PlannedSession | null)[],
): TrainingPlanWithAnnotation['weeks'][number] {
  return {
    weekNumber,
    phase: 'BASE',
    sessions,
    plannedKm: 24,
  };
}

function makePlan(weeks: TrainingPlanWithAnnotation['weeks']): TrainingPlanWithAnnotation {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases: { BASE: weeks.length, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    coachAnnotation: 'Keep going.',
  };
}

describe('BlockTab session rearrange', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUpdateWeeks.mockReset();
    mockUpdateWeeks.mockResolvedValue(null);
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-easy', 'EASY', { distance: 8 }),
        null,
        session('w1-long', 'LONG', { distance: 16 }),
        null,
        null,
        null,
        null,
      ]),
      makeWeek(2, [
        session('w2-easy', 'EASY', { distance: 8 }),
        null,
        session('w2-long', 'LONG', { distance: 16 }),
        null,
        null,
        null,
        null,
      ]),
    ]);
  });

  it('shows the scope picker after done and persists the swap to remaining weeks by default', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByText('Rearrange sessions'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-done'));

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    expect(screen.getByText('1 session swap')).toBeTruthy();

    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.id).toBe('w1-long');
    expect(input.weeks[0].sessions[2]?.id).toBe('w1-easy');
    expect(input.weeks[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input.weeks[1].sessions[0]?.id).toBe('w2-long');
    expect(input.weeks[1].sessions[2]?.id).toBe('w2-easy');
    expect(input.weeks[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('respects this-week scope from the propagation picker', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByText('Rearrange sessions'));
    fireEvent.click(screen.getByTestId('rearrange-day-0'));
    fireEvent.click(screen.getByTestId('rearrange-day-2'));
    fireEvent.click(screen.getByTestId('rearrange-done'));
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdateWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdateWeeks.mock.calls[0][0];
    expect(input.weeks[0].sessions[0]?.id).toBe('w1-long');
    expect(input.weeks[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input.weeks[1].sessions[0]?.id).toBe('w2-easy');
    expect(input.weeks[1].swapLog).toBeUndefined();
  });

  it('hides the rearrange button when every session is completed', () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('mon', 'EASY', { actualActivityId: 'act-1' }),
        session('tue', 'EASY', { actualActivityId: 'act-2' }),
        session('wed', 'EASY', { actualActivityId: 'act-3' }),
        session('thu', 'EASY', { actualActivityId: 'act-4' }),
        session('fri', 'EASY', { actualActivityId: 'act-5' }),
        session('sat', 'EASY', { actualActivityId: 'act-6' }),
        session('sun', 'EASY', { actualActivityId: 'act-7' }),
      ]),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    expect(screen.queryByText('Rearrange sessions')).toBeNull();
  });
});
