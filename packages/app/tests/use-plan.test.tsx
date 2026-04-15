import { renderHook, waitFor } from '@testing-library/react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuth = vi.hoisted(() => ({
  session: { user: { id: 'user-1' } },
  isLoading: false,
}));

const mockUseIsFocused = vi.hoisted(() => vi.fn(() => false));
const mockPlanGetQuery = vi.hoisted(() => vi.fn());

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockUseIsFocused(),
}));

vi.mock('../lib/trpc', () => ({
  trpc: {
    plan: {
      get: {
        query: mockPlanGetQuery,
      },
    },
  },
}));

vi.mock('../hooks/useTodayIso', () => ({
  useTodayIso: () => '2026-04-15',
}));

function makePlan(id: string, weekNumber: number) {
  return {
    id,
    userId: 'user-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    raceName: 'Marathon 2026',
    raceDate: '2026-08-02',
    raceDistance: 'Marathon' as const,
    targetTime: 'sub-3:15',
    phases: { BASE: 1, BUILD: 0, RECOVERY: 0, PEAK: 0, TAPER: 0 },
    progressionPct: 0,
    templateWeek: [null, null, null, null, null, null, null],
    weeks: [
      {
        weekNumber,
        phase: 'BASE' as const,
        plannedKm: 40,
        sessions: [
          { id: `${id}-mon`, type: 'EASY' as const, date: '2026-04-13', distance: 8, pace: '5:20' },
          null,
          { id: `${id}-wed`, type: 'EASY' as const, date: '2026-04-15', distance: 8, pace: '5:20' },
          null,
          null,
          null,
          null,
        ],
      },
    ],
    activeInjury: null,
    coachAnnotation: 'Stay controlled.',
  };
}

describe('usePlan', () => {
  beforeEach(() => {
    mockAuth.session = { user: { id: 'user-1' } };
    mockAuth.isLoading = false;
    mockUseIsFocused.mockReset();
    mockUseIsFocused.mockReturnValue(false);
    mockPlanGetQuery.mockReset();
    vi.mocked(AsyncStorage.getItem).mockReset();
    vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('loads the plan once on initial focused mount', async () => {
    mockUseIsFocused.mockReturnValue(true);
    mockPlanGetQuery.mockResolvedValue(makePlan('plan-a', 1));
    const { usePlan } = await import('../hooks/usePlan');

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-a'));

    expect(mockPlanGetQuery).toHaveBeenCalledTimes(1);
    expect(result.current.currentWeek?.weekNumber).toBe(1);
  });

  it('refreshes the plan when the screen gains focus after the initial load', async () => {
    mockPlanGetQuery
      .mockResolvedValueOnce(makePlan('plan-a', 1))
      .mockResolvedValueOnce(makePlan('plan-b', 2));
    const { usePlan } = await import('../hooks/usePlan');

    const { result, rerender } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-a'));
    expect(mockPlanGetQuery).toHaveBeenCalledTimes(1);

    mockUseIsFocused.mockReturnValue(true);
    rerender();

    await waitFor(() => expect(result.current.plan?.id).toBe('plan-b'));
    expect(mockPlanGetQuery).toHaveBeenCalledTimes(2);
    expect(result.current.currentWeek?.weekNumber).toBe(2);
  });
});
