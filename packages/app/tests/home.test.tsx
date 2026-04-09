import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

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

const mockSaveSubjectiveInput = vi.hoisted(() => vi.fn());
const mockDismissSubjectiveInput = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: {
    plan: {
      saveSubjectiveInput: {
        mutate: mockSaveSubjectiveInput,
      },
      dismissSubjectiveInput: {
        mutate: mockDismissSubjectiveInput,
      },
    },
  },
}));

import HomeScreen from '../app/(tabs)/home';

describe('HomeScreen', () => {
  beforeEach(() => {
    mockAuth.session = null;
    mockAuth.isLoading = true;
    mockPlan.plan = null;
    mockPlan.loading = true;
    mockPlan.currentWeek = null;
    mockPlan.refresh = vi.fn();
    mockSaveSubjectiveInput.mockReset();
    mockDismissSubjectiveInput.mockReset();
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

  it('renders the coach annotation from the plan query', () => {
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
      coachAnnotation: 'Intervals tomorrow — keep today conversational.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.getByTestId('coach-annotation')).toBeTruthy();
    expect(screen.getByText(/keep today conversational/i)).toBeTruthy();
  });

  it('saves subjective input from the completed-session prompt', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'session-1',
          type: 'EASY',
          date: today,
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
    mockPlan.refresh = vi.fn().mockResolvedValue(undefined);
    mockSaveSubjectiveInput.mockResolvedValue({});

    render(<HomeScreen />);

    expect(screen.getByTestId('subjective-input-prompt')).toBeTruthy();
    fireEvent.click(screen.getByText('Heavy'));
    fireEvent.click(screen.getByText('Controlled'));
    fireEvent.click(screen.getByText('Done'));
    fireEvent.click(screen.getByText('Save feel'));

    await waitFor(() => {
      expect(mockSaveSubjectiveInput).toHaveBeenCalledWith({
        sessionId: 'session-1',
        input: {
          legs: 'heavy',
          breathing: 'controlled',
          overall: 'done',
        },
      });
    });
    expect(mockPlan.refresh).toHaveBeenCalled();
  });

  it('dismisses the subjective input prompt without saving ratings', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'session-1',
          type: 'EASY',
          date: today,
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
    mockPlan.refresh = vi.fn().mockResolvedValue(undefined);
    mockDismissSubjectiveInput.mockResolvedValue({});

    render(<HomeScreen />);

    fireEvent.click(screen.getByText('Skip'));

    await waitFor(() => {
      expect(mockDismissSubjectiveInput).toHaveBeenCalledWith({
        sessionId: 'session-1',
      });
    });
    expect(mockSaveSubjectiveInput).not.toHaveBeenCalled();
    expect(mockPlan.refresh).toHaveBeenCalled();
  });

  it('does not show the subjective prompt after it has been dismissed', () => {
    const today = new Date().toISOString().slice(0, 10);
    const week = {
      weekNumber: 3,
      phase: 'BASE' as const,
      sessions: [
        {
          id: 'session-1',
          type: 'EASY',
          date: today,
          distance: 8,
          pace: '5:20',
          actualActivityId: 'activity-1',
          subjectiveInputDismissed: true,
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
      coachAnnotation: 'Nice work.',
    };
    mockPlan.currentWeek = week;

    render(<HomeScreen />);

    expect(screen.queryByTestId('subjective-input-prompt')).toBeNull();
  });
});
