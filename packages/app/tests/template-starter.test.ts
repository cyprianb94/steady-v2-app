import { describe, expect, it } from 'vitest';

import {
  createStarterTemplate,
  countScheduledSessions,
  resolveTemplateForStepPlan,
} from '../features/plan-builder/template-starter';
import {
  deriveTrainingPaceProfile,
  trainingPaceBandToIntensityTarget,
} from '@steady/types';

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

  it('includes structured intensity defaults without modelling recovery as a session type', () => {
    const template = createStarterTemplate('template', 7);

    expect(template[0]).toMatchObject({
      type: 'EASY',
      intensityTarget: {
        mode: 'effort',
        profileKey: 'easy',
        effortCue: 'conversational',
      },
    });
    expect(template[1]).toMatchObject({
      type: 'INTERVAL',
      intensityTarget: {
        mode: 'pace',
        profileKey: 'interval',
        paceRange: { min: '3:45', max: '3:55' },
        effortCue: 'hard repeatable',
      },
    });
    expect(template[3]).toMatchObject({
      type: 'TEMPO',
      intensityTarget: {
        mode: 'both',
        profileKey: 'threshold',
        effortCue: 'controlled hard',
      },
    });
    expect(template[4]).toMatchObject({
      type: 'EASY',
      intensityTarget: {
        mode: 'effort',
        profileKey: 'recovery',
        effortCue: 'very easy',
      },
    });
  });

  it('links starter sessions to profile bands when a training pace profile exists', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    const template = createStarterTemplate('template', 7, profile);

    expect(template[0]).toMatchObject({
      type: 'EASY',
      pace: '5:35',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.easy),
    });
    expect(template[1]).toMatchObject({
      type: 'INTERVAL',
      pace: '3:53',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.interval),
    });
    expect(template[3]).toMatchObject({
      type: 'TEMPO',
      pace: '4:20',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.threshold),
    });
    expect(template[4]).toMatchObject({
      type: 'EASY',
      pace: '6:20',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.recovery),
    });
  });
});
