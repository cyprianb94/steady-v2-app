import { describe, expect, it } from 'vitest';

import {
  createStarterTemplate,
  countScheduledSessions,
  resolveTemplateForStepPlan,
} from '../features/plan-builder/template-starter';

describe('template starter generation', () => {
  it('generates every template run count from 1 to 7', () => {
    for (const runCount of [1, 2, 3, 4, 5, 6, 7] as const) {
      const template = createStarterTemplate('template', runCount);
      expect(template).toHaveLength(7);
      expect(countScheduledSessions(template)).toBe(runCount);
    }
  });

  it('keeps clean slate empty regardless of the remembered run count', () => {
    const template = createStarterTemplate('clean', 7);

    expect(template).toHaveLength(7);
    expect(countScheduledSessions(template)).toBe(0);
    expect(resolveTemplateForStepPlan(template)).toEqual([null, null, null, null, null, null, null]);
  });

  it('supports a one-run template and a seven-day running template', () => {
    const oneRun = createStarterTemplate('template', 1);
    const sevenRun = createStarterTemplate('template', 7);

    expect(oneRun.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(oneRun[6]?.type).toBe('LONG');
    expect(sevenRun.every((session) => session && session.type !== 'REST')).toBe(true);
  });
});
