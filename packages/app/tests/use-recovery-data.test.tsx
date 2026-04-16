import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetForWeek,
  mockGetForDateRange,
} = vi.hoisted(() => ({
  mockGetForWeek: vi.fn(),
  mockGetForDateRange: vi.fn(),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    crossTraining: {
      getForWeek: {
        query: mockGetForWeek,
      },
      getForDateRange: {
        query: mockGetForDateRange,
      },
    },
  },
}));

import { useRecoveryData } from '../features/recovery/use-recovery-data';

describe('useRecoveryData', () => {
  beforeEach(() => {
    mockGetForWeek.mockReset();
    mockGetForWeek.mockResolvedValue([]);
    mockGetForDateRange.mockReset();
    mockGetForDateRange.mockResolvedValue([]);
  });

  it('derives the active injury and fetches weekly cross-training entries', async () => {
    mockGetForWeek.mockResolvedValue([
      {
        id: 'entry-1',
        date: '2026-04-15',
        type: 'Bike',
        durationMinutes: 45,
      },
    ]);

    const { result } = renderHook(() =>
      useRecoveryData({
        plan: {
          id: 'plan-1',
          weeks: [],
          phases: {},
          raceDate: '2026-08-02',
          raceDistance: 'Marathon',
          raceName: 'London',
          targetTime: 'sub-3:15',
          coachAnnotation: null,
          activeInjury: {
            name: 'Calf strain',
            markedDate: '2026-04-10',
            rtrStep: 1,
            rtrStepCompletedDates: [],
            status: 'returning',
          },
        } as any,
        enabled: true,
        isFocused: true,
        scope: { type: 'week', weekStartDate: '2026-04-13' },
        fetchErrorMessage: 'weekly recovery fetch failed',
      }),
    );

    await waitFor(() => {
      expect(mockGetForWeek).toHaveBeenCalledWith({ weekStartDate: '2026-04-13' });
    });

    await waitFor(() => {
      expect(result.current.activeInjury?.name).toBe('Calf strain');
      expect(result.current.entries).toHaveLength(1);
    });
  });

  it('switches to range queries for block-level injury views', async () => {
    renderHook(() =>
      useRecoveryData({
        plan: {
          id: 'plan-1',
          weeks: [],
          phases: {},
          raceDate: '2026-08-02',
          raceDistance: 'Marathon',
          raceName: 'London',
          targetTime: 'sub-3:15',
          coachAnnotation: null,
          activeInjury: {
            name: 'Calf strain',
            markedDate: '2026-04-10',
            rtrStep: 1,
            rtrStepCompletedDates: [],
            status: 'returning',
          },
        } as any,
        enabled: true,
        isFocused: true,
        scope: { type: 'range', startDate: '2026-04-13', endDate: '2026-05-03' },
        fetchErrorMessage: 'block recovery fetch failed',
      }),
    );

    await waitFor(() => {
      expect(mockGetForDateRange).toHaveBeenCalledWith({
        startDate: '2026-04-13',
        endDate: '2026-05-03',
      });
    });
  });

  it('clears entries when recovery is inactive', async () => {
    const { result } = renderHook(() =>
      useRecoveryData({
        plan: {
          id: 'plan-1',
          weeks: [],
          phases: {},
          raceDate: '2026-08-02',
          raceDistance: 'Marathon',
          raceName: 'London',
          targetTime: 'sub-3:15',
          coachAnnotation: null,
          activeInjury: {
            name: 'Calf strain',
            markedDate: '2026-04-10',
            rtrStep: 1,
            rtrStepCompletedDates: [],
            status: 'resolved',
          },
        } as any,
        enabled: true,
        isFocused: true,
        scope: { type: 'week', weekStartDate: '2026-04-13' },
        fetchErrorMessage: 'weekly recovery fetch failed',
      }),
    );

    expect(result.current.activeInjury).toBeNull();
    expect(result.current.entries).toEqual([]);
    expect(mockGetForWeek).not.toHaveBeenCalled();
  });
});
