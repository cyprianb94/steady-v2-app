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

function getLocalDevelopmentRedirectUri(): string {
  return Linking.createURL(STRAVA_CALLBACK_PATH);
}

export function getStravaRedirectUri(): string {
  const scheme = getCurrentAppScheme();
  const callbackDomain = normalizeCallbackDomain(process.env.EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN);

  if (!callbackDomain) {
    if (isLocalDevRuntime()) {
      return getLocalDevelopmentRedirectUri();
    }

    throw new Error(
      'EXPO_PUBLIC_STRAVA_CALLBACK_DOMAIN is not configured for Strava OAuth.',
    );
  }

  if (!scheme || scheme === 'exp') {
    if (isLocalDevRuntime()) {
      return getLocalDevelopmentRedirectUri();
    }

    throw new Error('Strava OAuth cannot build a release redirect URI without a native app scheme.');
  }

  return `${scheme}://${callbackDomain}/${STRAVA_CALLBACK_PATH}`;
}
