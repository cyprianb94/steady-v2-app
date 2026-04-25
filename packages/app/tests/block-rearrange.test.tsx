import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';

const { mockRefresh, mockUpdatePlanWeeks, mockActivityListQuery, planState, routeParams, mockRouterPush, mockAuth, focusState } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockUpdatePlanWeeks: vi.fn(),
  mockActivityListQuery: vi.fn(),
  planState: {
    current: null as TrainingPlanWithAnnotation | null,
    currentWeekIndex: 0,
  },
  routeParams: {
    current: {} as Record<string, string>,
  },
  mockRouterPush: vi.fn(),
  mockAuth: {
    session: { user: { id: 'runner-1' } },
    isLoading: false,
  },
  focusState: {
    current: true,
  },
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => focusState.current,
}));

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
  useLocalSearchParams: () => routeParams.current,
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => ({
    plan: planState.current,
    loading: false,
    currentWeek: planState.current?.weeks[0] ?? null,
    currentWeekIndex: planState.currentWeekIndex,
    refresh: mockRefresh,
  }),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: { list: { query: mockActivityListQuery } },
    crossTraining: { getForDateRange: { query: vi.fn().mockResolvedValue([]) } },
  },
}));

vi.mock('../lib/plan-api', () => ({
  updatePlanWeeks: mockUpdatePlanWeeks,
}));

import BlockTab from '../app/(tabs)/block';
import {
  consumeSessionEditReturn,
  stashSessionEditReturn,
} from '../features/plan-builder/session-edit-return';

function dragHandle(testId: string, pageY: number) {
  const handle = screen.getByTestId(testId);
  fireEvent.mouseDown(handle, { clientY: 0 });
  fireEvent.mouseMove(handle, { clientY: pageY });
  fireEvent.mouseUp(handle);
}

function returnEditResult(
  rerender: (ui: React.ReactElement) => void,
  weekIndex: number,
  dayIndex: number,
  updated: Partial<PlannedSession> | null,
) {
  routeParams.current = {
    editSessionResult: JSON.stringify({ weekIndex, dayIndex, updated }),
    editSessionNonce: `${weekIndex}-${dayIndex}-${Date.now()}`,
  };
  rerender(<BlockTab />);
}

function session(id: string, type: PlannedSession['type'], overrides: Partial<PlannedSession> = {}): PlannedSession {
  return { id, type, date: '2026-04-06', distance: 8, ...overrides };
}

function makeWeek(
  weekNumber: number,
  sessions: (PlannedSession | null)[],
  phase: TrainingPlanWithAnnotation['weeks'][number]['phase'] = 'BASE',
): TrainingPlanWithAnnotation['weeks'][number] {
  return {
    weekNumber,
    phase,
    sessions,
    plannedKm: 24,
  };
}

function makePlan(weeks: TrainingPlanWithAnnotation['weeks']): TrainingPlanWithAnnotation {
  const phases = weeks.reduce(
    (acc, week) => {
      acc[week.phase] += 1;
      return acc;
    },
    { BASE: 0, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 } as TrainingPlanWithAnnotation['phases'],
  );

  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases,
    progressionPct: 0,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    todayAnnotation: 'Keep the easy days easy.',
    coachAnnotation: 'Keep going.',
  };
}

describe('BlockTab session rearrange', () => {
  beforeEach(() => {
    mockRefresh.mockReset();
    mockUpdatePlanWeeks.mockReset();
    mockActivityListQuery.mockReset();
    mockRouterPush.mockReset();
    routeParams.current = {};
    consumeSessionEditReturn();
    mockUpdatePlanWeeks.mockResolvedValue(null);
    mockActivityListQuery.mockResolvedValue([]);
    planState.currentWeekIndex = 0;
    focusState.current = true;
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

  it('formats the race date and uses the wireframe-style phase caption copy', () => {
    render(<BlockTab />);

    expect(screen.getByText('Jun 1, 2026')).toBeTruthy();
    expect(screen.getByText('Current phase:')).toBeTruthy();
    expect(
      screen.getByText(/Base\. Week 1 of 2\. Aerobic foundation building steadily\./),
    ).toBeTruthy();
  });

  it('shows the session target as the main expanded-row label with the run type below', () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-easy', 'EASY', { distance: 8, pace: '5:20' }),
        session('w1-interval', 'INTERVAL', { reps: 6, repDist: 400, pace: '3:50' }),
        session('w1-long', 'LONG', { distance: 16, pace: '5:10' }),
        null,
        null,
        null,
        null,
      ]),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    expect(screen.getByText('8km @ 5:20')).toBeTruthy();
    expect(screen.getByText('6×400m @ 3:50')).toBeTruthy();
    expect(screen.getByText('Easy Run')).toBeTruthy();
    expect(screen.getByText('Intervals')).toBeTruthy();
  });

  it('stages a reschedule locally and persists following weeks only after apply', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    expect(screen.queryByText('Rearrange sessions')).toBeNull();

    dragHandle('block-drag-handle-1-0', 120);

    expect(mockUpdatePlanWeeks).not.toHaveBeenCalled();
    expect(screen.getByText('Do you want to apply reschedule?')).toBeTruthy();
    expect(screen.getByTestId('block-day-1-0').textContent).toContain('Long Run');
    expect(screen.queryByText('Moved')).toBeNull();

    fireEvent.click(screen.getByTestId('block-apply-reschedule'));

    expect(screen.getByText('Where should this reschedule apply?')).toBeTruthy();
    expect(screen.queryByText('1 reschedule staged')).toBeNull();
    expect(screen.getByText('Base weeks only')).toBeTruthy();
    expect(screen.getByText('2 base weeks in this plan')).toBeTruthy();
    expect(screen.queryByText('Build weeks only')).toBeNull();

    fireEvent.click(screen.getAllByText('Apply reschedule').at(-1)!);

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.id).toBe('w1-long');
    expect(input[0].sessions[2]?.id).toBe('w1-easy');
    expect(input[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input[1].sessions[0]?.id).toBe('w2-long');
    expect(input[1].sessions[2]?.id).toBe('w2-easy');
    expect(input[1].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('respects this-week scope from the propagation picker', async () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    dragHandle('block-drag-handle-1-0', 120);
    fireEvent.click(screen.getByTestId('block-apply-reschedule'));
    fireEvent.click(screen.getByText('Just this week'));
    fireEvent.click(screen.getAllByText('Apply reschedule').at(-1)!);

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.id).toBe('w1-long');
    expect(input[0].swapLog).toEqual([{ from: 0, to: 2 }]);
    expect(input[1].sessions[0]?.id).toBe('w2-easy');
    expect(input[1].swapLog).toBeUndefined();
  });

  it('shows completed rows as locked with the run status symbol and does not stage a drag for them', () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('mon', 'EASY', { actualActivityId: 'act-1' }),
        null,
        session('wed', 'LONG', { distance: 18 }),
        null,
        null,
        null,
        null,
      ]),
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    expect(screen.getByTestId('block-day-status-1-0')).toBeTruthy();
    expect(screen.queryByText('Logged')).toBeNull();

    dragHandle('block-drag-handle-1-0', 120);

    expect(screen.queryByText('Do you want to apply reschedule?')).toBeNull();
  });

  it('lets the user drag a rest day to move the gap within the week', () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    dragHandle('block-drag-handle-1-1', 60);

    expect(screen.getByText('Do you want to apply reschedule?')).toBeTruthy();
    expect(screen.getByTestId('block-day-1-1').textContent).toContain('Long Run');
  });

  it('keeps past weeks review-only even when some sessions were never logged', () => {
    planState.currentWeekIndex = 1;

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    expect(screen.getByText('Past weeks are locked. Tap a logged session to review synced run details.')).toBeTruthy();

    fireEvent.click(screen.getByTestId('block-day-1-0'));
    expect(screen.queryByText('Update session')).toBeNull();

    dragHandle('block-drag-handle-1-0', 120);
    expect(screen.queryByText('Do you want to apply reschedule?')).toBeNull();
  });

  it('opens run details from the run status symbol in a past week', async () => {
    planState.currentWeekIndex = 1;
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-tempo', 'TEMPO', {
          date: '2026-04-06',
          distance: 10,
          pace: '4:20',
          actualActivityId: 'act-1',
        }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
      makeWeek(2, [
        session('w2-easy', 'EASY', { date: '2026-04-13', distance: 8 }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    ]);
    mockActivityListQuery.mockResolvedValue([
      {
        id: 'act-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-06T07:00:00.000Z',
        distance: 10.1,
        duration: 2620,
        avgPace: 260,
        splits: [],
        matchedSessionId: 'w1-tempo',
      },
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    await waitFor(() => expect(screen.getByTestId('block-review-run-1-0')).toBeTruthy());

    fireEvent.click(screen.getByTestId('block-review-run-1-0'));

    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/act-1');
  });

  it('opens run details from a logged session row in the current week', async () => {
    planState.currentWeekIndex = 0;
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-tempo', 'TEMPO', {
          date: '2026-04-06',
          distance: 10,
          pace: '4:20',
          actualActivityId: 'act-1',
        }),
        session('w1-easy', 'EASY', { date: '2026-04-07', distance: 8 }),
        null,
        null,
        null,
        null,
        null,
      ]),
    ]);
    mockActivityListQuery.mockResolvedValue([
      {
        id: 'act-1',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-06T07:00:00.000Z',
        distance: 10.1,
        duration: 2620,
        avgPace: 260,
        splits: [],
        matchedSessionId: 'w1-tempo',
      },
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    await waitFor(() => expect(screen.getByTestId('block-day-status-1-0')).toBeTruthy());

    fireEvent.click(screen.getByTestId('block-day-1-0'));

    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/act-1');
  });

  it('locks matched completed rows and counts their distance before actualActivityId refreshes', async () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('mon', 'TEMPO', { date: '2026-04-13', distance: 10 }),
        session('tue', 'EASY', { date: '2026-04-14', distance: 8 }),
        session('wed', 'EASY', { date: '2026-04-15', distance: 8, actualActivityId: 'act-wed' }),
        null,
        null,
        null,
        null,
      ]),
    ]);
    mockActivityListQuery.mockResolvedValue([
      {
        id: 'act-tue',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-tue',
        startTime: '2026-04-14T07:00:00.000Z',
        distance: 7.6,
        duration: 2800,
        avgPace: 368,
        splits: [],
        matchedSessionId: 'tue',
      },
      {
        id: 'act-wed',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-wed',
        startTime: '2026-04-15T07:00:00.000Z',
        distance: 8.4,
        duration: 2900,
        avgPace: 345,
        splits: [],
        matchedSessionId: 'wed',
      },
    ]);

    render(<BlockTab />);

    await waitFor(() => expect(screen.getByText('16km')).toBeTruthy());

    fireEvent.click(screen.getByText('W1'));

    await waitFor(() => expect(screen.getAllByTestId(/block-day-status-1-/)).toHaveLength(2));

    dragHandle('block-drag-handle-1-1', 120);

    expect(screen.queryByText('Do you want to apply reschedule?')).toBeNull();
  });

  it('clears a stale completed badge when the loaded linked activity no longer matches the session date', async () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('mon', 'EASY', { date: '2026-04-06', distance: 8 }),
        null,
        null,
        null,
        null,
        null,
        session('sun', 'LONG', {
          date: '2026-04-12',
          distance: 20,
          actualActivityId: 'act-sun',
        }),
      ]),
    ]);
    mockActivityListQuery.mockResolvedValue([
      {
        id: 'act-sun',
        userId: 'user-1',
        source: 'strava',
        externalId: 'strava-sun',
        startTime: '2026-04-05T07:00:00.000Z',
        distance: 20.2,
        duration: 6100,
        avgPace: 302,
        splits: [],
        matchedSessionId: 'sun',
      },
    ]);

    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));

    await waitFor(() => expect(mockActivityListQuery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('block-day-status-1-6')).toBeNull());
    expect(screen.queryByText('✓')).toBeNull();
  });

  it('does not count or lock a future linked-only long run in the current week', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

    try {
      planState.current = makePlan([
        makeWeek(1, [
          session('mon', 'EASY', { date: '2026-04-20', distance: 8, actualActivityId: 'act-mon' }),
          session('tue', 'TEMPO', { date: '2026-04-21', distance: 10, pace: '4:20', actualActivityId: 'act-tue' }),
          null,
          session('thu', 'INTERVAL', { date: '2026-04-23', reps: 6, repDist: 600, recovery: '90s', pace: '3:55' }),
          session('fri', 'EASY', { date: '2026-04-24', distance: 8 }),
          session('sat', 'EASY', { date: '2026-04-25', distance: 15 }),
          session('sun', 'LONG', { date: '2026-04-26', distance: 20, actualActivityId: 'act-sun' }),
        ]),
      ]);
      mockActivityListQuery.mockResolvedValue([
        {
          id: 'act-mon',
          userId: 'user-1',
          source: 'strava',
          externalId: 'strava-mon',
          startTime: '2026-04-20T07:00:00.000Z',
          distance: 8,
          duration: 2580,
          avgPace: 323,
          splits: [],
          matchedSessionId: 'mon',
        },
        {
          id: 'act-tue',
          userId: 'user-1',
          source: 'strava',
          externalId: 'strava-tue',
          startTime: '2026-04-21T07:00:00.000Z',
          distance: 13.5,
          duration: 3320,
          avgPace: 246,
          splits: [],
          matchedSessionId: 'tue',
        },
      ]);

      render(<BlockTab />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByText('21.5km')).toBeTruthy();

      fireEvent.click(screen.getByText('W1'));

      expect(mockActivityListQuery).toHaveBeenCalledTimes(1);
      expect(screen.getAllByTestId(/block-day-status-1-/)).toHaveLength(2);
      expect(screen.getByTestId('block-day-1-6').textContent).toContain('Long Run');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resets the staged reschedule back to the saved order', () => {
    render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    dragHandle('block-drag-handle-1-0', 120);

    expect(screen.getByTestId('block-day-1-0').textContent).toContain('Long Run');

    fireEvent.click(screen.getByTestId('block-reschedule-reset'));

    expect(screen.queryByText('Do you want to apply reschedule?')).toBeNull();
    expect(screen.getByTestId('block-day-1-0').textContent).toContain('Easy Run');
  });

  it('lets the user turn a planned day into a rest day from the expanded week editor', async () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-int', 'INTERVAL', {
          reps: 6,
          repDist: 800,
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
      makeWeek(2, [
        session('w2-int', 'INTERVAL', {
          reps: 6,
          repDist: 800,
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }),
        null,
        null,
        null,
        null,
        null,
        null,
      ]),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByTestId('block-day-1-0'));
    expect(mockRouterPush).toHaveBeenLastCalledWith({
      pathname: '/edit-session',
      params: { weekIndex: '0', dayIndex: '0' },
    });
    returnEditResult(rerender, 0, 0, null);
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]).toBeNull();
    expect(input[1].sessions[0]?.id).toBe('w2-int');
    expect(input[1].sessions[0]?.type).toBe('INTERVAL');
  });

  it('applies a returned rest edit even when native tab params are unavailable', async () => {
    planState.current = makePlan([
      makeWeek(1, [
        session('w1-easy', 'EASY', { distance: 8 }),
        null,
        session('w1-linked-future-long', 'LONG', {
          date: '2099-04-26',
          distance: 16,
          actualActivityId: 'act-future-long',
        }),
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
    focusState.current = false;
    const { rerender } = render(<BlockTab />);

    stashSessionEditReturn({
      weekIndex: 0,
      dayIndex: 2,
      updated: { type: 'REST' },
    });
    focusState.current = true;
    rerender(<BlockTab />);

    await waitFor(() => expect(screen.getByText('Apply change where?')).toBeTruthy());
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[2]).toBeNull();
    expect(input[1].sessions[2]?.type).toBe('LONG');
  });

  it('lets the user add a session on an empty rest slot from the expanded week editor', async () => {
    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W1'));
    fireEvent.click(screen.getByTestId('block-day-1-1'));
    expect(mockRouterPush).toHaveBeenLastCalledWith({
      pathname: '/edit-session',
      params: { weekIndex: '0', dayIndex: '1' },
    });
    returnEditResult(rerender, 0, 1, { type: 'EASY', distance: 8, pace: '5:20' });
    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[1]?.type).toBe('EASY');
    expect(input[0].sessions[1]?.id).toBeTruthy();
    expect(input[0].sessions[1]?.date).toBe('2026-04-07');
    expect(input[1].sessions[1]).toBeNull();
  });

  it('expands the edited future week while choosing where to apply the change', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null]),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null]),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null]),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W2'));
    expect(screen.getByTestId('block-day-2-0')).toBeTruthy();

    fireEvent.click(screen.getByText('W3'));
    fireEvent.click(screen.getByTestId('block-day-3-0'));
    returnEditResult(rerender, 2, 0, { type: 'EASY', distance: 10, pace: '5:20' });

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    expect(screen.queryByTestId('block-day-2-0')).toBeNull();
    expect(screen.getByTestId('block-day-3-0')).toBeTruthy();

    fireEvent.click(screen.getByText('This week only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('block-day-2-0')).toBeNull();
    expect(screen.getByTestId('block-day-3-0')).toBeTruthy();
  });

  it('waits for the block tab to refocus before opening the apply-change sheet', () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null]),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null]),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null]),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W3'));
    expect(screen.getByTestId('block-day-3-0')).toBeTruthy();

    focusState.current = false;
    routeParams.current = {
      editSessionResult: JSON.stringify({
        weekIndex: 2,
        dayIndex: 0,
        updated: { type: 'EASY', distance: 8, pace: '5:45' },
      }),
      editSessionNonce: 'week-3-returning-before-focus',
    };
    rerender(<BlockTab />);

    expect(screen.queryByText('Apply change where?')).toBeNull();
    expect(screen.queryByTestId('block-day-3-0')).toBeNull();

    focusState.current = true;
    rerender(<BlockTab />);

    expect(screen.getByText('Apply change where?')).toBeTruthy();
    expect(screen.getByTestId('block-day-3-0')).toBeTruthy();
  });

  it('applies a build-phase edit across every build week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W2'));
    fireEvent.click(screen.getByTestId('block-day-2-0'));
    returnEditResult(rerender, 1, 0, null);

    expect(screen.getByText('Build phase only')).toBeTruthy();
    expect(screen.getByText('2 build weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Build phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.type).toBe('EASY');
    expect(input[1].sessions[0]).toBeNull();
    expect(input[2].sessions[0]).toBeNull();
    expect(input[3].sessions[0]?.type).toBe('EASY');
  });

  it('applies a future peak-phase edit across every peak week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(5, [session('w5-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W4'));
    fireEvent.click(screen.getByTestId('block-day-4-0'));
    returnEditResult(rerender, 3, 0, null);

    expect(screen.getByText('Peak phase only')).toBeTruthy();
    expect(screen.getByText('2 peak weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Peak phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.type).toBe('EASY');
    expect(input[1].sessions[0]?.type).toBe('EASY');
    expect(input[2].sessions[0]).toBeNull();
    expect(input[3].sessions[0]).toBeNull();
    expect(input[4].sessions[0]?.type).toBe('EASY');
  });

  it('applies a recovery-phase edit across every recovery week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BASE'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'RECOVERY'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'RECOVERY'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W3'));
    fireEvent.click(screen.getByTestId('block-day-3-0'));
    returnEditResult(rerender, 2, 0, null);

    expect(screen.getByText('Recovery phase only')).toBeTruthy();
    expect(screen.getByText('2 recovery weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Recovery phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.type).toBe('EASY');
    expect(input[1].sessions[0]).toBeNull();
    expect(input[2].sessions[0]).toBeNull();
    expect(input[3].sessions[0]?.type).toBe('EASY');
  });

  it('applies a taper-phase edit across every taper week only', async () => {
    planState.current = makePlan([
      makeWeek(1, [session('w1-easy', 'EASY'), null, null, null, null, null, null], 'BUILD'),
      makeWeek(2, [session('w2-easy', 'EASY'), null, null, null, null, null, null], 'PEAK'),
      makeWeek(3, [session('w3-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
      makeWeek(4, [session('w4-easy', 'EASY'), null, null, null, null, null, null], 'TAPER'),
    ]);

    const { rerender } = render(<BlockTab />);

    fireEvent.click(screen.getByText('W4'));
    fireEvent.click(screen.getByTestId('block-day-4-0'));
    returnEditResult(rerender, 3, 0, null);

    expect(screen.getByText('Taper phase only')).toBeTruthy();
    expect(screen.getByText('2 taper weeks in this plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Taper phase only'));
    fireEvent.click(screen.getByText('Apply change'));

    await waitFor(() => expect(mockUpdatePlanWeeks).toHaveBeenCalledTimes(1));
    const input = mockUpdatePlanWeeks.mock.calls[0][0];
    expect(input[0].sessions[0]?.type).toBe('EASY');
    expect(input[1].sessions[0]?.type).toBe('EASY');
    expect(input[2].sessions[0]).toBeNull();
    expect(input[3].sessions[0]).toBeNull();
  });
});
