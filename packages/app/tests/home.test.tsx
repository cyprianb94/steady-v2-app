import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

// Mock auth and plan hooks — these are the seams we control
const mockAuth: { session: any; isLoading: boolean; signIn: any; signOut: any } = {
  session: null,
  isLoading: true,
  signIn: vi.fn(),
  signOut: vi.fn(),
};
vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

const mockPlan: { plan: any; loading: boolean; currentWeek: any; currentWeekIndex: number; refresh: any } = {
  plan: null,
  loading: true,
  currentWeek: null,
  currentWeekIndex: 0,
  refresh: vi.fn(),
};
vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

const mockListActivities = vi.hoisted(() => vi.fn());

vi.mock('../lib/activity-api', () => ({
  listActivities: mockListActivities,
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    crossTraining: {
      getForWeek: { query: vi.fn().mockResolvedValue([]) },
      log: { mutate: vi.fn() },
      delete: { mutate: vi.fn() },
    },
    plan: {
      updateInjury: { mutate: vi.fn() },
      markInjury: { mutate: vi.fn() },
      clearInjury: { mutate: vi.fn() },
    },
  },
}));

import HomeScreen from '../app/(tabs)/home';

function slotIndexForIsoDate(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function todayIsoLocalForTest(now: Date = new Date()): string {
  const timezoneOffsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockAuth.session = null;
    mockAuth.isLoading = true;
    mockPlan.plan = null;
    mockPlan.loading = true;
    mockPlan.currentWeek = null;
    mockPlan.refresh = vi.fn();
    mockListActivities.mockReset();
    mockListActivities.mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading indicator while auth is loading', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-loading')).toBeTruthy();
  });

  it('shows sign-in prompt when not authenticated', () => {
    mockAuth.isLoading = false;
    mockPlan.loading = false;

    render(<HomeScreen />);
    expect(screen.getByText('Sign in to see your plan')).toBeTruthy();
  });

  it('shows no-plan prompt when authenticated but no plan exists', () => {
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = null;

    render(<HomeScreen />);
    expect(screen.getByText('No plan yet')).toBeTruthy();
    expect(screen.getByText('Build your training plan to get started')).toBeTruthy();
  });

  it('does not render week navigation arrows (locked to current week)', () => {
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [null, null, null, null, null, null, null],
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = { id: 'p1', weeks: [week], phases: {}, raceDate: '2026-07-15', coachAnnotation: 'Keep this one conversational.' };
    mockPlan.currentWeek = week;
    mockPlan.currentWeekIndex = 0;

    render(<HomeScreen />);
    // WeekHeader has prev/next buttons — Home should NOT render WeekHeader
    expect(screen.queryByTestId('week-header')).toBeNull();
  });

  it('renders a scrollable container when plan exists', () => {
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [null, null, null, null, null, null, null],
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = { id: 'p1', weeks: [week], phases: {}, raceDate: '2026-07-15', coachAnnotation: 'Keep this one conversational.' };
    mockPlan.currentWeek = week;
    mockPlan.currentWeekIndex = 0;

    render(<HomeScreen />);
    expect(screen.getByTestId('home-scroll')).toBeTruthy();
  });

  it('keeps today-first guidance beneath the week header', () => {
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [null, null, null, null, null, null, null],
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Keep this one conversational.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText(/week 3/i)).toBeTruthy();
    expect(screen.queryByText(/focus on the session in front of you/i)).toBeNull();
  });

  it('shows the current week date range and large week-phase heading', () => {
    const week = {
      weekNumber: 3,
      phase: 'BUILD' as const,
      sessions: [
        { id: 'mon', type: 'EASY', date: '2026-04-06', distance: 8, pace: '5:20' },
        null,
        null,
        { id: 'thu', type: 'TEMPO', date: '2026-04-09', distance: 10, pace: '4:20' },
        null,
        { id: 'sat', type: 'EASY', date: '2026-04-11', distance: 12, pace: '5:15' },
        { id: 'sun', type: 'LONG', date: '2026-04-12', distance: 20, pace: '5:05' },
      ],
      plannedKm: 50,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Keep the first half controlled.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('APR 6 – 12 · 2026')).toBeTruthy();
    expect(screen.getByText('Week 3 · Build Phase')).toBeTruthy();
  });

  it('uses the device local date after midnight when choosing the today card', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T23:03:00Z'));
    const timezoneOffsetSpy = vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-60);
    try {
      const week = {
        weekNumber: 1,
        phase: 'BASE' as const,
        sessions: [
          null,
          null,
          null,
          { id: 'thu-tempo', type: 'TEMPO', date: '2026-04-09', distance: 10, pace: '4:20' },
          null,
          { id: 'sat-easy', type: 'EASY', date: '2026-04-11', distance: 12, pace: '5:15' },
          null,
        ],
        plannedKm: 22,
      };
      mockAuth.isLoading = false;
      mockAuth.session = { user: { id: '1' } };
      mockPlan.loading = false;
      mockPlan.plan = {
        id: 'p1',
        weeks: [week],
        phases: {},
        raceDate: '2026-07-15',
        coachAnnotation: 'Take the recovery.',
      };
      mockPlan.currentWeek = week;

      render(<HomeScreen />);

      expect(screen.getByText(/rest day/i)).toBeTruthy();
      expect(screen.queryByText('10km Tempo')).toBeNull();
    } finally {
      timezoneOffsetSpy.mockRestore();
    }
  });

  it('refreshes the today card when the tab stays open across midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T22:59:30Z'));

    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [
        null,
        null,
        null,
        { id: 'thu-tempo', type: 'TEMPO', date: '2026-04-09', distance: 10, pace: '4:20' },
        null,
        { id: 'sat-easy', type: 'EASY', date: '2026-04-11', distance: 12, pace: '5:15' },
        null,
      ],
      plannedKm: 22,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Take the recovery.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('10km Tempo')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText(/rest day/i)).toBeTruthy();
    expect(screen.queryByText('10km Tempo')).toBeNull();
  });

  it('shows weekly load with actual and planned distance', async () => {
    const week = {
      weekNumber: 3,
      phase: 'BUILD' as const,
      sessions: [
        { id: 'mon', type: 'EASY', date: '2026-04-06', distance: 8, pace: '5:20', actualActivityId: 'act-1' },
        null,
        null,
        { id: 'thu', type: 'TEMPO', date: '2026-04-09', distance: 10, pace: '4:20' },
        null,
        { id: 'sat', type: 'EASY', date: '2026-04-11', distance: 12, pace: '5:15' },
        { id: 'sun', type: 'LONG', date: '2026-04-12', distance: 20, pace: '5:05' },
      ],
      plannedKm: 50,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Keep the first half controlled.',
    };
    mockPlan.currentWeek = week;
    mockListActivities.mockResolvedValue([
      {
        id: 'act-1',
        userId: '1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: '2026-04-06T07:00:00.000Z',
        distance: 8.2,
        duration: 2620,
        avgPace: 320,
        splits: [],
        matchedSessionId: 'mon',
      },
    ]);

    render(<HomeScreen />);

    expect(await screen.findByText('WEEKLY LOAD')).toBeTruthy();
    const weeklyLoadCard = screen.getByTestId('weekly-load-card');
    expect(within(weeklyLoadCard).getByText('8.2km')).toBeTruthy();
    expect(within(weeklyLoadCard).getByText('/ 50km')).toBeTruthy();
  });

  it('uses the annotation as an inline Steady note and suppresses the duplicate coach card', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z')); // Monday
    const today = '2026-04-06';
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'today-session',
          type: 'EASY',
          date: today,
          distance: 8,
          pace: '5:20',
        },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Intervals tomorrow — keep today conversational.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('Steady')).toBeTruthy();
    expect(screen.getAllByText(/keep today conversational/i).length).toBeGreaterThan(0);
    expect(screen.queryByTestId('coach-annotation')).toBeNull();
  });

  it('uses the weekday slot for today when saved session dates are out of range', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z')); // Friday

    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [
        null,
        null,
        null,
        null,
        {
          id: 'friday-session',
          type: 'EASY',
          date: '2026-06-19',
          distance: 8,
          pace: '5:20',
        },
        {
          id: 'saturday-session',
          type: 'LONG',
          date: '2026-06-20',
          distance: 16,
          pace: '5:10',
        },
        null,
      ],
      plannedKm: 24,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-26',
      coachAnnotation: 'Keep this one conversational.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText('APR 6 – 12 · 2026')).toBeTruthy();
    expect(screen.getByText('8km Easy Run')).toBeTruthy();
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Long 16k')).toBeTruthy();
  });

  it('prefers the weekday slot over another session that happens to carry today’s stale date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T12:00:00Z')); // Friday

    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [
        null,
        null,
        null,
        { id: 'thu-tempo', type: 'TEMPO', date: '2026-04-09', distance: 10, pace: '4:20' },
        null,
        { id: 'sat-easy', type: 'EASY', date: '2026-04-10', distance: 12, pace: '5:20' },
        null,
      ],
      plannedKm: 22,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-26',
      coachAnnotation: 'First week — keep it controlled and let consistency set the tone.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText(/rest day/i)).toBeTruthy();
    expect(screen.queryByText('12km Easy Run')).toBeNull();
    expect(screen.getByText('Fri')).toBeTruthy();
    expect(screen.getAllByText('Rest').length).toBeGreaterThan(0);
    expect(screen.getByText('Sat')).toBeTruthy();
    expect(screen.getByText('Easy 12k')).toBeTruthy();
  });

  it('renders saved feel for today’s matched activity from activity data', async () => {
    const today = todayIsoLocalForTest();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
      actualActivityId: 'activity-1',
    };
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions,
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Nice work.',
    };
    mockPlan.currentWeek = week;
    mockListActivities.mockResolvedValue([
      {
        id: 'activity-1',
        matchedSessionId: 'session-1',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        subjectiveInput: {
          legs: 'heavy',
          breathing: 'controlled',
          overall: 'done',
        },
      },
    ]);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('Legs: Heavy')).toBeTruthy();
    });
    expect(screen.getByText('Breathing: Controlled')).toBeTruthy();
    expect(screen.getByText('Overall: Done')).toBeTruthy();
    expect(screen.queryByTestId('subjective-input-prompt')).toBeNull();
  });

  it('does not show a subjective prompt for a matched run without saved feel', () => {
    const today = todayIsoLocalForTest();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
      actualActivityId: 'activity-1',
    };
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions,
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: 'Nice work.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.queryByTestId('subjective-input-prompt')).toBeNull();
  });
});
