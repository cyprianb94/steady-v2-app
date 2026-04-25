import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabaseAdmin: SupabaseClient | null = null;

function requireEnv(name: 'SUPABASE_URL'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for Supabase auth verification`);
  }
  return value;
}

export function getSupabaseServiceKey(): string | null {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (serviceKey) {
    return serviceKey;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return serviceRoleKey || null;
}

function requireSupabaseServiceKey(): string {
  const value = getSupabaseServiceKey();
  if (!value) {
    throw new Error(
      'SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY is required for Supabase auth verification',
    );
  }
  return value;
}

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdmin) return supabaseAdmin;

  supabaseAdmin = createClient(
    requireEnv('SUPABASE_URL'),
    requireSupabaseServiceKey(),
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
