import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockClearResumeWeekOverride,
  mockSetResumeWeekOverride,
} = vi.hoisted(() => ({
  mockClearResumeWeekOverride: vi.fn(),
  mockSetResumeWeekOverride: vi.fn(),
}));

vi.mock('../lib/resume-week', () => ({
  clearResumeWeekOverride: mockClearResumeWeekOverride,
  setResumeWeekOverride: mockSetResumeWeekOverride,
}));

import { advanceRecoveryStep, endRecovery } from '../app/(tabs)/recovery-actions';

describe('recovery-actions', () => {
  const activeInjury = {
    name: 'Calf strain',
    markedDate: '2026-04-15',
    rtrStep: 3,
    rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19'],
    status: 'returning' as const,
  };

  beforeEach(() => {
    mockClearResumeWeekOverride.mockReset();
    mockClearResumeWeekOverride.mockResolvedValue(undefined);
    mockSetResumeWeekOverride.mockReset();
    mockSetResumeWeekOverride.mockResolvedValue(undefined);
  });

  it('advances return-to-running and refreshes the plan', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const refresh = vi.fn().mockResolvedValue(undefined);

    await advanceRecoveryStep({
      activeInjury,
      today: '2026-04-21',
      updateInjury,
      refresh,
    });

    expect(updateInjury).toHaveBeenCalledWith({
      rtrStep: 4,
      rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21'],
      status: 'returning',
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('persists the resume week, completes the final step, and clears injury when asked', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const clearInjury = vi.fn().mockResolvedValue(null);
    const refresh = vi.fn().mockResolvedValue(undefined);

    await endRecovery({
      planId: 'plan-1',
      option: { type: 'choose', weekNumber: 8 },
      activeInjury,
      completeCurrentStep: true,
      today: '2026-04-21',
      updateInjury,
      clearInjury,
      refresh,
    });

    expect(mockSetResumeWeekOverride).toHaveBeenCalledWith('plan-1', 8);
    expect(updateInjury).toHaveBeenCalledWith({
      rtrStep: 4,
      rtrStepCompletedDates: ['2026-04-15', '2026-04-17', '2026-04-19', '2026-04-21'],
      status: 'returning',
    });
    expect(clearInjury).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('clears recovery without mutating the RTR step for manual exits', async () => {
    const updateInjury = vi.fn().mockResolvedValue(null);
    const clearInjury = vi.fn().mockResolvedValue(null);
    const refresh = vi.fn().mockResolvedValue(undefined);

    await endRecovery({
      planId: 'plan-1',
      option: { type: 'current' },
      clearInjury,
      refresh,
      activeInjury,
      updateInjury,
    });

    expect(mockClearResumeWeekOverride).toHaveBeenCalledWith('plan-1');
    expect(updateInjury).not.toHaveBeenCalled();
    expect(clearInjury).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
