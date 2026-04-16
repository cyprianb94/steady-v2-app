import { act, renderHook, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUpdateInjury,
  mockMarkInjury,
  mockClearInjury,
  mockLogCrossTraining,
  mockDeleteCrossTraining,
  mockClearResumeWeekOverride,
  mockSetResumeWeekOverride,
} = vi.hoisted(() => ({
  mockUpdateInjury: vi.fn(),
  mockMarkInjury: vi.fn(),
  mockClearInjury: vi.fn(),
  mockLogCrossTraining: vi.fn(),
  mockDeleteCrossTraining: vi.fn(),
  mockClearResumeWeekOverride: vi.fn(),
  mockSetResumeWeekOverride: vi.fn(),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    plan: {
      updateInjury: { mutate: mockUpdateInjury },
      markInjury: { mutate: mockMarkInjury },
      clearInjury: { mutate: mockClearInjury },
    },
    crossTraining: {
      log: { mutate: mockLogCrossTraining },
      delete: { mutate: mockDeleteCrossTraining },
    },
  },
}));

vi.mock('../lib/resume-week', () => ({
  clearResumeWeekOverride: mockClearResumeWeekOverride,
  setResumeWeekOverride: mockSetResumeWeekOverride,
}));

import {
  advanceRecoveryStep,
  endRecovery,
  useRecoveryActionController,
} from '../features/recovery/use-recovery-action-controller';

const activeInjury = {
  name: 'Calf strain',
  markedDate: '2026-04-15',
  rtrStep: 3,
  rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19'],
  status: 'returning' as const,
};

describe('recovery action helpers', () => {
  it('advances return-to-running and refreshes the plan', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const refreshPlan = vi.fn().mockResolvedValue(undefined);

    await advanceRecoveryStep({
      activeInjury,
      today: '2026-04-21',
      updateInjury,
      refreshPlan,
    });

    expect(updateInjury).toHaveBeenCalledWith({
      rtrStep: 4,
      rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21'],
      status: 'returning',
    });
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });

  it('persists the resume week, completes the final step, and clears injury when asked', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const clearInjury = vi.fn().mockResolvedValue(null);
    const refreshPlan = vi.fn().mockResolvedValue(undefined);

    await endRecovery({
      planId: 'plan-1',
      option: { type: 'choose', weekNumber: 8 },
      activeInjury,
      completeCurrentStep: true,
      today: '2026-04-21',
      updateInjury,
      clearInjury,
      refreshPlan,
    });

    expect(mockSetResumeWeekOverride).toHaveBeenCalledWith('plan-1', 8);
    expect(updateInjury).toHaveBeenCalledWith({
      rtrStep: 4,
      rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21'],
      status: 'returning',
    });
    expect(clearInjury).toHaveBeenCalledTimes(1);
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });

  it('clears recovery without mutating the RTR step for manual exits', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const clearInjury = vi.fn().mockResolvedValue(null);
    const refreshPlan = vi.fn().mockResolvedValue(undefined);

    await endRecovery({
      planId: 'plan-1',
      option: { type: 'current' },
      clearInjury,
      refreshPlan,
      activeInjury,
      updateInjury,
    });

    expect(mockClearResumeWeekOverride).toHaveBeenCalledWith('plan-1');
    expect(updateInjury).not.toHaveBeenCalled();
    expect(clearInjury).toHaveBeenCalledTimes(1);
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });
});

describe('useRecoveryActionController', () => {
  const refreshPlan = vi.fn();
  const refreshCrossTraining = vi.fn();

  beforeEach(() => {
    mockUpdateInjury.mockReset();
    mockUpdateInjury.mockResolvedValue(null);
    mockMarkInjury.mockReset();
    mockMarkInjury.mockResolvedValue(null);
    mockClearInjury.mockReset();
    mockClearInjury.mockResolvedValue(null);
    mockLogCrossTraining.mockReset();
    mockLogCrossTraining.mockResolvedValue(null);
    mockDeleteCrossTraining.mockReset();
    mockDeleteCrossTraining.mockResolvedValue(null);
    mockClearResumeWeekOverride.mockReset();
    mockClearResumeWeekOverride.mockResolvedValue(undefined);
    mockSetResumeWeekOverride.mockReset();
    mockSetResumeWeekOverride.mockResolvedValue(undefined);
    refreshPlan.mockReset();
    refreshPlan.mockResolvedValue(undefined);
    refreshCrossTraining.mockReset();
    refreshCrossTraining.mockResolvedValue(undefined);
    vi.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  it('reports when the runner needs to choose a resume week instead of auto-advancing the final RTR step', async () => {
    const { result } = renderHook(() =>
      useRecoveryActionController({
        planId: 'plan-1',
        activeInjury,
        today: '2026-04-21',
        refreshPlan,
      }),
    );

    await act(async () => {
      await expect(result.current.advanceReturnToRun()).resolves.toBe('needs-resume');
    });

    expect(mockUpdateInjury).not.toHaveBeenCalled();
  });

  it('refreshes cross-training after logging a session', async () => {
    const { result } = renderHook(() =>
      useRecoveryActionController({
        planId: 'plan-1',
        activeInjury: {
          ...activeInjury,
          rtrStep: 1,
          rtrStepCompletedDates: [],
        },
        today: '2026-04-21',
        refreshPlan,
        refreshCrossTraining,
      }),
    );

    await act(async () => {
      await expect(result.current.addCrossTraining({
        date: '2026-04-21',
        type: 'Cycling',
        durationMinutes: 45,
      })).resolves.toBe(true);
    });

    expect(mockLogCrossTraining).toHaveBeenCalledWith({
      date: '2026-04-21',
      type: 'Cycling',
      durationMinutes: 45,
    });
    expect(refreshCrossTraining).toHaveBeenCalledTimes(1);
  });

  it('persists the resume week, completes the current step, and clears the injury', async () => {
    const { result } = renderHook(() =>
      useRecoveryActionController({
        planId: 'plan-1',
        activeInjury,
        today: '2026-04-21',
        refreshPlan,
      }),
    );

    await act(async () => {
      await expect(result.current.endRecovery({
        option: { type: 'choose', weekNumber: 8 },
        completeCurrentStep: true,
      })).resolves.toBe(true);
    });

    expect(mockSetResumeWeekOverride).toHaveBeenCalledWith('plan-1', 8);
    expect(mockUpdateInjury).toHaveBeenCalledWith({
      rtrStep: 4,
      rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21'],
      status: 'returning',
    });
    expect(mockClearInjury).toHaveBeenCalledTimes(1);
    expect(refreshPlan).toHaveBeenCalledTimes(1);
  });
});
