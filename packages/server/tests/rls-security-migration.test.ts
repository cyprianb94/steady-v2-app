import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadRlsMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_enable_rls_on_public_tables.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the RLS hardening migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('enable_rls_on_public_tables migration', () => {
  it('enables RLS across public tables and leaves integration tokens without client policies', async () => {
    const db = new PGlite();

    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;

      create schema auth;
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select '00000000-0000-0000-0000-000000000001'::uuid
      $$;

      create table auth.users (
        id uuid primary key
      );

      create table public.profiles (
        id uuid primary key references auth.users(id) on delete cascade
      );

      create table public.training_plans (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade,
        is_active boolean not null default true
      );

      create table public.shoes (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade
      );

      create table public.activities (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade,
        shoe_id uuid references public.shoes(id) on delete set null
      );

      create table public.coach_conversations (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade
      );

      create table public.coach_messages (
        id uuid primary key,
        conversation_id uuid not null references public.coach_conversations(id) on delete cascade
      );

      create table public.plan_edits (
        id uuid primary key,
        conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
        message_id uuid not null references public.coach_messages(id) on delete cascade
      );

      create table public.cross_training_log (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade,
        plan_id uuid not null references public.training_plans(id) on delete cascade
      );

      create table public.niggles (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade,
        activity_id uuid not null references public.activities(id) on delete cascade
      );

      create table public.integration_tokens (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade,
        provider text not null,
        encrypted_access_token text not null,
        encrypted_refresh_token text not null,
        expires_at timestamptz not null
      );

      create function public.replace_niggles_for_activity(uuid, uuid, jsonb)
      returns setof public.niggles
      language sql
      as $$
        select *
        from public.niggles
        where false
      $$;
    `);

    await db.exec(await loadRlsMigration());

    const rlsFlags = await db.query(`
      select c.relname as table_name, c.relrowsecurity as rls_enabled
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in (
          'profiles',
          'training_plans',
          'activities',
          'coach_conversations',
          'coach_messages',
          'plan_edits',
          'cross_training_log',
          'shoes',
          'niggles',
          'integration_tokens'
        )
      order by c.relname asc
    `);

    expect(rlsFlags.rows).toEqual([
      { table_name: 'activities', rls_enabled: true },
      { table_name: 'coach_conversations', rls_enabled: true },
      { table_name: 'coach_messages', rls_enabled: true },
      { table_name: 'cross_training_log', rls_enabled: true },
      { table_name: 'integration_tokens', rls_enabled: true },
      { table_name: 'niggles', rls_enabled: true },
      { table_name: 'plan_edits', rls_enabled: true },
      { table_name: 'profiles', rls_enabled: true },
      { table_name: 'shoes', rls_enabled: true },
      { table_name: 'training_plans', rls_enabled: true },
    ]);

    const policies = await db.query(`
      select tablename, policyname
      from pg_policies
      where schemaname = 'public'
        and tablename in (
          'profiles',
          'training_plans',
          'activities',
          'coach_conversations',
          'coach_messages',
          'plan_edits',
          'cross_training_log',
          'shoes',
          'niggles',
          'integration_tokens'
        )
      order by tablename asc, policyname asc
    `);

    expect(policies.rows).toEqual([
      { tablename: 'activities', policyname: 'activities_owner_all' },
      { tablename: 'coach_conversations', policyname: 'coach_conversations_owner_all' },
      { tablename: 'coach_messages', policyname: 'coach_messages_owner_all' },
      { tablename: 'cross_training_log', policyname: 'cross_training_log_owner_all' },
      { tablename: 'niggles', policyname: 'niggles_owner_all' },
      { tablename: 'plan_edits', policyname: 'plan_edits_owner_all' },
      { tablename: 'profiles', policyname: 'profiles_owner_all' },
      { tablename: 'shoes', policyname: 'shoes_owner_all' },
      { tablename: 'training_plans', policyname: 'training_plans_owner_all' },
    ]);

    const rpcPrivileges = await db.query(`
      select
        has_function_privilege('anon', 'public.replace_niggles_for_activity(uuid, uuid, jsonb)', 'EXECUTE') as anon_can_execute,
        has_function_privilege('authenticated', 'public.replace_niggles_for_activity(uuid, uuid, jsonb)', 'EXECUTE') as authenticated_can_execute,
        has_function_privilege('service_role', 'public.replace_niggles_for_activity(uuid, uuid, jsonb)', 'EXECUTE') as service_role_can_execute
    `);

    expect(rpcPrivileges.rows).toEqual([
      {
        anon_can_execute: false,
        authenticated_can_execute: false,
        service_role_can_execute: true,
      },
    ]);

    const tablePrivileges = await db.query(`
      select
        has_table_privilege('anon', 'public.integration_tokens', 'SELECT') as anon_can_select_tokens,
        has_table_privilege('authenticated', 'public.integration_tokens', 'SELECT') as authenticated_can_select_tokens,
        has_table_privilege('service_role', 'public.integration_tokens', 'SELECT') as service_role_can_select_tokens
    `);

    expect(tablePrivileges.rows).toEqual([
      {
        anon_can_select_tokens: false,
        authenticated_can_select_tokens: false,
        service_role_can_select_tokens: true,
      },
    ]);

    await db.close();
  });
});
