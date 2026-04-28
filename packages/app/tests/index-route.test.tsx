import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = {
  session: null as any,
  isLoading: false,
  signInWithGoogle: vi.fn(),
};

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

const mockPlan = {
  plan: null as any,
  loading: false,
};

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

import Index from '../app/index';

describe('first-run index route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.session = null;
    mockAuth.isLoading = false;
    mockAuth.signInWithGoogle.mockResolvedValue({ user: { id: 'user-1' } });
    mockPlan.plan = null;
    mockPlan.loading = false;
  });

  it('starts unauthenticated runners on the welcome screen, then signs in before plan builder', async () => {
    render(<Index />);

    expect(screen.getByText('Bring your own plan.')).toBeTruthy();
    expect(screen.getByText('Build the training, sync the runs, adapt and track.')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Block')).toBeTruthy();
    expect(screen.getByText('Build')).toBeTruthy();
    expect(screen.getByText('Sync')).toBeTruthy();
    expect(screen.getByText('Adapt')).toBeTruthy();

    fireEvent.click(screen.getByText('Get started'));

    expect(screen.getByText('Create your account.')).toBeTruthy();
    expect(screen.getByText(/Already have an account/)).toBeTruthy();

    fireEvent.click(screen.getByText('Continue with Google'));

    await waitFor(() => {
      expect(mockAuth.signInWithGoogle).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/onboarding/plan-builder/step-goal');
    });
  });

  it('routes signed-in runners without a plan into the plan builder', () => {
    mockAuth.session = { user: { id: 'user-1' } };

    render(<Index />);

    expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe(
      '/onboarding/plan-builder/step-goal',
    );
  });

  it('routes signed-in runners with a plan to Home', () => {
    mockAuth.session = { user: { id: 'user-1' } };
    mockPlan.plan = {
      id: 'plan-1',
      weeks: [{ weekNumber: 1, phase: 'BASE', sessions: [], plannedKm: 40 }],
    };

    render(<Index />);

    expect(screen.getByTestId('redirect').getAttribute('data-href')).toBe('/(tabs)/home');
  });
});
