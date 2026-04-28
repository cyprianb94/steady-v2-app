import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deriveTrainingPaceProfile } from '@steady/types';

const mockPlan = vi.hoisted(() => ({
  plan: null as any,
  loading: false,
  currentWeekIndex: 0,
  refresh: vi.fn(),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: () => mockPlan,
}));

const mockPlanApi = vi.hoisted(() => ({
  getTrainingPaceProfile: vi.fn(),
  saveTrainingPaceProfile: vi.fn(),
}));

vi.mock('../lib/plan-api', () => ({
  getTrainingPaceProfile: mockPlanApi.getTrainingPaceProfile,
  saveTrainingPaceProfile: mockPlanApi.saveTrainingPaceProfile,
}));

import TrainingPacesScreen from '../app/settings/training-paces';

function activePlan() {
  return {
    id: 'plan-1',
    userId: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    raceName: 'London Marathon',
    raceDate: '2026-10-04',
    raceDistance: 'Marathon',
    targetTime: 'sub-3:15',
    phases: { BASE: 1, BUILD: 2, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: [],
    weeks: [
      { weekNumber: 1, phase: 'BASE', sessions: [], plannedKm: 40 },
    ],
    activeInjury: null,
  };
}

describe('TrainingPacesScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPlan.plan = activePlan();
    mockPlan.loading = false;
    mockPlan.refresh = vi.fn().mockResolvedValue(undefined);
    mockPlanApi.getTrainingPaceProfile.mockResolvedValue(null);
    mockPlanApi.saveTrainingPaceProfile.mockImplementation(async (profile) => profile);
  });

  it('derives editable profile estimates from the active plan and keeps race pace locked', async () => {
    render(<TrainingPacesScreen />);

    expect(await screen.findByText('Training paces')).toBeTruthy();
    expect(screen.getByTestId('training-paces-keyboard-frame')).toBeTruthy();
    expect(screen.getByText('These are estimates only. Change them if recent training gives you a better number.')).toBeTruthy();
    expect(screen.getByText('4:37/km')).toBeTruthy();
    expect(screen.getByText('Locked from your target.')).toBeTruthy();
    expect(screen.getAllByText('Estimated').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('pace-profile-input-marathon-min')).toBeNull();
  });

  it('saves edited ranges through the plan profile API and refreshes the active plan', async () => {
    const storedProfile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    mockPlanApi.getTrainingPaceProfile.mockResolvedValue(storedProfile);

    render(<TrainingPacesScreen />);

    await screen.findByText('Training paces');
    fireEvent.click(screen.getByTestId('pace-profile-row-threshold'));
    fireEvent.change(screen.getByTestId('pace-profile-input-threshold-min'), {
      target: { value: '4:10' },
    });
    const thresholdMaxInput = screen.getByTestId('pace-profile-input-threshold-max');
    fireEvent.change(thresholdMaxInput, {
      target: { value: '4:20' },
    });
    fireEvent.blur(thresholdMaxInput);
    expect(screen.queryByText('Apply range')).toBeNull();
    fireEvent.click(screen.getByText('Save paces'));

    await waitFor(() => {
      expect(mockPlanApi.saveTrainingPaceProfile).toHaveBeenCalledTimes(1);
    });

    expect(mockPlanApi.saveTrainingPaceProfile.mock.calls[0][0]).toMatchObject({
      bands: {
        threshold: {
          paceRange: { min: '4:10', max: '4:20' },
        },
      },
    });
    expect(mockPlan.refresh).toHaveBeenCalledTimes(1);
  });

  it('resets edited ranges to the target estimate before saving', async () => {
    const estimatedProfile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    const storedProfile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    storedProfile.bands.threshold.paceRange = { min: '4:10', max: '4:20' };
    mockPlanApi.getTrainingPaceProfile.mockResolvedValue(storedProfile);

    render(<TrainingPacesScreen />);

    await screen.findByText('Training paces');
    fireEvent.click(screen.getByTestId('pace-profile-row-threshold'));
    fireEvent.click(screen.getByTestId('pace-profile-reset-threshold'));
    fireEvent.click(screen.getByText('Save paces'));

    await waitFor(() => {
      expect(mockPlanApi.saveTrainingPaceProfile).toHaveBeenCalledTimes(1);
    });

    expect(mockPlanApi.saveTrainingPaceProfile.mock.calls[0][0]).toMatchObject({
      bands: {
        threshold: {
          paceRange: estimatedProfile.bands.threshold.paceRange,
        },
      },
    });
  });
});
