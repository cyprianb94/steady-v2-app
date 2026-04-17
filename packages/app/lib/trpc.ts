import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { getExpoGoProjectConfig } from 'expo';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import type { AppRouter } from '@steady/server/contracts';
import { getAccessToken } from './auth-session';

type ExpoConstantsShape = {
  linkingUri?: string;
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
  expoGoConfig?: {
    debuggerHost?: string;
  } | null;
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
  const expoGoProjectConfig = getExpoGoProjectConfig();
  const candidates = [
    expoGoProjectConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.expoGoConfig?.debuggerHost,
    Constants.manifest2?.extra?.expoGo?.debuggerHost,
    Constants.manifest?.debuggerHost,
    Constants.linkingUri,
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

function isPrivateDevelopmentHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  if (
    normalizedHostname === 'localhost'
    || normalizedHostname === '127.0.0.1'
    || normalizedHostname === '0.0.0.0'
  ) {
    return true;
  }

  if (normalizedHostname.startsWith('10.')) {
    return true;
  }

  if (normalizedHostname.startsWith('192.168.')) {
    return true;
  }

  const octets = normalizedHostname.split('.');
  if (octets.length !== 4) {
    return false;
  }

  const [firstOctet, secondOctet] = octets.map(Number);
  if (!Number.isInteger(firstOctet) || !Number.isInteger(secondOctet)) {
    return false;
  }

  return firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31;
}

function getPreferredDevBaseUrl(
  configuredBaseUrl: string,
): { baseUrl: string; fallbackBaseUrl: string | null } | null {
  if (!__DEV__) return null;

  const devHost = getDevApiHost();
  if (!devHost) {
    return null;
  }

  const fallbackBaseUrl = normalizeBaseUrl(`http://${devHost}:3000`);
  if (fallbackBaseUrl === configuredBaseUrl) {
    return null;
  }

  try {
    const parsed = new URL(configuredBaseUrl);
    if (parsed.protocol !== 'http:' || !isPrivateDevelopmentHost(parsed.hostname)) {
      return null;
    }
  } catch {
    return null;
  }

  return {
    baseUrl: fallbackBaseUrl,
    fallbackBaseUrl: configuredBaseUrl,
  };
}

function isLikelyNetworkError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return (
    normalized.includes('network request failed')
    || normalized.includes('network request timed out')
    || normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('fetch failed')
    || normalized.includes('load failed')
    || normalized.includes('timed out')
    || normalized.includes('timeout')
  );
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

function getDevFallbackBaseUrl(baseUrl: string): string | null {
  if (!__DEV__) return null;

  const devHost = getDevApiHost();
  if (!devHost) {
    return null;
  }

  const fallbackBaseUrl = normalizeBaseUrl(`http://${devHost}:3000`);
  if (fallbackBaseUrl === baseUrl) {
    return null;
  }

  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== 'http:') {
      return null;
    }
  } catch {
    return null;
  }

  return fallbackBaseUrl;
}

function getBaseUrlConfig(): { baseUrl: string; fallbackBaseUrl: string | null } {
  const configuredBaseUrl = getRuntimeConfiguredApiUrl();
  if (configuredBaseUrl) {
    const baseUrl = validateReleaseApiUrl(configuredBaseUrl);
    const preferredDevBaseUrl = getPreferredDevBaseUrl(baseUrl);
    if (preferredDevBaseUrl) {
      return preferredDevBaseUrl;
    }

    return {
      baseUrl,
      fallbackBaseUrl: getDevFallbackBaseUrl(baseUrl),
    };
  }

  if (!__DEV__) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_URL. Release builds need a public HTTPS API URL.',
    );
  }

  // In dev, prefer the Metro host so physical devices can reach the server.
  const devHost = getDevApiHost();
  if (devHost) {
    return { baseUrl: `http://${devHost}:3000`, fallbackBaseUrl: null };
  }
  return { baseUrl: 'http://localhost:3000', fallbackBaseUrl: null };
}

function rewriteFetchInput(
  input: RequestInfo | URL,
  currentBaseUrl: string,
  nextBaseUrl: string,
): RequestInfo | URL {
  const currentUrl = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;

  const nextUrl = currentUrl.startsWith(currentBaseUrl)
    ? `${nextBaseUrl}${currentUrl.slice(currentBaseUrl.length)}`
    : currentUrl.replace(currentBaseUrl, nextBaseUrl);

  if (typeof input === 'string') {
    return nextUrl;
  }
  if (input instanceof URL) {
    return new URL(nextUrl);
  }
  return new Request(nextUrl, input);
}

function createTrpcFetch(baseUrl: string, fallbackBaseUrl: string | null): typeof fetch {
  return async (input, init) => {
    try {
      return await fetch(input, init);
    } catch (error) {
      if (__DEV__ && fallbackBaseUrl && isLikelyNetworkError(error)) {
        try {
          return await fetch(rewriteFetchInput(input, baseUrl, fallbackBaseUrl), init);
        } catch (retryError) {
          if (isLikelyNetworkError(retryError)) {
            throw new Error(
              `Network request failed while calling ${baseUrl}, then retrying ${fallbackBaseUrl}. Check EXPO_PUBLIC_API_URL or that the local API server is reachable.`,
            );
          }
          throw retryError;
        }
      }

      if (isLikelyNetworkError(error)) {
        throw new Error(
          `Network request failed while calling ${baseUrl}. Check EXPO_PUBLIC_API_URL or that the local API server is reachable.`,
        );
      }
      throw error;
    }
  };
}

function createAppTrpcClient() {
  const { baseUrl, fallbackBaseUrl } = getBaseUrlConfig();
  const trpcBaseUrl = `${baseUrl}/trpc`;

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: trpcBaseUrl,
        fetch: createTrpcFetch(baseUrl, fallbackBaseUrl),
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
