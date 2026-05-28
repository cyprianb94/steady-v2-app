import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StravaSyncProvider } from '../providers/StravaSyncProvider';
import { useStravaSync } from '../hooks/useStravaSync';

const mockAuth = {
  session: { user: { id: 'runner-1' } },
};

const mockShowToast = vi.hoisted(() => vi.fn());
const mockTrpc = vi.hoisted(() => ({
  strava: {
    status: {
      query: vi.fn(),
    },
    sync: {
      mutate: vi.fn(),
    },
  },
}));

vi.mock('../lib/auth', () => ({
  useAuth: () => mockAuth,
}));

vi.mock('../lib/trpc', () => ({
  trpc: mockTrpc,
}));

vi.mock('../providers/ToastProvider', () => ({
  useToast: () => ({
    showToast: mockShowToast,
  }),
}));

function wrapper({ children }: React.PropsWithChildren) {
  return <StravaSyncProvider>{children}</StravaSyncProvider>;
}

describe('StravaSyncProvider', () => {
  beforeEach(() => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockShowToast.mockReset();
    mockTrpc.strava.status.query.mockReset();
    mockTrpc.strava.sync.mutate.mockReset();
  });

  it('rechecks Strava status before forced sync so reconnects can sync immediately', async () => {
    mockTrpc.strava.status.query
      .mockResolvedValueOnce({ connected: false, athleteId: null, lastSyncedAt: null })
      .mockResolvedValueOnce({ connected: true, athleteId: '12345', lastSyncedAt: null })
      .mockResolvedValueOnce({
        connected: true,
        athleteId: '12345',
        lastSyncedAt: '2026-05-28T13:30:00.000Z',
      });
    mockTrpc.strava.sync.mutate.mockResolvedValue({
      new: 2,
      skipped: 0,
      matched: 0,
      matchedSessions: [],
    });

    const { result } = renderHook(() => useStravaSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.status?.connected).toBe(false);
    });

    let syncResult: Awaited<ReturnType<typeof result.current.forceSync>> | null = null;
    await act(async () => {
      syncResult = await result.current.forceSync();
    });

    expect(syncResult).toMatchObject({ new: 2 });
    expect(mockTrpc.strava.sync.mutate).toHaveBeenCalledTimes(1);
    expect(result.current.lastResult).toMatchObject({ new: 2 });
  });
});
