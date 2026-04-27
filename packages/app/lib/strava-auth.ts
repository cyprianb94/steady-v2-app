import Constants from 'expo-constants';
import * as Linking from 'expo-linking';

export const STRAVA_CALLBACK_PATH = 'strava-callback';
const LOCAL_STRAVA_CALLBACK_DOMAIN = 'localhost';
const STRAVA_RELAY_CALLBACK_PATH = '/oauth/strava/callback';

type ExpoConstantsShape = {
  expoConfig?: {
    extra?: {
      apiUrl?: string | null;
    };
  };
  manifest?: {
    extra?: {
      apiUrl?: string | null;
    };
  };
  manifest2?: {
    extra?: {
      apiUrl?: string | null;
      expoClient?: {
        extra?: {
          apiUrl?: string | null;
        };
      };
    };
  };
};

export interface StravaOAuthRedirects {
  authorizationRedirectUri: string;
  authSessionCallbackUri: string;
}

function normalizeCallbackDomain(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const domain = trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  return domain || null;
}

function getCurrentAppScheme(): string | null {
  try {
    const appUrl = Linking.createURL('');
    return new URL(appUrl).protocol.replace(/:$/, '') || null;
  } catch {
    return null;
  }
}

function isLocalDevRuntime(): boolean {
  return process.env.NODE_ENV !== 'production';
}

function getRuntimeCallbackPath(): string {
  try {
    const appUrl = Linking.createURL(STRAVA_CALLBACK_PATH);
    const parsed = new URL(appUrl);
    if (parsed.pathname.endsWith(`/${STRAVA_CALLBACK_PATH}`)) {
      return parsed.pathname;
    }
  } catch {
    // Fall back to the normal native path below.
  }

  return `/${STRAVA_CALLBACK_PATH}`;
}

function buildRedirectUri(scheme: string, callbackDomain: string): string {
  return `${scheme}://${callbackDomain}${getRuntimeCallbackPath()}`;
}

function getRuntimeConfiguredApiUrl(): string | null {
  const envValue = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envValue) {
    return envValue;
  }

  const expoConstants = Constants as ExpoConstantsShape;
  const candidates = [
    expoConstants.expoConfig?.extra?.apiUrl,
    expoConstants.manifest2?.extra?.apiUrl,
    expoConstants.manifest2?.extra?.expoClient?.extra?.apiUrl,
    expoConstants.manifest?.extra?.apiUrl,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function getPublicApiBaseUrl(): string {
  const apiUrl = getRuntimeConfiguredApiUrl();
  if (!apiUrl) {
    throw new Error(
      'Expo Go Strava OAuth needs EXPO_PUBLIC_API_URL set to the public Steady API URL.',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(apiUrl);
  } catch {
    throw new Error(`Invalid EXPO_PUBLIC_API_URL for Strava OAuth: ${apiUrl}`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(
      'Expo Go Strava OAuth needs EXPO_PUBLIC_API_URL to be a public HTTPS URL.',
    );
  }

  return parsed.origin;
}

function buildExpoGoRelayRedirectUri(returnTo: string): string {
  const relay = new URL(STRAVA_RELAY_CALLBACK_PATH, getPublicApiBaseUrl());
  relay.searchParams.set('return_to', returnTo);
  return relay.toString();
}

export function getStravaOAuthRedirects(): StravaOAuthRedirects {
  const scheme = getCurrentAppScheme();
  const callbackDomain = normalizeCallbackDomain(process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN)
    ?? (isLocalDevRuntime() ? LOCAL_STRAVA_CALLBACK_DOMAIN : null);

  if (!callbackDomain) {
    throw new Error(
      'EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN is not configured for Strava OAuth.',
    );
  }

  if (!scheme) {
    throw new Error('Strava OAuth cannot build a release redirect URI without a native app scheme.');
  }

  if (scheme === 'exp') {
    const authSessionCallbackUri = Linking.createURL(STRAVA_CALLBACK_PATH);
    return {
      authorizationRedirectUri: buildExpoGoRelayRedirectUri(authSessionCallbackUri),
      authSessionCallbackUri,
    };
  }

  const redirectUri = buildRedirectUri(scheme, callbackDomain);
  return {
    authorizationRedirectUri: redirectUri,
    authSessionCallbackUri: redirectUri,
  };
}

export function getStravaRedirectUri(): string {
  return getStravaOAuthRedirects().authorizationRedirectUri;
}
