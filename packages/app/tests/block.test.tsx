import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession, TrainingPlanWithAnnotation } from '@steady/types';

const {
  mockRouterPush,
  mockUseLocalSearchParams,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
  mockUseLocalSearchParams: vi.fn(() => ({})),
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
  useLocalSearchParams: mockUseLocalSearchParams,
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

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => ({ units: 'metric' }),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      get: {
        query: vi.fn().mockResolvedValue(null),
      },
      list: {
        query: vi.fn().mockResolvedValue([]),
      },
    },
    crossTraining: {
      getForDateRange: {
        query: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

vi.mock('../lib/plan-api', () => ({
  updatePlanWeeks: vi.fn(),
}));

vi.mock('../components/plan-builder/PropagateModal', () => ({
  PropagateModal: () => null,
}));

vi.mock('../components/plan-builder/SessionEditor', () => ({
  SessionEditor: () => null,
}));

import BlockTab from '../app/(tabs)/block';

function session(id: string, type: PlannedSession['type'], dayIndex: number): PlannedSession {
  return {
    id,
    type,
    date: `2026-05-${String(dayIndex + 1).padStart(2, '0')}`,
    distance: type === 'LONG' ? 16 : 8,
    pace: '5:20',
  };
}

function week(
  weekNumber: number,
  phase: TrainingPlanWithAnnotation['weeks'][number]['phase'],
  plannedKm: number,
): TrainingPlanWithAnnotation['weeks'][number] {
  return {
    weekNumber,
    phase,
    plannedKm,
    sessions: [
      session(`w${weekNumber}-easy`, 'EASY', 0),
      session(`w${weekNumber}-interval`, 'INTERVAL', 1),
      session(`w${weekNumber}-easy-2`, 'EASY', 2),
      session(`w${weekNumber}-tempo`, 'TEMPO', 3),
      null,
      session(`w${weekNumber}-easy-3`, 'EASY', 5),
      session(`w${weekNumber}-long`, 'LONG', 6),
    ],
  };
}

function plan(): TrainingPlanWithAnnotation {
  const weeks = [
    week(1, 'BASE', 42),
    week(2, 'BUILD', 48),
    week(3, 'PEAK', 56),
    week(4, 'TAPER', 30),
  ];

  return {
    id: 'plan-1',
    userId: 'runner-1',
    createdAt: '2026-04-01',
    raceName: 'Spring 10K',
    raceDate: '2026-06-01',
    raceDistance: '10K',
    targetTime: 'sub-45',
    phases: { BASE: 1, BUILD: 1, RECOVERY: 0, PEAK: 1, TAPER: 1 },
    progressionPct: 7,
    templateWeek: weeks[0].sessions,
    weeks,
    activeInjury: null,
    todayAnnotation: 'Keep the easy days easy.',
    coachAnnotation: 'Keep going.',
  };
}

describe('BlockTab', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUseLocalSearchParams.mockReset();
    mockUseLocalSearchParams.mockReturnValue({});
    mockAuth.session = null;
    mockAuth.isLoading = false;
    mockPlan.plan = null;
    mockPlan.loading = false;
    mockPlan.currentWeekIndex = 0;
    mockPlan.refresh = vi.fn().mockResolvedValue(undefined);
    mockStrava.requestAutoSync.mockReset();
    mockStrava.requestAutoSync.mockResolvedValue(null);
    mockStrava.forceSync.mockReset();
    mockStrava.forceSync.mockResolvedValue(null);
    mockStrava.syncRevision = 0;
    mockStrava.syncing = false;
  });

  it('shows the shared sign-in prompt when the runner is signed out', () => {
    render(<BlockTab />);

    expect(screen.getByText('Sign in to see your plan')).toBeTruthy();

    fireEvent.click(screen.getByText('Go to settings'));

    expect(mockRouterPush).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('offers the plan builder when the runner is signed in without a plan', () => {
    mockAuth.session = { user: { id: 'runner-1' } };

    render(<BlockTab />);

    expect(screen.getByText('No plan yet')).toBeTruthy();

    fireEvent.click(screen.getByText('Build a plan'));

    expect(mockRouterPush).toHaveBeenCalledWith('/onboarding/plan-builder/step-goal');
  });

  it('renders one continuous block view with race details, graph, phase timeline, and weeks', () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockPlan.plan = plan();
    mockPlan.currentWeekIndex = 1;

    render(<BlockTab />);

    expect(screen.getByText('GOAL RACE')).toBeTruthy();
    expect(screen.getByText('Spring 10K')).toBeTruthy();
    expect(screen.getByText('Jun 1, 2026')).toBeTruthy();
    expect(screen.getByText('3 weeks out')).toBeTruthy();
    expect(screen.getByText('sub-45')).toBeTruthy();
    expect(screen.queryByTestId('block-review-tab-structure')).toBeNull();
    expect(screen.queryByTestId('block-review-tab-weeks')).toBeNull();
    expect(screen.getByText('Weekly volume')).toBeTruthy();
    expect(screen.getByTestId('block-review-volume-current-guide')).toBeTruthy();
    expect(screen.queryByText('Current')).toBeNull();
    expect(screen.queryByTestId('block-review-phase-strip')).toBeNull();
    expect(screen.getByText('Current phase:')).toBeTruthy();
    expect(screen.getByTestId('block-week-row-1')).toBeTruthy();
    expect(screen.getByTestId('block-week-row-press-1')).toBeTruthy();
    expect(screen.queryByText('Phase structure')).toBeNull();
    expect(screen.queryByText('Progression')).toBeNull();
    expect(screen.queryByTestId('block-review-edit-structure')).toBeNull();
  });

  it('keeps the existing week expansion behavior below the graph', () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockPlan.plan = plan();
    mockPlan.currentWeekIndex = 1;

    render(<BlockTab />);
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));

    expect(screen.getByText('Weekly volume')).toBeTruthy();
    expect(screen.getByTestId('block-day-1-0')).toBeTruthy();
  });

  it('keeps pace ranges in the Block row title and moves effort cues to the caption', () => {
    mockAuth.session = { user: { id: 'runner-1' } };
    const currentPlan = plan();
    currentPlan.weeks[0].sessions[3] = {
      ...currentPlan.weeks[0].sessions[3]!,
      intensityTarget: {
        source: 'manual',
        mode: 'both',
        paceRange: { min: '4:15', max: '4:25' },
        effortCue: 'controlled hard',
      },
    };
    mockPlan.plan = currentPlan;
    mockPlan.currentWeekIndex = 0;

    render(<BlockTab />);
    fireEvent.click(screen.getByTestId('block-week-row-press-1'));

    const tempoRow = screen.getByTestId('block-day-1-3');
    expect(tempoRow.textContent).toContain('8km · 4:15-4:25');
    expect(tempoRow.textContent).toContain('Tempo · controlled hard');
    expect(tempoRow.textContent).not.toContain('4:15-4:25 · controlled hard');
  });
});
