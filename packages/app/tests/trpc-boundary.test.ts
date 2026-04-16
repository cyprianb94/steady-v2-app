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
