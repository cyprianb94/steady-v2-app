import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseServiceKey } from '../src/lib/supabase-admin';

describe('supabase admin config', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the explicit service key when present', () => {
    vi.stubEnv('SUPABASE_SERVICE_KEY', 'service-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    expect(getSupabaseServiceKey()).toBe('service-key');
  });

  it('accepts the Supabase service role key alias', () => {
    vi.stubEnv('SUPABASE_SERVICE_KEY', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');

    expect(getSupabaseServiceKey()).toBe('service-role-key');
  });
});
