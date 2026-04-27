import { describe, expect, it } from 'vitest';
import type { PlanWeek } from '@steady/types';
import { applyActivityMatchToWeeks } from '../src/lib/activity-match-assignment';

describe('applyActivityMatchToWeeks', () => {
  it('clears skipped state when an activity is matched to the planned session', () => {
    const weeks: PlanWeek[] = [
      {
        weekNumber: 1,
        phase: 'BASE',
        plannedKm: 8,
        sessions: [
          {
            id: 'session-1',
            type: 'EASY',
            date: '2026-04-06',
            distance: 8,
            pace: '5:20',
            skipped: {
              reason: 'busy',
              markedAt: '2026-04-06T12:00:00.000Z',
            },
          },
          null,
          null,
          null,
          null,
          null,
          null,
        ],
      },
    ];

    const result = applyActivityMatchToWeeks(weeks, 'activity-1', 'session-1');

    expect(result.weeks[0].sessions[0]).toMatchObject({
      id: 'session-1',
      actualActivityId: 'activity-1',
    });
    expect(result.weeks[0].sessions[0]?.skipped).toBeUndefined();
    expect(weeks[0].sessions[0]?.skipped).toBeDefined();
  });
});
