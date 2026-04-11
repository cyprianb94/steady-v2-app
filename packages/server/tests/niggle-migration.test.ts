import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadNigglesMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_create_niggles.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the create niggles migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('create_niggles migration', () => {
  it('creates niggles with enum validation, indexes, and cascade delete from activities', async () => {
    const db = new PGlite();

    await db.exec(`
      create table profiles (
        id uuid primary key
      );

      create table activities (
        id uuid primary key,
        user_id uuid not null references profiles(id) on delete cascade
      );
    `);

    await db.exec(await loadNigglesMigration());
    await db.exec(`
      insert into profiles (id) values ('00000000-0000-0000-0000-000000000001');
      insert into activities (id, user_id) values (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001'
      );
    `);

    const indexes = await db.query(`
      select indexname
      from pg_indexes
      where tablename = 'niggles'
      order by indexname asc
    `);

    expect(indexes.rows).toEqual([
      { indexname: 'niggles_activity_idx' },
      { indexname: 'niggles_pkey' },
      { indexname: 'niggles_user_created_idx' },
    ]);

    await db.exec(`
      insert into niggles (
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

    await expect(db.exec(`
      insert into niggles (
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
        'elbow',
        'mild',
        'during',
        'left',
        '2026-04-10T10:00:00Z'
      );
    `)).rejects.toThrow();

    await db.exec(`
      delete from activities
      where id = '00000000-0000-0000-0000-000000000011'
    `);

    const remaining = await db.query(`
      select count(*)::int as count
      from niggles
    `);

    expect(remaining.rows).toEqual([{ count: 0 }]);
    await db.close();
  });
});
