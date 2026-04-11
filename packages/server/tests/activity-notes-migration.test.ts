import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadActivityNotesMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_add_activity_notes.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the add activity notes migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('add_activity_notes migration', () => {
  it('adds a nullable notes column to activities', async () => {
    const db = new PGlite();

    await db.exec(`
      create table activities (
        id uuid primary key
      );
    `);

    await db.exec(await loadActivityNotesMigration());

    const columns = await db.query(`
      select column_name, is_nullable, data_type
      from information_schema.columns
      where table_name = 'activities'
        and column_name = 'notes'
    `);

    expect(columns.rows).toEqual([
      {
        column_name: 'notes',
        is_nullable: 'YES',
        data_type: 'text',
      },
    ]);

    await db.close();
  });
});
