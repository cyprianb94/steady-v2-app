import { createTRPCClient, httpBatchLink } from '@trpc/client';
import type { AppRouter } from '@steady/server/src/trpc/router';
import { getAccessToken } from './auth-session';

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
  const { default: Constants } = require('expo-constants') as {
    default: {
      expoConfig?: { hostUri?: string };
      manifest?: { debuggerHost?: string };
      manifest2?: { extra?: { expoGo?: { debuggerHost?: string } } };
    };
  };
  const Linking = require('expo-linking') as typeof import('expo-linking');

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

const getBaseUrl = () => {
  const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, '');
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

const trpcBaseUrl = `${getBaseUrl()}/trpc`;

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: trpcBaseUrl,
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
