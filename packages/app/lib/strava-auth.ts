import * as Linking from 'expo-linking';

export const STRAVA_CALLBACK_PATH = 'strava-callback';

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

export function getStravaRedirectUri(): string {
  const scheme = getCurrentAppScheme();

  if (!scheme || scheme === 'exp') {
    throw new Error(
      'Strava OAuth cannot run from Expo Go/LAN because Strava rejects exp:// redirect URLs. Use an Expo development build and set Strava Authorization Callback Domain to localhost.',
    );
  }

  const callbackDomain = normalizeCallbackDomain(process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN)
    ?? (isLocalDevRuntime() ? 'localhost' : null);
  if (!callbackDomain) {
    throw new Error(
      'EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN is not configured for Strava OAuth.',
    );
  }

  return `${scheme}://${callbackDomain}/${STRAVA_CALLBACK_PATH}`;
}
