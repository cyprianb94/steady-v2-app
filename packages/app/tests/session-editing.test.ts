import { describe, expect, it } from 'vitest';
import { deriveTrainingPaceProfile, trainingPaceBandToIntensityTarget, type PlannedSession } from '@steady/types';
import {
  getSessionEditorProfileBands,
  hasMaterialSessionEdit,
  materializeEditedSession,
  resolveProfileLinkedSessionTarget,
} from '../features/plan-builder/session-editing';

const existingEasy: PlannedSession = {
  id: 'session-1',
  type: 'EASY',
  date: '2026-04-06',
  distance: 8,
  pace: '5:20',
  intensityTarget: {
    source: 'manual',
    mode: 'effort',
    profileKey: 'easy',
    effortCue: 'conversational',
  },
};

describe('session edit materialization', () => {
  it('preserves existing intensity metadata for same-type edits', () => {
    const updated = materializeEditedSession(
      existingEasy,
      { type: 'EASY', distance: 10, pace: '5:20' },
      { id: 'fallback', date: 'preview', type: 'EASY' },
    );

    expect(updated).toMatchObject({
      id: 'session-1',
      type: 'EASY',
      distance: 10,
      intensityTarget: existingEasy.intensityTarget,
    });
  });

  it('keeps Training pace references when only structural fields change', () => {
    const thresholdTarget = {
      source: 'profile' as const,
      mode: 'both' as const,
      profileKey: 'threshold' as const,
      paceRange: { min: '4:10', max: '4:20' },
      effortCue: 'controlled hard' as const,
    };
    const existingTempo: PlannedSession = {
      id: 'tempo-1',
      type: 'TEMPO',
      date: '2026-04-09',
      distance: 10,
      pace: '4:15',
      intensityTarget: thresholdTarget,
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    };

    const updated = materializeEditedSession(
      existingTempo,
      {
        type: 'TEMPO',
        distance: 12,
        pace: '4:15',
        warmup: { unit: 'km', value: 2 },
        cooldown: { unit: 'km', value: 1 },
      },
      { id: 'fallback', date: 'preview', type: 'TEMPO' },
    );

    expect(updated).toMatchObject({
      id: 'tempo-1',
      type: 'TEMPO',
      distance: 12,
      warmup: { unit: 'km', value: 2 },
      intensityTarget: thresholdTarget,
    });
  });

  it('drops stale target metadata when the session type changes and keeps legacy pace writable', () => {
    const updated = materializeEditedSession(
      existingEasy,
      {
        type: 'INTERVAL',
        reps: 6,
        repDuration: { unit: 'km', value: 0.8 },
        recovery: { unit: 'min', value: 1.5 },
        pace: '3:50',
      },
      { id: 'fallback', date: 'preview', type: 'EASY' },
    );

    expect(updated).toMatchObject({
      id: 'session-1',
      type: 'INTERVAL',
      pace: '3:50',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '3:50',
      },
    });
    expect(updated).not.toHaveProperty('distance');
  });

  it('drops stale planned fields when the session type changes', () => {
    const existingInterval: PlannedSession = {
      id: 'interval-1',
      type: 'INTERVAL',
      date: '2026-04-08',
      reps: 6,
      repDist: 800,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'min', value: 1.5 },
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
      pace: '3:50',
    };

    const updated = materializeEditedSession(
      existingInterval,
      { type: 'EASY', distance: 8, pace: '5:20' },
      { id: 'fallback', date: 'preview', type: 'INTERVAL' },
    );

    expect(updated).toMatchObject({
      id: 'interval-1',
      type: 'EASY',
      distance: 8,
      pace: '5:20',
    });
    expect(updated).not.toHaveProperty('reps');
    expect(updated).not.toHaveProperty('repDist');
    expect(updated).not.toHaveProperty('repDuration');
    expect(updated).not.toHaveProperty('recovery');
    expect(updated).not.toHaveProperty('warmup');
    expect(updated).not.toHaveProperty('cooldown');
  });

  it('clears same-type structural fields when the editor emits an explicit clear', () => {
    const existingTempo: PlannedSession = {
      id: 'tempo-clear',
      type: 'TEMPO',
      date: '2026-04-09',
      distance: 10,
      pace: '4:15',
      warmup: { unit: 'km', value: 1.5 },
      cooldown: { unit: 'km', value: 1 },
    };

    const updated = materializeEditedSession(
      existingTempo,
      {
        type: 'TEMPO',
        distance: 10,
        pace: '4:15',
        warmup: undefined,
        cooldown: undefined,
      },
      { id: 'fallback', date: 'preview', type: 'TEMPO' },
    );

    expect(updated).not.toHaveProperty('warmup');
    expect(updated).not.toHaveProperty('cooldown');
  });

  it('clears stale rep distance when interval rep length changes to minutes', () => {
    const existingInterval: PlannedSession = {
      id: 'interval-minutes',
      type: 'INTERVAL',
      date: '2026-04-08',
      reps: 6,
      repDist: 800,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'min', value: 1.5 },
      pace: '3:50',
    };

    const updated = materializeEditedSession(
      existingInterval,
      {
        type: 'INTERVAL',
        reps: 6,
        repDist: undefined,
        repDuration: { unit: 'min', value: 4 },
        recovery: { unit: 'min', value: 1.5 },
        pace: '3:50',
      },
      { id: 'fallback', date: 'preview', type: 'INTERVAL' },
    );

    expect(updated).not.toHaveProperty('repDist');
    expect(updated).toMatchObject({
      repDuration: { unit: 'min', value: 4 },
    });
  });
});

describe('session edit material change detection', () => {
  it('treats reselecting the same Training pace with no other changes as a no-op', () => {
    const thresholdTarget = {
      source: 'profile' as const,
      mode: 'both' as const,
      profileKey: 'threshold' as const,
      paceRange: { min: '4:10', max: '4:20' },
      effortCue: 'controlled hard' as const,
    };
    const existingTempo: PlannedSession = {
      id: 'tempo-1',
      type: 'TEMPO',
      date: '2026-04-09',
      distance: 10,
      pace: '4:15',
      intensityTarget: thresholdTarget,
    };

    expect(hasMaterialSessionEdit(
      existingTempo,
      {
        type: 'TEMPO',
        distance: 10,
        pace: '4:15',
        intensityTarget: thresholdTarget,
      },
      { id: 'fallback', date: 'preview', type: 'TEMPO' },
    )).toBe(false);
  });

  it('detects structural edits without treating identity fields as changes', () => {
    expect(hasMaterialSessionEdit(
      existingEasy,
      { type: 'EASY', distance: 10, pace: '5:20' },
      { id: 'fallback', date: 'preview', type: 'EASY' },
    )).toBe(true);
  });
});

describe('session editor Training pace options', () => {
  it('includes the current Training pace even when it is unusual for the session type', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    const bands = getSessionEditorProfileBands(
      'TEMPO',
      profile,
      trainingPaceBandToIntensityTarget(profile.bands.steady),
    );

    expect(bands.map((band) => band.profileKey)).toEqual([
      'threshold',
      'marathon',
      'steady',
    ]);
  });
});

describe('profile-linked session target resolution', () => {
  it('refreshes future profile-linked sessions from the current Training pace profile', () => {
    const baseProfile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });
    const beforeProfile = {
      ...baseProfile,
      bands: {
        ...baseProfile.bands,
        interval: {
          ...baseProfile.bands.interval,
          paceRange: { min: '3:47', max: '4:10' },
        },
      },
    };
    const afterProfile = {
      ...beforeProfile,
      bands: {
        ...beforeProfile.bands,
        interval: {
          ...beforeProfile.bands.interval,
          paceRange: { min: '3:47', max: '3:50' },
        },
      },
    };
    const staleInterval: PlannedSession = {
      id: 'interval-stale',
      type: 'INTERVAL',
      date: '2026-05-05',
      reps: 6,
      repDist: 800,
      recovery: { unit: 'min', value: 1.5 },
      pace: '3:59',
      intensityTarget: trainingPaceBandToIntensityTarget(beforeProfile.bands.interval),
    };

    const resolved = resolveProfileLinkedSessionTarget(staleInterval, afterProfile, {
      today: '2026-04-29',
    });

    expect(resolved).toMatchObject({
      pace: '3:49',
      intensityTarget: {
        source: 'profile',
        profileKey: 'interval',
        paceRange: { min: '3:47', max: '3:50' },
      },
    });
  });

  it('keeps manual, completed, and past sessions unchanged', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });
    const manualInterval: PlannedSession = {
      id: 'manual-interval',
      type: 'INTERVAL',
      date: '2026-05-05',
      reps: 6,
      repDist: 800,
      pace: '3:59',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        paceRange: { min: '3:47', max: '4:10' },
      },
    };
    const completedInterval: PlannedSession = {
      ...manualInterval,
      id: 'completed-interval',
      actualActivityId: 'activity-1',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.interval),
    };
    const pastInterval: PlannedSession = {
      ...manualInterval,
      id: 'past-interval',
      date: '2026-04-28',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.interval),
    };

    expect(resolveProfileLinkedSessionTarget(manualInterval, profile, {
      today: '2026-04-29',
    })).toBe(manualInterval);
    expect(resolveProfileLinkedSessionTarget(completedInterval, profile, {
      today: '2026-04-29',
    })).toBe(completedInterval);
    expect(resolveProfileLinkedSessionTarget(pastInterval, profile, {
      today: '2026-04-29',
    })).toBe(pastInterval);
  });
});
