import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppleHealthSyncProvider } from '../providers/AppleHealthSyncProvider';
import { useAppleHealthSync } from '../hooks/useAppleHealthSync';

const mockAuth = {
  session: { user: { id: 'runner-1' } },
};

const mockShowToast = vi.hoisted(() => vi.fn());
const mockHealthKit = vi.hoisted(() => ({
  isAppleHealthSupported: vi.fn(),
  requestAppleHealthAuthorization: vi.fn(),
  readAppleHealthRuns: vi.fn(),
}));
const mockTrpc = vi.hoisted(() => ({
  appleHealth: {
    status: {
      query: vi.fn(),
    },
    connect: {
      mutate: vi.fn(),
    },
    sync: {
      mutate: vi.fn(),
    },
    disconnect: {
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

vi.mock('../features/apple-health/apple-health-client', () => mockHealthKit);

function wrapper({ children }: React.PropsWithChildren) {
  return <AppleHealthSyncProvider>{children}</AppleHealthSyncProvider>;
}

describe('AppleHealthSyncProvider', () => {
  beforeEach(() => {
    mockAuth.session = { user: { id: 'runner-1' } };
    mockShowToast.mockReset();
    mockHealthKit.isAppleHealthSupported.mockReset();
    mockHealthKit.isAppleHealthSupported.mockResolvedValue(true);
    mockHealthKit.requestAppleHealthAuthorization.mockReset();
    mockHealthKit.requestAppleHealthAuthorization.mockResolvedValue(true);
    mockHealthKit.readAppleHealthRuns.mockReset();
    mockHealthKit.readAppleHealthRuns.mockResolvedValue([
      {
        source: 'apple_health',
        externalId: 'apple-workout-1',
        startTime: '2026-05-29T07:00:00.000Z',
        runSubtype: 'outdoor',
        distanceKm: 6.2,
        durationSeconds: 1800,
        splits: [],
        dataQuality: { routeRetained: false },
      },
    ]);
    mockTrpc.appleHealth.status.query.mockReset();
    mockTrpc.appleHealth.connect.mutate.mockReset();
    mockTrpc.appleHealth.sync.mutate.mockReset();
    mockTrpc.appleHealth.disconnect.mutate.mockReset();
  });

  it('requests permission, marks Apple Health connected, and sends normalized runs to the server', async () => {
    mockTrpc.appleHealth.status.query
      .mockResolvedValueOnce({ connected: false, primaryRunSource: null, lastSyncedAt: null })
      .mockResolvedValueOnce({ connected: true, primaryRunSource: 'apple_watch', lastSyncedAt: null })
      .mockResolvedValueOnce({
        connected: true,
        primaryRunSource: 'apple_watch',
        lastSyncedAt: '2026-05-30T07:30:00.000Z',
      });
    mockTrpc.appleHealth.connect.mutate.mockResolvedValue({ success: true });
    mockTrpc.appleHealth.sync.mutate.mockResolvedValue({
      fetched: 1,
      imported: 1,
      skipped: 0,
      upgraded: 0,
      matched: 0,
      errors: 0,
      matchedSessions: [],
      lastSuccessfulSyncAt: '2026-05-30T07:30:00.000Z',
    });

    const { result } = renderHook(() => useAppleHealthSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.status?.connected).toBe(false);
    });

    let syncResult: Awaited<ReturnType<typeof result.current.connectAndSync>> | null = null;
    await act(async () => {
      syncResult = await result.current.connectAndSync();
    });

    expect(mockHealthKit.requestAppleHealthAuthorization).toHaveBeenCalledTimes(1);
    expect(mockTrpc.appleHealth.connect.mutate).toHaveBeenCalledTimes(1);
    expect(mockTrpc.appleHealth.sync.mutate).toHaveBeenCalledWith({
      activities: expect.arrayContaining([
        expect.objectContaining({
          source: 'apple_health',
          externalId: 'apple-workout-1',
        }),
      ]),
    });
    expect(syncResult).toMatchObject({ fetched: 1, imported: 1 });
    expect(result.current.lastResult).toMatchObject({ fetched: 1, imported: 1 });
    expect(mockShowToast).toHaveBeenCalledWith('Synced 1 Apple Watch run.', 'success');
  });

  it('does not connect the server when Health permission is denied', async () => {
    mockTrpc.appleHealth.status.query.mockResolvedValue({ connected: false, primaryRunSource: null, lastSyncedAt: null });
    mockHealthKit.requestAppleHealthAuthorization.mockResolvedValue(false);

    const { result } = renderHook(() => useAppleHealthSync(), { wrapper });

    await waitFor(() => {
      expect(result.current.status?.connected).toBe(false);
    });

    await expect(result.current.connectAndSync()).rejects.toThrow('Apple Health permission was not granted.');
    expect(mockTrpc.appleHealth.connect.mutate).not.toHaveBeenCalled();
    expect(mockTrpc.appleHealth.sync.mutate).not.toHaveBeenCalled();
  });
});
