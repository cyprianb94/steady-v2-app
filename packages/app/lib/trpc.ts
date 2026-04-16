import { createTRPCClient, httpBatchLink } from '@trpc/client';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import type { AppRouter } from '@steady/server/contracts';
import { getAccessToken } from './auth-session';

type ExpoConstantsShape = {
  expoConfig?: {
    hostUri?: string;
    extra?: {
      apiUrl?: string | null;
    };
  };
  manifest?: {
    debuggerHost?: string;
    extra?: {
      apiUrl?: string | null;
    };
  };
  manifest2?: {
    extra?: {
      apiUrl?: string | null;
      expoGo?: {
        debuggerHost?: string;
      };
      expoClient?: {
        extra?: {
          apiUrl?: string | null;
        };
      };
    };
  };
};

function parseHostname(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    try {
      return new URL(`http://${value}`).hostname;
    } catch {
      return null;
    }
  }
}

function getDevApiHost(): string | null {
  const candidates = [
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Linking.createURL('/'),
  ];

  for (const candidate of candidates) {
    const hostname = parseHostname(candidate);
    if (hostname) {
      return hostname;
    }
  }

  return null;
}

function getRuntimeConfiguredApiUrl(): string | null {
  const envValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envValue) {
    return envValue;
  }

  const candidates = [
    Constants.expoConfig?.extra?.apiUrl,
    Constants.manifest2?.extra?.apiUrl,
    Constants.manifest2?.extra?.expoClient?.extra?.apiUrl,
    Constants.manifest?.extra?.apiUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function validateReleaseApiUrl(baseUrl: string): string {
  try {
    const parsed = new URL(baseUrl);
    if (!__DEV__ && parsed.protocol !== 'https:') {
      throw new Error(
        'EXPO_PUBLIC_API_URL must use HTTPS in release builds. Plain HTTP will fail on device.',
      );
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Invalid EXPO_PUBLIC_API_URL: ${baseUrl}`);
  }

  return normalizeBaseUrl(baseUrl);
}

const getBaseUrl = () => {
  const configuredBaseUrl = getRuntimeConfiguredApiUrl();
  if (configuredBaseUrl) {
    return validateReleaseApiUrl(configuredBaseUrl);
  }

  if (!__DEV__) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Release builds need a public HTTPS API URL.',
    );
  }

  // In dev, prefer the Metro host so physical devices can reach the server.
  const devHost = getDevApiHost();
  if (devHost) {
    return `http://${devHost}:3000`;
  }
  return 'http://localhost:3000';
};

function createTrpcFetch(baseUrl: string): typeof fetch {
  return async (input, init) => {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (error instanceof Error && error.message === 'Network request failed') {
        throw new Error(
          `Network request failed while calling ${baseUrl}. Check EXPO_PUBLIC_API_URL or that the local API server is reachable.`,
        );
      }
      throw error;
    }
  };
}

function createAppTrpcClient() {
  const baseUrl = getBaseUrl();
  const trpcBaseUrl = `${baseUrl}/trpc`;

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcBaseUrl,
        fetch: createTrpcFetch(baseUrl),
        headers: async () => {
          const accessToken = getAccessToken();
          if (!accessToken) return {};

          return {
            authorization: `Bearer ${accessToken}`,
          };
        },
      }),
    ],
  });
}

type AppTrpcClient = ReturnType<typeof createAppTrpcClient>;

let client: AppTrpcClient | null = null;

function getTrpcClient(): AppTrpcClient {
  if (client) {
    return client;
  }

  client = createAppTrpcClient();
  return client;
}

// Keep the screen-facing import stable while deferring Expo/env setup
// until the first real tRPC call.
export const trpc = new Proxy({} as AppTrpcClient, {
  get(_target, property) {
    return Reflect.get(getTrpcClient(), property);
  },
});
