import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const mockRouterPush = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  router: {
    push: mockRouterPush,
  },
}));

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

const mockStrava = vi.hoisted(() => ({
  status: null as any,
  syncing: false,
  syncRevision: 0,
  refreshStatus: vi.fn(),
  forceSync: vi.fn(),
}));

vi.mock('../hooks/useStravaSync', () => ({
  useStravaSync: () => mockStrava,
}));

const mockActivityList = vi.hoisted(() => vi.fn());
const mockActivityGet = vi.hoisted(() => vi.fn());
const mockActivityMatchSession = vi.hoisted(() => vi.fn());
const mockPlanUpdateWeeks = vi.hoisted(() => vi.fn());
const mockPreferences = vi.hoisted(() => ({
  units: 'metric' as 'metric' | 'imperial',
  weeklyVolumeMetric: 'distance' as 'distance' | 'time',
  loading: false,
  updatingUnits: false,
  updatingWeeklyVolumeMetric: false,
  setUnits: vi.fn(),
  setWeeklyVolumeMetric: vi.fn(),
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
      matchSession: {
        mutate: mockActivityMatchSession,
      },
    },
    plan: {
      updateWeeks: {
        mutate: mockPlanUpdateWeeks,
      },
    },
  },
}));

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => mockPreferences,
}));

import HomeScreen from '../app/(tabs)/home';
import { todayIsoLocal } from '../lib/plan-helpers';

function slotIndexForIsoDate(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function currentLocalIsoDate(): string {
  return todayIsoLocal(new Date());
}

describe('HomeScreen', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockRouterPush.mockReset();
    mockAuth.session = null;
    mockAuth.isLoading = true;
    mockPlan.plan = null;
    mockPlan.loading = true;
    mockPlan.currentWeek = null;
    mockPlan.refresh = vi.fn();
    mockStrava.status = null;
    mockStrava.syncing = false;
    mockStrava.syncRevision = 0;
    mockStrava.refreshStatus.mockReset();
    mockStrava.refreshStatus.mockResolvedValue(null);
    mockStrava.forceSync.mockReset();
    mockStrava.forceSync.mockResolvedValue(null);
    mockActivityList.mockReset();
    mockActivityGet.mockReset();
    mockActivityMatchSession.mockReset();
    mockPlanUpdateWeeks.mockReset();
    mockPreferences.units = 'metric';
    mockPreferences.weeklyVolumeMetric = 'distance';
    mockPreferences.loading = false;
    mockPreferences.updatingUnits = false;
    mockPreferences.updatingWeeklyVolumeMetric = false;
    mockPreferences.setUnits.mockReset();
    mockPreferences.setWeeklyVolumeMetric.mockReset();
    mockActivityList.mockReturnValue(new Promise(() => {}));
    mockActivityGet.mockResolvedValue(null);
    mockActivityMatchSession.mockResolvedValue({});
    mockPlanUpdateWeeks.mockResolvedValue({});
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a loading indicator while auth is loading', () => {
    render(<HomeScreen />);
    expect(screen.getByTestId('home-loading')).toBeTruthy();
  });

  it('can transition from loading to a loaded weekly volume view', () => {
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [null, null, null, null, null, null, null],
      plannedKm: 40,
    };

    const { rerender } = render(<HomeScreen />);
    expect(screen.getByTestId('home-loading')).toBeTruthy();

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

    rerender(<HomeScreen />);

    expect(screen.getByTestId('weekly-volume-card')).toBeTruthy();
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

  it('shows the Strava overlay only after status resolves disconnected', () => {
    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [null, null, null, null, null, null, null],
      plannedKm: 40,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = { id: 'p1', weeks: [week], phases: {}, raceDate: '2026-07-15', coachAnnotation: null };
    mockPlan.currentWeek = week;

    const { rerender } = render(<HomeScreen />);
    expect(screen.queryByTestId('home-strava-overlay')).toBeNull();

    mockStrava.status = { connected: false, athleteId: null, lastSyncedAt: null };
    rerender(<HomeScreen />);

    expect(screen.getByTestId('home-strava-overlay')).toBeTruthy();
    expect(screen.getByText('Connect Strava')).toBeTruthy();
    expect(screen.getByText('Steady needs your runs to show planned vs actual.')).toBeTruthy();

    mockStrava.status = { connected: true, athleteId: '12345', lastSyncedAt: null };
    rerender(<HomeScreen />);

    expect(screen.queryByTestId('home-strava-overlay')).toBeNull();
  });

  it('locks home scroll while the weekly volume plot is scrubbed', () => {
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        { id: 'mon', type: 'EASY', date: '2026-04-27', distance: 8, pace: '5:20' },
        null,
        null,
        { id: 'thu', type: 'TEMPO', date: '2026-04-30', distance: 10, pace: '4:20' },
        null,
        { id: 'sat', type: 'EASY', date: '2026-05-02', distance: 12, pace: '5:15' },
        { id: 'sun', type: 'LONG', date: '2026-05-03', distance: 20, pace: '5:05' },
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
      coachAnnotation: 'Keep this one conversational.',
    };
    mockPlan.currentWeek = week;
    mockPlan.currentWeekIndex = 0;

    render(<HomeScreen />);

    expect(screen.getByTestId('home-scroll').getAttribute('data-scroll-enabled')).toBe('true');

    fireEvent.click(screen.getByTestId('weekly-volume-collapsed'));
    fireEvent.mouseDown(screen.getByTestId('weekly-volume-plot-scrub-surface'), {
      clientX: 8,
      clientY: 12,
    });

    expect(screen.getByTestId('home-scroll').getAttribute('data-scroll-enabled')).toBe('false');

    fireEvent.mouseUp(screen.getByTestId('weekly-volume-plot-scrub-surface'), {
      clientX: 8,
      clientY: 12,
    });

    expect(screen.getByTestId('home-scroll').getAttribute('data-scroll-enabled')).toBe('true');
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
    vi.setSystemTime(new Date(2026, 3, 9, 23, 59, 30));

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

  it('shows weekly volume with actual and planned distance', async () => {
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
    mockActivityList.mockResolvedValue([
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

    expect(await screen.findByText('WEEKLY VOLUME')).toBeTruthy();
    const weeklyVolumeCard = screen.getByTestId('weekly-volume-card');
    expect(within(weeklyVolumeCard).getByText('8.2km')).toBeTruthy();
    expect(within(weeklyVolumeCard).getByText('/ 50km')).toBeTruthy();
    expect(within(weeklyVolumeCard).queryByText(/h\d{2}|\d+m/)).toBeNull();
    expect(weeklyVolumeCard.getAttribute('style')).toContain('background-color: rgb(253, 250, 245)');
    expect(weeklyVolumeCard.getAttribute('style')).toContain('border-color: rgb(229, 221, 208)');
    expect(weeklyVolumeCard.getAttribute('style')).toContain('border-width: 1.5px');
    expect(weeklyVolumeCard.getAttribute('style')).toContain('margin-bottom: 16px');
  });

  it('shows only time when weekly volume preference is time', async () => {
    mockPreferences.weeklyVolumeMetric = 'time';
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
    mockActivityList.mockResolvedValue([
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

    const weeklyVolumeCard = await screen.findByTestId('weekly-volume-card');
    expect(within(weeklyVolumeCard).getByText('44min')).toBeTruthy();
    expect(within(weeklyVolumeCard).getByText('/ 4h11')).toBeTruthy();
    expect(within(weeklyVolumeCard).queryByText('8.2km')).toBeNull();
  });

  it('ignores a future linked-only long run in the current week load and remaining-days status', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'));

    const week = {
      weekNumber: 2,
      phase: 'BASE' as const,
      sessions: [
        { id: 'mon', type: 'EASY', date: '2026-04-20', distance: 8, pace: '5:20', actualActivityId: 'act-mon' },
        { id: 'tue', type: 'TEMPO', date: '2026-04-21', distance: 10, pace: '4:20', actualActivityId: 'act-tue' },
        null,
        { id: 'thu', type: 'INTERVAL', date: '2026-04-23', reps: 6, repDist: 600, pace: '3:55', recovery: '90s' },
        { id: 'fri', type: 'EASY', date: '2026-04-24', distance: 8, pace: '5:20' },
        { id: 'sat', type: 'EASY', date: '2026-04-25', distance: 15, pace: '5:20' },
        { id: 'sun', type: 'LONG', date: '2026-04-26', distance: 20, pace: '5:05', actualActivityId: 'act-sun' },
      ],
      plannedKm: 72,
    };

    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-11-22',
      coachAnnotation: 'Keep the long run easy when it comes.',
    };
    mockPlan.currentWeek = week;
    mockPlan.currentWeekIndex = 0;
    mockActivityList.mockResolvedValue([
      {
        id: 'act-mon',
        userId: '1',
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
        userId: '1',
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

    render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    const weeklyVolumeCard = screen.getByTestId('weekly-volume-card');
    expect(within(weeklyVolumeCard).getByText('21.5km')).toBeTruthy();
    expect(within(weeklyVolumeCard).queryByText('41.5km')).toBeNull();
    expect(screen.getAllByTestId('day-row-check')).toHaveLength(1);
    expect(screen.getAllByTestId('day-row-off-target')).toHaveLength(1);
  });

  it('keeps linked runs visible on home before the activity snapshot catches up', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z')); // Saturday

    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [
        null,
        null,
        {
          id: 'wed-run',
          type: 'EASY',
          date: '2026-04-15',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-wed',
        },
        null,
        {
          id: 'fri-run',
          type: 'EASY',
          date: '2026-04-17',
          distance: 8,
          pace: '5:20',
          actualActivityId: 'act-fri',
        },
        null,
        null,
      ],
      plannedKm: 16,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([]);

    render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    const weeklyVolumeCard = screen.getByTestId('weekly-volume-card');
    expect(within(weeklyVolumeCard).getByText('16km')).toBeTruthy();
    expect(screen.getAllByTestId('day-row-check')).toHaveLength(2);
    expect(screen.queryByTestId('day-row-warning')).toBeNull();
  });

  it('normalizes scrambled session dates back onto the displayed week slots', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00Z')); // Saturday

    const week = {
      weekNumber: 1,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'mon-int',
          type: 'INTERVAL',
          date: '2026-04-16',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
          pace: '3:50',
        },
        null,
        { id: 'wed-easy', type: 'EASY', date: '2026-04-15', distance: 8, pace: '5:20' },
        null,
        { id: 'fri-easy', type: 'EASY', date: '2026-04-18', distance: 8, pace: '5:20' },
        {
          id: 'sat-tempo',
          type: 'TEMPO',
          date: '2026-04-13',
          distance: 10,
          pace: '4:20',
          warmup: { unit: 'km', value: 2 },
          cooldown: { unit: 'km', value: 1.5 },
        },
        { id: 'sun-long', type: 'LONG', date: '2026-04-19', distance: 20, pace: '5:05' },
      ],
      plannedKm: 58,
    };
    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-11-22',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([]);

    render(<HomeScreen />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('APR 13 – 19 · 2026')).toBeTruthy();
    expect(screen.getByText('10km Tempo')).toBeTruthy();
    expect(screen.getByText('Saturday, Apr 18')).toBeTruthy();
  });

  it('renders the today note inline and keeps broader guidance in the lower coach card', () => {
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
      todayAnnotation: 'First week — keep it controlled and let consistency set the tone.',
      coachAnnotation: 'Intervals tomorrow — keep today conversational.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByText(/consistency set the tone/i)).toBeTruthy();
    expect(screen.getByTestId('coach-annotation')).toBeTruthy();
    expect(screen.getByText(/keep today conversational/i)).toBeTruthy();
  });

  it('suppresses the lower coach card when only one note is available', () => {
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

    expect(screen.getByText(/keep today conversational/i)).toBeTruthy();
    expect(screen.queryByTestId('coach-annotation')).toBeNull();
  });

  it('opens the planned-session sheet from the planned today hero without routing to Steady conversation', async () => {
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
      todayAnnotation: 'First week — keep it controlled and let consistency set the tone.',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId('hero-card'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('UNLOGGED')).toBeTruthy();
    expect(screen.getByText('Planned session')).toBeTruthy();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('opens the planned-session sheet from an upcoming This week row', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z')); // Monday
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'mon-session',
          type: 'EASY',
          date: '2026-04-06',
          distance: 8,
          pace: '5:20',
        },
        {
          id: 'tue-session',
          type: 'INTERVAL',
          date: '2026-04-07',
          reps: 6,
          repDist: 400,
          pace: '3:55',
          recovery: '90s',
        },
        null,
        null,
        null,
        null,
        null,
      ],
      plannedKm: 14.4,
    };

    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([]);

    render(<HomeScreen />);

    fireEvent.click(screen.getAllByTestId('compact-day-row-pressable')[1]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('PLANNED')).toBeTruthy();
    expect(screen.getByText('Intervals')).toBeTruthy();
    expect(screen.queryByText('Planned: 6×400m · 2.4km')).toBeNull();
    expect(screen.getByText('Planned session')).toBeTruthy();
    expect(screen.queryByText('Log session')).toBeNull();
    expect(screen.queryByText('Mark skipped')).toBeNull();
  });

  it('opens skipped rows and can clear the skipped status from the sheet', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-09T12:00:00Z')); // Thursday
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'mon-session',
          type: 'EASY',
          date: '2026-04-06',
          distance: 8,
          pace: '5:20',
          skipped: {
            reason: 'busy' as const,
            markedAt: '2026-04-06T12:00:00.000Z',
          },
        },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      plannedKm: 8,
    };

    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([]);

    render(<HomeScreen />);

    fireEvent.click(screen.getByTestId('compact-day-row-pressable'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('SKIPPED')).toBeTruthy();
    expect(screen.getByText('Marked skipped: Busy')).toBeTruthy();
    expect(screen.getByText('Log session instead')).toBeTruthy();

    fireEvent.click(screen.getByTestId('resolve-session-edit-skipped'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Edit skipped status',
      'Change the reason or restore this run to planned.',
      expect.any(Array),
    );

    const buttons = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2] as Array<{ text: string; onPress?: () => void }>;
    const clearButton = buttons.find((button) => button.text === 'Not skipped');
    if (!clearButton?.onPress) {
      throw new Error('Expected a Not skipped action');
    }

    await act(async () => {
      clearButton.onPress?.();
      await Promise.resolve();
    });

    const updateInput = mockPlanUpdateWeeks.mock.calls[0]?.[0];
    expect(updateInput.weeks[0].sessions[0].skipped).toBeUndefined();
    expect(mockPlan.refresh).toHaveBeenCalled();
  });

  it('hides the finished-run CTA for a skipped today session while keeping the hero inspectable', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-06T12:00:00Z')); // Monday
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'today-session',
          type: 'EASY',
          date: '2026-04-06',
          distance: 8,
          pace: '5:20',
          skipped: {
            reason: 'tired' as const,
            markedAt: '2026-04-06T12:00:00.000Z',
          },
        },
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      plannedKm: 8,
    };

    mockAuth.isLoading = false;
    mockAuth.session = { user: { id: '1' } };
    mockPlan.loading = false;
    mockPlan.plan = {
      id: 'p1',
      weeks: [week],
      phases: {},
      raceDate: '2026-07-15',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([]);

    render(<HomeScreen />);

    expect(screen.queryByText('✓  I just finished this run')).toBeNull();
    fireEvent.click(screen.getByTestId('hero-card'));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('SKIPPED')).toBeTruthy();
    expect(screen.getByText('Marked skipped: Tired')).toBeTruthy();
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
    const today = currentLocalIsoDate();
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
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-1',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        splits: [],
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

  it('uses resolved matched activity data for post-save completed state before actualActivityId refreshes', async () => {
    const today = currentLocalIsoDate();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
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
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-1',
        distance: 12.4,
        avgPace: 350,
        duration: 4340,
        avgHR: 146,
        splits: [],
      },
    ]);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-completed')).toBeTruthy();
    });
    expect(screen.queryByText('I just finished this run')).toBeNull();
    expect(screen.getByTestId('hero-review-run')).toBeTruthy();
    expect(screen.getByText('Longer than planned')).toBeTruthy();
    expect(screen.queryByText('Bonus effort')).toBeNull();
  });

  it('opens the saved sync-run detail from the Review run CTA', async () => {
    const today = currentLocalIsoDate();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
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
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-1',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        splits: [],
      },
    ]);

    render(<HomeScreen />);

    fireEvent.click(await screen.findByTestId('hero-review-run'));
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
  });

  it('keeps the Review run CTA when the session is linked before activity details resolve', async () => {
    const today = currentLocalIsoDate();
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
    mockActivityList.mockResolvedValue([]);
    mockActivityGet.mockResolvedValue({
      id: 'activity-1',
      userId: '1',
      source: 'strava',
      externalId: 'strava-1',
      startTime: `${today}T07:15:00.000Z`,
      distance: 8.1,
      avgPace: 319,
      duration: 2580,
      splits: [],
      matchedSessionId: 'session-1',
    });

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-completed')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('hero-review-run'));
    await waitFor(() => {
      expect(mockActivityGet).toHaveBeenCalledWith({ activityId: 'activity-1' });
      expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
    });
  });

  it('does not route to a dead linked run from the home hero', async () => {
    const today = currentLocalIsoDate();
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
    mockActivityList.mockResolvedValue([]);
    mockActivityGet.mockResolvedValue(null);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-completed')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('hero-review-run'));

    await waitFor(() => {
      expect(mockActivityGet).toHaveBeenCalledWith({ activityId: 'activity-1' });
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Run unavailable',
      'This linked run is no longer available. Pull to refresh if it was just synced.',
    );
  });

  it('renders a niggle banner when the resolved activity carries niggles', async () => {
    const today = currentLocalIsoDate();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
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
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-1',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        splits: [],
        niggles: [
          {
            id: 'niggle-1',
            userId: '1',
            activityId: 'activity-1',
            bodyPart: 'hamstring',
            side: 'left',
            severity: 'mild',
            when: ['during'],
            createdAt: '2026-04-15T08:00:00.000Z',
          },
        ],
      },
    ]);

    render(<HomeScreen />);

    expect(await screen.findByText(/You flagged/i)).toBeTruthy();
    expect(screen.getByText(/Left Hamstring · Mild · During/i)).toBeTruthy();
  });

  it('renders custom Other niggle text in the banner summary', async () => {
    const today = currentLocalIsoDate();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-1',
      type: 'EASY',
      date: today,
      distance: 8,
      pace: '5:20',
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
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-1',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        splits: [],
        niggles: [
          {
            id: 'niggle-1',
            userId: '1',
            activityId: 'activity-1',
            bodyPart: 'other',
            bodyPartOtherText: 'Upper calf',
            side: 'left',
            severity: 'mild',
            when: ['during'],
            createdAt: '2026-04-15T08:00:00.000Z',
          },
        ],
      },
    ]);

    render(<HomeScreen />);

    expect(await screen.findByText(/You flagged/i)).toBeTruthy();
    expect(screen.getByText(/Left Upper calf · Mild · During/i)).toBeTruthy();
  });

  it('opens the sync-run detail screen from the completed today hero', async () => {
    const today = currentLocalIsoDate();
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[slotIndexForIsoDate(today)] = {
      id: 'session-hero',
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
      todayAnnotation: 'Nice work.',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([
      {
        id: 'activity-1',
        source: 'strava',
        startTime: `${today}T07:15:00.000Z`,
        matchedSessionId: 'session-hero',
        distance: 8.1,
        avgPace: 319,
        duration: 2580,
        splits: [],
      },
    ]);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('hero-completed')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('hero-completed'));
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/activity-1');
  });

  it('opens the sync-run detail screen from a completed This week row', async () => {
    const today = currentLocalIsoDate();
    const todayIndex = slotIndexForIsoDate(today);
    const weekStart = new Date(`${today}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - todayIndex);
    const isoForWeekIndex = (index: number) => {
      const value = new Date(weekStart);
      value.setUTCDate(value.getUTCDate() + index);
      return value.toISOString().slice(0, 10);
    };
    const completedIndex = todayIndex === 0 ? 1 : 0;
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[todayIndex] = {
      id: 'today-session',
      type: 'TEMPO',
      date: isoForWeekIndex(todayIndex),
      distance: 10,
      pace: '4:20',
    };
    sessions[completedIndex] = {
      id: 'completed-session',
      type: 'EASY',
      date: isoForWeekIndex(completedIndex),
      distance: 8,
      pace: '5:20',
      actualActivityId: 'act-1',
    };
    const week = {
      weekNumber: 3,
      phase: 'BUILD' as const,
      sessions,
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
      todayAnnotation: 'Keep the first half controlled.',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([
      {
        id: 'act-1',
        userId: '1',
        source: 'strava',
        externalId: 'strava-1',
        startTime: `${isoForWeekIndex(completedIndex)}T07:00:00.000Z`,
        distance: 8.2,
        duration: 2620,
        avgPace: 320,
        splits: [],
        matchedSessionId: 'completed-session',
      },
    ]);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByText('8.2k')).toBeTruthy();
    });
    const completedRow = screen
      .getAllByTestId('compact-day-row-pressable')
      .find((row) => within(row).queryByText('8.2k'));
    if (!completedRow) {
      throw new Error('Expected completed week row to be pressable');
    }

    fireEvent.click(completedRow);
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/act-1');
  });

  it('keeps matched off-target week rows visually completed while still opening the sync-run detail screen', async () => {
    const today = currentLocalIsoDate();
    const todayIndex = slotIndexForIsoDate(today);
    const weekStart = new Date(`${today}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - todayIndex);
    const isoForWeekIndex = (index: number) => {
      const value = new Date(weekStart);
      value.setUTCDate(value.getUTCDate() + index);
      return value.toISOString().slice(0, 10);
    };
    const completedIndex = todayIndex === 0 ? 1 : 0;
    const sessions = [null, null, null, null, null, null, null] as any[];
    sessions[todayIndex] = {
      id: 'today-session',
      type: 'TEMPO',
      date: isoForWeekIndex(todayIndex),
      distance: 10,
      pace: '4:20',
    };
    sessions[completedIndex] = {
      id: 'completed-off-target-session',
      type: 'EASY',
      date: isoForWeekIndex(completedIndex),
      distance: 8,
      pace: '5:30',
      actualActivityId: 'act-off-target',
    };
    const week = {
      weekNumber: 3,
      phase: 'BUILD' as const,
      sessions,
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
      todayAnnotation: 'Keep the first half controlled.',
      coachAnnotation: null,
    };
    mockPlan.currentWeek = week;
    mockActivityList.mockResolvedValue([
      {
        id: 'act-off-target',
        userId: '1',
        source: 'strava',
        externalId: 'strava-off-target-1',
        startTime: `${isoForWeekIndex(completedIndex)}T07:00:00.000Z`,
        distance: 8.4,
        duration: 3000,
        avgPace: 355,
        splits: [],
        matchedSessionId: 'completed-off-target-session',
      },
    ]);

    render(<HomeScreen />);

    await waitFor(() => {
      expect(screen.getByTestId('day-row-off-target')).toBeTruthy();
    });
    expect(screen.queryByTestId('day-row-warning')).toBeNull();

    const offTargetRow = screen
      .getAllByTestId('compact-day-row-pressable')
      .find((row) => within(row).queryByText('8.4k'));
    if (!offTargetRow) {
      throw new Error('Expected off-target week row to be pressable');
    }

    fireEvent.click(offTargetRow);
    expect(mockRouterPush).toHaveBeenCalledWith('/sync-run/act-off-target');
  });

  it('does not show a subjective prompt for a matched run without saved feel', () => {
    const today = currentLocalIsoDate();
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
