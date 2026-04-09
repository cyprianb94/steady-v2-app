import { describe, expect, it } from 'vitest';
import { getRtrProgression, RTR_STEPS, type Injury } from '@steady/types';

function makeInjury(overrides: Partial<Injury> = {}): Injury {
  return {
    name: 'Calf strain',
    markedDate: '2026-04-02',
    rtrStep: 0,
    rtrStepCompletedDates: [],
    status: 'recovering',
    ...overrides,
  };
}

describe('getRtrProgression', () => {
  it('marks step 0 as current for a new injury', () => {
    const progression = getRtrProgression(makeInjury({ rtrStep: 0 }));

    expect(progression.isComplete).toBe(false);
    expect(progression.currentStepIndex).toBe(0);
    expect(progression.steps[0]).toMatchObject({
      label: 'Walk/Jog',
      suggestedSession: '3km',
      isCurrent: true,
      isComplete: false,
    });
  });

  it('returns complete when the final step is reached with all completion dates', () => {
    const progression = getRtrProgression(
      makeInjury({
        rtrStep: 3,
        rtrStepCompletedDates: ['2026-04-03', '2026-04-05', '2026-04-07', '2026-04-09'],
        status: 'returning',
      }),
    );

    expect(progression.isComplete).toBe(true);
    expect(progression.steps.every((step) => step.isComplete)).toBe(true);
  });

  it('handles out of range steps gracefully', () => {
    const progression = getRtrProgression(makeInjury({ rtrStep: 99 }));

    expect(progression.isComplete).toBe(true);
    expect(progression.currentStepIndex).toBe(RTR_STEPS.length - 1);
  });
});
