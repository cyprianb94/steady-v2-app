import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadTrainingPaceProfileMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_add_training_pace_profile.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the training pace profile migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('add_training_pace_profile migration', () => {
  it('adds a nullable JSONB object column to training plans', async () => {
    const db = new PGlite();

    await db.exec(`
      create table public.training_plans (
        id uuid primary key
      );
    `);

    await db.exec(await loadTrainingPaceProfileMigration());

    const columns = await db.query(`
      select column_name, is_nullable, data_type, column_default
      from information_schema.columns
      where table_name = 'training_plans'
        and column_name = 'training_pace_profile'
    `);

    expect(columns.rows).toEqual([
      {
        column_name: 'training_pace_profile',
        is_nullable: 'YES',
        data_type: 'jsonb',
        column_default: null,
      },
    ]);

    await db.exec(`
      insert into public.training_plans (id, training_pace_profile)
      values (
        '00000000-0000-0000-0000-000000000001',
        '{"raceDistance":"Marathon","targetTime":"sub-3:15","bands":{}}'::jsonb
      );
    `);

    await expect(db.exec(`
      insert into public.training_plans (id, training_pace_profile)
      values (
        '00000000-0000-0000-0000-000000000002',
        '[]'::jsonb
      );
    `)).rejects.toThrow();

    await db.close();
  });
});
