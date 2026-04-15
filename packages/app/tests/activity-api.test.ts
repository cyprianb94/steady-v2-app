import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockActivityListQuery = vi.hoisted(() => vi.fn());
const mockGetSupabaseClient = vi.hoisted(() => vi.fn());

vi.mock('../lib/trpc', () => ({
  trpc: {
    activity: {
      list: {
        query: mockActivityListQuery,
      },
    },
  },
}));

vi.mock('../lib/supabase', () => ({
  getSupabaseClient: mockGetSupabaseClient,
}));

function makeActivityRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'activity-1',
    user_id: 'user-1',
    source: 'strava',
    external_id: 'strava-1',
    start_time: '2026-04-15T07:30:00.000Z',
    distance: 12.5,
    duration: 3600,
    elevation_gain: 120,
    avg_pace: 288,
    avg_hr: 151,
    max_hr: 170,
    splits: [],
    subjective_input: null,
    matched_session_id: 'session-1',
    shoe_id: null,
    notes: 'Felt smooth',
    ...overrides,
  };
}

describe('activity-api', () => {
  beforeEach(() => {
    vi.resetModules();
    mockActivityListQuery.mockReset();
    mockGetSupabaseClient.mockReset();
  });

  it('uses tRPC when the backend is reachable', async () => {
    const activities = [{ id: 'activity-trpc', userId: 'user-1' }];
    mockActivityListQuery.mockResolvedValue(activities);

    const { listActivities } = await import('../lib/activity-api');
    const result = await listActivities('user-1');

    expect(result).toEqual(activities);
    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('falls back to Supabase on network failure', async () => {
    mockActivityListQuery.mockRejectedValue(new Error('Network request failed'));
    const order = vi.fn().mockResolvedValue({
      data: [makeActivityRow()],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    mockGetSupabaseClient.mockReturnValue({ from });

    const { listActivities } = await import('../lib/activity-api');
    const result = await listActivities('user-1');

    expect(from).toHaveBeenCalledWith('activities');
    expect(result).toEqual([
      expect.objectContaining({
        id: 'activity-1',
        userId: 'user-1',
        distance: 12.5,
        avgPace: 288,
        matchedSessionId: 'session-1',
        notes: 'Felt smooth',
      }),
    ]);
  });
});
