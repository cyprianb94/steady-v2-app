import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockRouterPush,
} = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
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

vi.mock('../providers/preferences-context', () => ({
  usePreferences: () => ({ units: 'metric' }),
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
        query: vi.fn().mockResolvedValue([]),
      },
    },
    plan: {
      updateWeeks: { mutate: vi.fn() },
    },
  },
}));

vi.mock('../components/block/RearrangeSheet', () => ({
  RearrangeSheet: () => null,
}));

vi.mock('../components/plan-builder/PropagateModal', () => ({
  PropagateModal: () => null,
}));

vi.mock('../components/plan-builder/SessionEditor', () => ({
  SessionEditor: () => null,
}));

import BlockTab from '../app/(tabs)/block';

describe('BlockTab', () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
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
});
