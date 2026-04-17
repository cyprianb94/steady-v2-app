import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getExpoGoProjectConfig } from 'expo';
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

vi.mock('expo', () => ({
  getExpoGoProjectConfig: vi.fn(() => null),
}));

describe('trpc boundary', () => {
  beforeEach(async () => {
    vi.resetModules();
    queryMock.mockReset();
    createTRPCClientMock.mockClear();
    httpBatchLinkMock.mockClear();

    Reflect.set(Constants, 'expoConfig', {});
    Reflect.set(Constants, 'manifest', {});
    Reflect.set(Constants, 'manifest2', {});
    Reflect.set(Constants, 'expoGoConfig', null);
    Reflect.set(Constants, 'platform', {});
    Reflect.set(Constants, 'linkingUri', undefined);
    Reflect.set(Constants, 'experienceUrl', undefined);
    const { NativeModules } = await import('react-native');
    NativeModules.SourceCode.scriptURL = undefined;
    vi.mocked(Linking.createURL).mockImplementation((path = '/') => {
      const normalizedPath = path.replace(/^\/+/, '');
      return normalizedPath ? `exp://127.0.0.1:8081/--/${normalizedPath}` : 'exp://127.0.0.1:8081/--/';
    });
    vi.mocked(getExpoGoProjectConfig).mockReturnValue(null);

    process.env.EXPO_PUBLIC_API_URL = 'https://api.steady.test';
    Reflect.set(globalThis, '__DEV__', true);
  });

  it('does not create the client while the module is imported', async () => {
    const { NativeModules } = await import('react-native');
    NativeModules.SourceCode.scriptURL = undefined;

    await import('../lib/trpc');

    expect(createTRPCClientMock).not.toHaveBeenCalled();
  });

  it('creates the client lazily on first use and reuses it afterwards', async () => {
    const { NativeModules } = await import('react-native');
    NativeModules.SourceCode.scriptURL = undefined;

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

  it('prefers the live Expo host over a stale private dev API URL', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.103:3000';
    Reflect.set(Constants, 'expoGoConfig', {
      debuggerHost: '10.152.149.178:8081',
    });

    const { trpc } = await import('../lib/trpc');
    await trpc.plan.get.query();

    expect(httpBatchLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://10.152.149.178:3000/trpc',
      }),
    );
  });

  it('uses the live Expo Go project config when expo-constants is stale', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.103:3000';
    vi.mocked(getExpoGoProjectConfig).mockReturnValue({
      debuggerHost: '10.152.149.178:8081',
    });

    const { trpc } = await import('../lib/trpc');
    await trpc.plan.get.query();

    expect(httpBatchLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://10.152.149.178:3000/trpc',
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
    global.fetch = vi.fn().mockRejectedValue(new Error('Network request timed out')) as typeof fetch;

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

  it('retries the live Expo host against the configured private dev URL', async () => {
    const originalFetch = global.fetch;
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.103:3000';
    Reflect.set(Constants, 'expoGoConfig', {
      debuggerHost: '10.152.149.178:8081',
    });

    global.fetch = vi.fn().mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url.startsWith('http://10.152.149.178:3000')) {
        throw new Error('Network request timed out');
      }
      return { ok: true } as Response;
    }) as typeof fetch;

    try {
      const { trpc } = await import('../lib/trpc');
      await trpc.plan.get.query();

      const [{ fetch: trpcFetch }] = httpBatchLinkMock.mock.calls.at(-1) ?? [];
      expect(trpcFetch).toBeTypeOf('function');

      await expect(trpcFetch('http://10.152.149.178:3000/trpc/plan.get', {})).resolves.toEqual(
        expect.objectContaining({ ok: true }),
      );

      expect(global.fetch).toHaveBeenNthCalledWith(1, 'http://10.152.149.178:3000/trpc/plan.get', {});
      expect(global.fetch).toHaveBeenNthCalledWith(2, 'http://192.168.1.103:3000/trpc/plan.get', {});
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

  it('prefers a non-loopback runtime bundle host over localhost metadata in dev', async () => {
    const { NativeModules } = await import('react-native');
    delete process.env.EXPO_PUBLIC_API_URL;
    Reflect.set(Constants, 'expoConfig', {
      hostUri: 'localhost:8081',
    });
    NativeModules.SourceCode.scriptURL = 'http://192.168.1.42:8081/index.bundle?platform=ios';

    const { trpc } = await import('../lib/trpc');

    await trpc.plan.get.query();

    expect(httpBatchLinkMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://192.168.1.42:3000/trpc',
      }),
    );
  });
});
