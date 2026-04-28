import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import { getStravaOAuthRedirects } from '../../lib/strava-auth';
import { trpc } from '../../lib/trpc';

const STRAVA_WEB_AUTHORIZE_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_MOBILE_AUTHORIZE_URL = 'https://www.strava.com/oauth/mobile/authorize';

interface ConnectStravaOptions {
  refreshStatus: () => Promise<unknown>;
  forceSync: () => Promise<unknown>;
  refreshPlan: () => Promise<unknown>;
}

export function getStravaAuthorizeUrl(authSessionCallbackUri: string) {
  try {
    return new URL(authSessionCallbackUri).protocol === 'exp:'
      ? STRAVA_WEB_AUTHORIZE_URL
      : STRAVA_MOBILE_AUTHORIZE_URL;
  } catch {
    return authSessionCallbackUri.startsWith('exp://')
      ? STRAVA_WEB_AUTHORIZE_URL
      : STRAVA_MOBILE_AUTHORIZE_URL;
  }
}

export async function connectStravaAndRefresh({
  refreshStatus,
  forceSync,
  refreshPlan,
}: ConnectStravaOptions): Promise<boolean> {
  const config = await trpc.strava.config.query();
  if (!config.clientId) {
    throw new Error('STRAVA_CLIENT_ID is not configured on the server');
  }

  const {
    authorizationRedirectUri,
    authSessionCallbackUri,
  } = getStravaOAuthRedirects();
  const authorizeUrl = new URL(getStravaAuthorizeUrl(authSessionCallbackUri));
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', authorizationRedirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('approval_prompt', 'auto');
  authorizeUrl.searchParams.set('scope', 'read,activity:read_all');

  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl.toString(), authSessionCallbackUri, {
    preferEphemeralSession: true,
  });

  if (result.type !== 'success') {
    return false;
  }

  const { params, errorCode } = QueryParams.getQueryParams(result.url);
  if (errorCode) {
    throw new Error(errorCode);
  }

  const code = typeof params.code === 'string' ? params.code : null;
  if (!code) {
    throw new Error('Strava did not return an authorization code');
  }

  await trpc.strava.connect.mutate({ code });
  await refreshStatus();
  await forceSync();
  await refreshPlan();
  return true;
}
