import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadActivityFuelEventsMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_add_activity_fuel_events.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the add activity fuel events migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('add_activity_fuel_events migration', () => {
  it('adds a non-null JSONB fuel_events column with an empty-array default', async () => {
    const db = new PGlite();

    await db.exec(`
      create table activities (
        id uuid primary key
      );
    `);

    await db.exec(await loadActivityFuelEventsMigration());

    const columns = await db.query(`
      select column_name, is_nullable, data_type, column_default
      from information_schema.columns
      where table_name = 'activities'
        and column_name = 'fuel_events'
    `);

    expect(columns.rows).toEqual([
      {
        column_name: 'fuel_events',
        is_nullable: 'NO',
        data_type: 'jsonb',
        column_default: "'[]'::jsonb",
      },
    ]);

    await db.close();
  });
});
