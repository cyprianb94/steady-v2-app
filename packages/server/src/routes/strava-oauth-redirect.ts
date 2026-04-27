import type { FastifyInstance } from 'fastify';

const RETURN_TO_PARAM = 'return_to';
const ALLOWED_RETURN_PROTOCOLS = new Set(['exp:', 'steady:', 'steady-preview:']);
const STRAVA_RESPONSE_PARAMS = ['code', 'scope', 'state', 'error'] as const;

function queryValue(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return null;
}

export function buildStravaOAuthRedirectTarget(query: Record<string, unknown>): string {
  const returnTo = queryValue(query[RETURN_TO_PARAM]);
  if (!returnTo) {
    throw new Error('Missing Strava OAuth return target.');
  }

  let target: URL;
  try {
    target = new URL(returnTo);
  } catch {
    throw new Error('Invalid Strava OAuth return target.');
  }

  if (!ALLOWED_RETURN_PROTOCOLS.has(target.protocol)) {
    throw new Error('Unsupported Strava OAuth return target.');
  }

  for (const param of STRAVA_RESPONSE_PARAMS) {
    const value = queryValue(query[param]);
    if (value) {
      target.searchParams.set(param, value);
    }
  }

  return target.toString();
}

export function registerStravaOAuthRedirectRoute(server: FastifyInstance) {
  server.get('/oauth/strava/callback', async (request, reply) => {
    try {
      const redirectTarget = buildStravaOAuthRedirectTarget(
        request.query as Record<string, unknown>,
      );
      return reply.redirect(redirectTarget, 302);
    } catch (error) {
      return reply.status(400).send({
        error: error instanceof Error ? error.message : 'Invalid Strava OAuth callback.',
      });
    }
  });
}
