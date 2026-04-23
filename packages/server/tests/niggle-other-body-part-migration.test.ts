import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadOtherBodyPartMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_add_niggle_other_body_part_text.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the niggle other-body-part migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('add_niggle_other_body_part_text migration', () => {
  it('backfills legacy other niggles and persists custom text through the RPC', async () => {
    const db = new PGlite();

    await db.exec(`
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
    `);

    await db.exec(`
      insert into public.profiles (id)
      values ('00000000-0000-0000-0000-000000000001');

      insert into public.activities (id, user_id)
      values (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001'
      );

      insert into public.niggles (
        id,
        user_id,
        activity_id,
        body_part,
        severity,
        niggle_when,
        side,
        created_at
      ) values (
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000011',
        'other',
        'mild',
        'during',
        'left',
        '2026-04-10T10:00:00Z'
      );
    `);

    await db.exec(await loadOtherBodyPartMigration());

    const legacyRows = await db.query(`
      select body_part, body_part_other_text
      from public.niggles
      order by created_at asc
    `);

    expect(legacyRows.rows).toEqual([
      { body_part: 'other', body_part_other_text: 'Other' },
    ]);

    const functionConfig = await db.query(`
      select array_to_string(proconfig, ',') as settings
      from pg_proc
      where oid = 'public.replace_niggles_for_activity(uuid, uuid, jsonb)'::regprocedure
    `);

    expect(functionConfig.rows).toEqual([
      { settings: expect.stringContaining('search_path=') },
    ]);

    const inserted = await db.query(`
      select body_part, body_part_other_text, severity, niggle_when, side
      from public.replace_niggles_for_activity(
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        '[{"bodyPart":"other","bodyPartOtherText":"Upper calf","severity":"mild","when":"after","side":"left"}]'::jsonb
      )
    `);

    expect(inserted.rows).toEqual([
      {
        body_part: 'other',
        body_part_other_text: 'Upper calf',
        severity: 'mild',
        niggle_when: 'after',
        side: 'left',
      },
    ]);

    await expect(db.exec(`
      insert into public.niggles (
        id,
        user_id,
        activity_id,
        body_part,
        body_part_other_text,
        severity,
        niggle_when,
        side,
        created_at
      ) values (
        '00000000-0000-0000-0000-000000000022',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000011',
        'other',
        null,
        'mild',
        'during',
        'left',
        '2026-04-10T10:00:01Z'
      );
    `)).rejects.toThrow();

    await expect(db.exec(`
      insert into public.niggles (
        id,
        user_id,
        activity_id,
        body_part,
        body_part_other_text,
        severity,
        niggle_when,
        side,
        created_at
      ) values (
        '00000000-0000-0000-0000-000000000023',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000011',
        'calf',
        'Upper calf',
        'mild',
        'during',
        'left',
        '2026-04-10T10:00:02Z'
      );
    `)).rejects.toThrow();

    await db.close();
  });
});
