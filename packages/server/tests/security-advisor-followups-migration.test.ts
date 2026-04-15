import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadFollowupMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_security_advisor_followups.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the security advisor follow-up migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('security_advisor_followups migration', () => {
  it('pins the RPC search_path and adds an explicit deny policy for integration tokens', async () => {
    const db = new PGlite();

    await db.exec(`
      create role anon;
      create role authenticated;

      create table public.profiles (
        id uuid primary key
      );

      create table public.activities (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade
      );

      create table public.niggles (
        id uuid primary key default gen_random_uuid(),
        user_id uuid not null references public.profiles(id) on delete cascade,
        activity_id uuid not null references public.activities(id) on delete cascade,
        body_part text not null,
        severity text not null,
        niggle_when text not null,
        side text,
        created_at timestamptz not null default now()
      );

      create table public.integration_tokens (
        id uuid primary key,
        user_id uuid not null references public.profiles(id) on delete cascade
      );

      alter table public.integration_tokens enable row level security;

      create or replace function public.replace_niggles_for_activity(
        p_activity_id uuid,
        p_user_id uuid,
        p_niggles jsonb
      )
      returns setof public.niggles
      language plpgsql
      as $$
      begin
        return query
          select *
          from public.niggles
          where false;
      end;
      $$;
    `);

    await db.exec(await loadFollowupMigration());

    await db.exec(`
      insert into public.profiles (id)
      values ('00000000-0000-0000-0000-000000000001');

      insert into public.activities (id, user_id)
      values (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001'
      );
    `);

    const functionConfig = await db.query(`
      select array_to_string(proconfig, ',') as settings
      from pg_proc
      where oid = 'public.replace_niggles_for_activity(uuid, uuid, jsonb)'::regprocedure
    `);

    expect(functionConfig.rows).toEqual([
      { settings: expect.stringContaining('search_path=') },
    ]);

    const inserted = await db.query(`
      select body_part, severity, niggle_when, side
      from public.replace_niggles_for_activity(
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        '[{"bodyPart":"calf","severity":"mild","when":"after","side":"left"}]'::jsonb
      )
    `);

    expect(inserted.rows).toEqual([
      {
        body_part: 'calf',
        severity: 'mild',
        niggle_when: 'after',
        side: 'left',
      },
    ]);

    const policies = await db.query(`
      select tablename, policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = 'integration_tokens'
      order by policyname asc
    `);

    expect(policies.rows).toEqual([
      { tablename: 'integration_tokens', policyname: 'integration_tokens_no_client_access' },
    ]);

    await db.close();
  });
});
