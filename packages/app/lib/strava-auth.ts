import * as Linking from 'expo-linking';

export const STRAVA_CALLBACK_PATH = 'strava-callback';
const LOCAL_STRAVA_CALLBACK_DOMAIN = 'localhost';

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

export function getStravaRedirectUri(): string {
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
    throw new Error(
      'Strava OAuth cannot complete in Expo Go. Use a development build and set the Strava Authorization Callback Domain to localhost.',
    );
  }

  return buildRedirectUri(scheme, callbackDomain);
}
