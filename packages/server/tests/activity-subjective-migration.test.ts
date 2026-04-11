import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, '../../..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');

async function loadBackfillMigration(): Promise<string> {
  const entries = await readdir(MIGRATIONS_DIR);
  const filename = entries
    .filter((entry) => entry.endsWith('_backfill_activity_subjective_input.sql'))
    .sort()
    .at(-1);

  if (!filename) {
    throw new Error('Could not find the backfill activity subjective-input migration');
  }

  return readFile(path.join(MIGRATIONS_DIR, filename), 'utf8');
}

describe('backfill_activity_subjective_input migration', () => {
  it('copies planned-session subjective input onto matched activities only', async () => {
    const db = new PGlite();

    await db.exec(`
      create table activities (
        id text primary key,
        subjective_input jsonb
      );

      create table training_plans (
        id text primary key,
        weeks jsonb not null
      );

      insert into activities (id, subjective_input) values
        ('activity-1', null),
        ('activity-2', '{"legs":"fresh","breathing":"easy","overall":"could-go-again"}');

      insert into training_plans (id, weeks) values (
        'plan-1',
        '[
          {
            "weekNumber": 1,
            "phase": "BUILD",
            "plannedKm": 8,
            "sessions": [
              {
                "id": "session-1",
                "type": "EASY",
                "date": "2026-04-09",
                "actualActivityId": "activity-1",
                "subjectiveInput": {
                  "legs": "heavy",
                  "breathing": "controlled",
                  "overall": "done"
                }
              },
              {
                "id": "session-2",
                "type": "EASY",
                "date": "2026-04-10",
                "subjectiveInput": {
                  "legs": "dead",
                  "breathing": "labored",
                  "overall": "shattered"
                }
              },
              null,
              null,
              null,
              null,
              null
            ]
          }
        ]'::jsonb
      );
    `);

    await db.exec(await loadBackfillMigration());

    const { rows } = await db.query(`
      select id, subjective_input
      from activities
      order by id asc
    `);

    expect(rows).toEqual([
      {
        id: 'activity-1',
        subjective_input: {
          legs: 'heavy',
          breathing: 'controlled',
          overall: 'done',
        },
      },
      {
        id: 'activity-2',
        subjective_input: {
          legs: 'fresh',
          breathing: 'easy',
          overall: 'could-go-again',
        },
      },
    ]);

    await db.close();
  });
});
