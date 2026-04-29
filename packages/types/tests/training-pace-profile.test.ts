import { describe, expect, it } from 'vitest';
import type { IntensityTarget, TrainingPaceProfile } from '../src';
import {
  deriveTrainingPaceProfile,
  getOrderedTrainingPaceProfileBands,
  normalizeTrainingPaceProfile,
  parseRaceTargetTimeSeconds,
  trainingPaceBandRepresentativePaceSeconds,
  trainingPaceBandToIntensityTarget,
} from '../src';

describe('training pace profile target parsing', () => {
  it('parses preset and custom target time strings', () => {
    expect(parseRaceTargetTimeSeconds('sub-3:15', 'Marathon')).toBe(11_700);
    expect(parseRaceTargetTimeSeconds('sub-45', '10K')).toBe(2_700);
    expect(parseRaceTargetTimeSeconds('sub-1:30', 'Half Marathon')).toBe(5_400);
    expect(parseRaceTargetTimeSeconds('03:15:00', 'Marathon')).toBe(11_700);
    expect(parseRaceTargetTimeSeconds('00:45:00', '10K')).toBe(2_700);
    expect(parseRaceTargetTimeSeconds('sub-10h', 'Ultra')).toBe(36_000);
  });
});

describe('training pace profile derivation', () => {
  it('exports a shared profile type and derives stable bands from a marathon target', () => {
    const profile: TrainingPaceProfile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });

    expect(profile.raceDistance).toBe('Marathon');
    expect(profile.targetTime).toBe('sub-3:15');
    expect(profile.targetTimeSeconds).toBe(11_700);
    expect(profile.racePace).toBe('4:37');
    expect(getOrderedTrainingPaceProfileBands(profile).map((band) => band.profileKey)).toEqual([
      'recovery',
      'easy',
      'steady',
      'marathon',
      'threshold',
      'interval',
    ]);

    expect(profile.bands.recovery).toMatchObject({
      profileKey: 'recovery',
      label: 'Recovery',
      order: 0,
      paceRange: { min: '6:14', max: '6:45' },
      defaultEffortCue: 'very easy',
      editability: { editable: true },
    });
    expect(profile.bands.marathon).toEqual({
      profileKey: 'marathon',
      label: 'Race pace',
      order: 3,
      pace: '4:37',
      defaultEffortCue: 'race pace',
      editability: {
        editable: false,
        reason: 'race-target-derived',
      },
    });
  });

  it('keeps pace formatting stable at common target boundaries', () => {
    expect(deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: 'sub-60',
    }).racePace).toBe('6:00');

    expect(deriveTrainingPaceProfile({
      raceDistance: 'Half Marathon',
      targetTime: 'sub-1:30',
    }).racePace).toBe('4:16');

    expect(deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    }).racePace).toBe('4:30');
  });

  it('falls back deterministically when the target time is invalid', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: 'not-a-time',
    });

    expect(profile.targetTime).toBe('not-a-time');
    expect(profile.targetTimeSeconds).toBe(3_000);
    expect(profile.racePace).toBe('5:00');
    expect(profile.bands.marathon.pace).toBe('5:00');
  });

  it('maps profile bands to structured intensity targets without duplicating the target model', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });

    const recoveryTarget: IntensityTarget = trainingPaceBandToIntensityTarget(profile.bands.recovery);
    expect(recoveryTarget).toEqual({
      source: 'profile',
      mode: 'both',
      profileKey: 'recovery',
      paceRange: { min: '6:14', max: '6:45' },
      effortCue: 'very easy',
    });

    expect(trainingPaceBandToIntensityTarget(profile.bands.marathon)).toEqual({
      source: 'profile',
      mode: 'both',
      profileKey: 'marathon',
      pace: '4:37',
      effortCue: 'race pace',
    });

    expect('representativePace' in profile.bands.easy).toBe(false);
    expect(trainingPaceBandRepresentativePaceSeconds(profile.bands.easy)).toBe(344);
  });

  it('normalizes persisted profiles while leaving absent legacy profiles as null', () => {
    expect(normalizeTrainingPaceProfile(null)).toBeNull();
    expect(normalizeTrainingPaceProfile(undefined)).toBeNull();

    const profile = deriveTrainingPaceProfile({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
    });
    const normalized = normalizeTrainingPaceProfile({
      ...profile,
      bands: {
        ...profile.bands,
        easy: {
          ...profile.bands.easy,
          paceRange: { min: '5:45', max: '5:15' },
        },
        threshold: {
          ...profile.bands.threshold,
          defaultEffortCue: 'sharp',
        },
      },
    });

    expect(normalized).toMatchObject({
      raceDistance: 'Marathon',
      targetTime: 'sub-3:15',
      targetTimeSeconds: 11_700,
      racePace: '4:37',
    });
    expect(normalized?.bands.easy.paceRange).toEqual({ min: '5:15', max: '5:45' });
    expect(normalized?.bands.threshold.defaultEffortCue).toBe('sharp');
    expect(normalized?.bands.marathon).toEqual(profile.bands.marathon);
  });
});
