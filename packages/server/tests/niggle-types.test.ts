import { describe, expect, it } from 'vitest';
import { BODY_PARTS, formatNiggleBodyPart, formatNiggleSummary, type Niggle } from '@steady/types';

describe('niggle types', () => {
  it('exports the closed body-part list in the documented order', () => {
    expect(BODY_PARTS).toEqual([
      'calf',
      'knee',
      'hamstring',
      'quad',
      'hip',
      'glute',
      'foot',
      'shin',
      'ankle',
      'achilles',
      'back',
      'other',
    ]);
  });

  it('allows the expected niggle shape', () => {
    const niggle: Niggle = {
      id: 'n-1',
      userId: 'user-1',
      activityId: 'activity-1',
      bodyPart: 'other',
      bodyPartOtherText: 'Upper calf',
      severity: 'moderate',
      when: ['before', 'during'],
      side: 'left',
      createdAt: '2026-04-10T10:00:00Z',
    };

    expect(niggle.bodyPart).toBe('other');
    expect(formatNiggleBodyPart(niggle)).toBe('Upper calf');
    expect(formatNiggleSummary(niggle)).toBe('Left Upper calf · Moderate · Before, During');
    expect(niggle.when).toEqual(['before', 'during']);
  });
});
