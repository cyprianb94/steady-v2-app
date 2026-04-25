import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadNiggleWhenMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_make_niggle_when_multi_select.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the niggle when migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('make_niggle_when_multi_select migration', () => {
  it('backfills scalar timing and persists multiple timing values through the RPC', async () => {
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
        body_part_other_text text,
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
        'calf',
        'mild',
        'during',
        'left',
        '2026-04-10T10:00:00Z'
      );
    `);

    await db.exec(await loadNiggleWhenMigration());

    const legacyRows = await db.query(`
      select niggle_when::text as niggle_when
      from public.niggles
      order by created_at asc
    `);

    expect(legacyRows.rows).toEqual([
      { niggle_when: '{during}' },
    ]);

    const inserted = await db.query(`
      select body_part, niggle_when::text as niggle_when, side
      from public.replace_niggles_for_activity(
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        '[{"bodyPart":"calf","severity":"mild","when":["before","during"],"side":"left"}]'::jsonb
      )
    `);

    expect(inserted.rows).toEqual([
      {
        body_part: 'calf',
        niggle_when: '{before,during}',
        side: 'left',
      },
    ]);

    const legacyScalarInserted = await db.query(`
      select niggle_when::text as niggle_when
      from public.replace_niggles_for_activity(
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        '[{"bodyPart":"calf","severity":"mild","when":"after","side":"left"}]'::jsonb
      )
    `);

    expect(legacyScalarInserted.rows).toEqual([
      { niggle_when: '{after}' },
    ]);

    await expect(db.exec(`
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
        '00000000-0000-0000-0000-000000000022',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000011',
        'calf',
        'mild',
        array['before', 'before'],
        'left',
        '2026-04-10T10:00:01Z'
      );
    `)).rejects.toThrow();

    await db.close();
  });
});
