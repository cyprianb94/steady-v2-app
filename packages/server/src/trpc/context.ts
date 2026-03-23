import type { FastifyRequest } from 'fastify';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';

export interface Context {
  userId: string | null;
}

/**
 * Creates context for each tRPC request.
 * Extracts user ID from the Authorization header (Supabase JWT).
 * Full JWT verification will be added with Supabase auth (Slice 7+).
 */
export function createContext({ req }: CreateFastifyContextOptions): Context {
  // TODO: Verify Supabase JWT and extract user ID
  const authHeader = req.headers.authorization;
  const userId = authHeader?.replace('Bearer ', '') || null;
  return { userId };
}
