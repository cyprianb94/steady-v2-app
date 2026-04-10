import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_SERVICE_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Supabase auth verification`);
  }
  return value;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  supabaseAdmin = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return supabaseAdmin;
}

export async function getUserIdFromAccessToken(token: string): Promise<string | null> {
  try {
    const { data, error } = await getSupabaseAdminClient().auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}
