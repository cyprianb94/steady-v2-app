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

import { useRecoveryActionController } from '../features/recovery/use-recovery-action-controller';

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
        activeInjury: {
          name: 'Calf strain',
          markedDate: '2026-04-15',
          rtrStep: 3,
          rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19'],
          status: 'returning',
        },
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
          name: 'Calf strain',
          markedDate: '2026-04-15',
          rtrStep: 1,
          rtrStepCompletedDates: [],
          status: 'returning',
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
        activeInjury: {
          name: 'Calf strain',
          markedDate: '2026-04-15',
          rtrStep: 3,
          rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19'],
          status: 'returning',
        },
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
