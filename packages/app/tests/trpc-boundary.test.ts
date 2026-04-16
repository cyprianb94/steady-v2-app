import { beforeEach, describe, expect, it, vi } from 'vitest';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

const httpBatchLinkMock = vi.fn((options) => options);
const queryMock = vi.fn();
const createTRPCClientMock = vi.fn(() => ({
  plan: {
    get: {
      query: queryMock,
    },
  },
}));

vi.mock('@trpc/client', () => ({
  createTRPCClient: createTRPCClientMock,
  httpBatchLink: httpBatchLinkMock,
}));

describe('trpc boundary', () => {
  beforeEach(() => {
    vi.resetModules();
    queryMock.mockReset();
    createTRPCClientMock.mockClear();
    httpBatchLinkMock.mockClear();

    Reflect.set(Constants, 'expoConfig', {});
    Reflect.set(Constants, 'manifest', {});
    Reflect.set(Constants, 'manifest2', {});
    vi.mocked(Linking.createURL).mockImplementation((path = '/') => {
      const normalizedPath = path.replace(/^\/+/, '');
      return normalizedPath ? `steady://${normalizedPath}` : 'steady://';
    });

    process.env.EXPO_PUBLIC_API_URL = 'https://api.steady.test';
    Reflect.set(globalThis, '__DEV__', true);
  });

  it('does not create the client while the module is imported', async () => {
    await import('../lib/trpc');

    expect(createTRPCClientMock).not.toHaveBeenCalled();
  });

  it('creates the client lazily on first use and reuses it afterwards', async () => {
    const { trpc } = await import('../lib/trpc');

    expect(createTRPCClientMock).not.toHaveBeenCalled();

    await trpc.plan.get.query();
    await trpc.plan.get.query();

    expect(createTRPCClientMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('uses apiUrl from Expo config when the env var is unavailable', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Reflect.set(Constants, 'expoConfig', {
      extra: {
        apiUrl: 'https://config.steady.test/',
      },
    });

    const { trpc } = await import('../lib/trpc');
    await trpc.plan.get.query();

    expect(httpBatchLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://config.steady.test/trpc',
      }),
    );
  });

  it('rejects insecure release API URLs before making requests', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.steady.test';
    Reflect.set(globalThis, '__DEV__', false);

    const { trpc } = await import('../lib/trpc');

    expect(() => trpc.plan).toThrow(
      'EXPO_PUBLIC_API_URL must use HTTPS in release builds. Plain HTTP will fail on device.',
    );
  });

  it('adds API context to network failures', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network request failed')) as typeof fetch;

    try {
      const { trpc } = await import('../lib/trpc');
      await trpc.plan.get.query();

      const [{ fetch: trpcFetch }] = httpBatchLinkMock.mock.calls.at(-1) ?? [];
      expect(trpcFetch).toBeTypeOf('function');
      await expect(trpcFetch('https://api.steady.test/trpc/plan.get', {})).rejects.toThrow(
        'Network request failed while calling https://api.steady.test. Check EXPO_PUBLIC_API_URL or that the local API server is reachable.',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('defers the release env check until the client is actually used', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;
    Reflect.set(globalThis, '__DEV__', false);

    const { trpc } = await import('../lib/trpc');

    expect(createTRPCClientMock).not.toHaveBeenCalled();
    expect(() => trpc.plan).toThrow(
      'Missing EXPO_PUBLIC_API_URL. Release builds need a public HTTPS API URL.',
    );
  });
});
