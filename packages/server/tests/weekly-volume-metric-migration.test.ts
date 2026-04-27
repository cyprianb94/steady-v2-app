import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadWeeklyVolumeMetricMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_add_weekly_volume_metric.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the weekly volume metric migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('weekly volume metric migration', () => {
  it('adds a non-null profile preference with default and check constraint', async () => {
    const db = new PGlite();

    await db.exec(`
      create table public.profiles (
        id uuid primary key
      );
    `);

    await db.exec(await loadWeeklyVolumeMetricMigration());

    const columns = await db.query(`
      select column_name, is_nullable, data_type, column_default
      from information_schema.columns
      where table_name = 'profiles'
        and column_name = 'weekly_volume_metric'
    `);

    expect(columns.rows).toEqual([
      {
        column_name: 'weekly_volume_metric',
        is_nullable: 'NO',
        data_type: 'text',
        column_default: "'distance'::text",
      },
    ]);

    await db.exec(`
      insert into public.profiles (id)
      values ('00000000-0000-0000-0000-000000000001');
    `);

    const defaults = await db.query(`
      select weekly_volume_metric
      from public.profiles
      where id = '00000000-0000-0000-0000-000000000001'
    `);

    expect(defaults.rows).toEqual([{ weekly_volume_metric: 'distance' }]);

    await expect(db.exec(`
      insert into public.profiles (id, weekly_volume_metric)
      values ('00000000-0000-0000-0000-000000000002', 'stress');
    `)).rejects.toThrow();

    await db.close();
  });
});
