import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { getUserIdFromAccessToken } from '../lib/supabase-admin';

export interface Context {
  userId: string | null;
}

function getBearerToken(authorization: string | string[] | undefined): string | null {
  if (!authorization) return null;
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  const [scheme, token] = raw.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

export async function resolveUserId(
  authorization: string | string[] | undefined,
  verifyToken: (token: string) => Promise<string | null> = getUserIdFromAccessToken,
): Promise<string | null> {
  const token = getBearerToken(authorization);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Creates context for each tRPC request.
 * Extracts the bearer token and verifies it against Supabase Auth.
 */
export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
  const userId = await resolveUserId(req.headers.authorization);
  return { userId };
}
