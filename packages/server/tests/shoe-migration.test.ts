import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadShoesMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_create_shoes.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the create shoes migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('create_shoes migration', () => {
  it('creates shoes and adds the activity shoe foreign key with the expected constraints', async () => {
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

    await db.exec(await loadShoesMigration());

    const columns = await db.query(`
      select table_name, column_name
      from information_schema.columns
      where table_name in ('shoes', 'activities')
        and column_name in ('strava_gear_id', 'shoe_id', 'retire_at_km')
      order by table_name asc, column_name asc
    `);

    expect(columns.rows).toEqual([
      { table_name: 'activities', column_name: 'shoe_id' },
      { table_name: 'shoes', column_name: 'retire_at_km' },
      { table_name: 'shoes', column_name: 'strava_gear_id' },
    ]);

    await db.exec(`
      insert into profiles (id) values ('00000000-0000-0000-0000-000000000001');

      insert into shoes (
        id,
        user_id,
        strava_gear_id,
        brand,
        model,
        retired,
        created_at,
        updated_at
      ) values (
        '00000000-0000-0000-0000-000000000011',
        '00000000-0000-0000-0000-000000000001',
        'gear-1',
        'Nike',
        'Pegasus',
        false,
        '2026-04-01T00:00:00Z',
        '2026-04-01T00:00:00Z'
      );

      insert into activities (id, user_id, shoe_id) values (
        '00000000-0000-0000-0000-000000000021',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000011'
      );
    `);

    await expect(db.exec(`
      insert into shoes (
        id,
        user_id,
        strava_gear_id,
        brand,
        model,
        retired,
        created_at,
        updated_at
      ) values (
        '00000000-0000-0000-0000-000000000012',
        '00000000-0000-0000-0000-000000000001',
        'gear-1',
        'Nike',
        'Pegasus 2',
        false,
        '2026-04-01T00:00:00Z',
        '2026-04-01T00:00:00Z'
      );
    `)).rejects.toThrow();

    await db.exec(`
      delete from shoes
      where id = '00000000-0000-0000-0000-000000000011'
    `);

    const activities = await db.query(`
      select shoe_id
      from activities
      where id = '00000000-0000-0000-0000-000000000021'
    `);

    expect(activities.rows).toEqual([{ shoe_id: null }]);
    await db.close();
  });
});
