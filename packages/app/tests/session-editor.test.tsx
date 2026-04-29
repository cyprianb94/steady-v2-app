import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import * as Haptics from 'expo-haptics';
import { describe, expect, it, vi } from 'vitest';

import { SessionEditor } from '../components/plan-builder/SessionEditor';
import { C } from '../constants/colours';
import {
  deriveTrainingPaceProfile,
  trainingPaceBandToIntensityTarget,
  type PlannedSession,
} from '@steady/types';

function renderSessionEditor(existing: Partial<PlannedSession>) {
  render(
    <SessionEditor
      dayIndex={1}
      existing={existing}
      onSave={vi.fn()}
      onClose={vi.fn()}
      presentation="screen"
    />,
  );
}

function expectCustomInputBlank() {
  const customInput = screen.getByTestId('editable-chip-custom-input') as HTMLInputElement;
  expect(customInput.value).toBe('');
  return customInput;
}

function rgb(hex: string): string {
  const raw = hex.replace('#', '');
  const red = Number.parseInt(raw.slice(0, 2), 16);
  const green = Number.parseInt(raw.slice(2, 4), 16);
  const blue = Number.parseInt(raw.slice(4, 6), 16);

  return `rgb(${red}, ${green}, ${blue})`;
}

function expectSelectedMetricChip(label: string, color: string) {
  const chipText = screen.getByText(label);

  expect(chipText.style.color).toBe(rgb(color));
  expect(chipText.parentElement?.style.borderColor).toBe(rgb(color));
  expect(chipText.parentElement?.style.backgroundColor).not.toBe(rgb(C.clay));
}

const intervalSession = {
  type: 'INTERVAL' as const,
  reps: 6,
  repDist: 800,
  recovery: '90s' as const,
  pace: '3:50',
  warmup: { unit: 'km' as const, value: 1.5 },
  cooldown: { unit: 'km' as const, value: 1 },
};

describe('SessionEditor custom field editing', () => {
  it.each([
    {
      label: 'Distance',
      existing: { type: 'LONG' as const, distance: 20, pace: '5:10' },
    },
    {
      label: 'Repetitions',
      existing: intervalSession,
    },
    {
      label: 'Rep target pace',
      existing: intervalSession,
    },
    {
      label: 'Recovery between reps',
      existing: intervalSession,
    },
    {
      label: 'Warm-up',
      existing: intervalSession,
    },
    {
      label: 'Cool-down',
      existing: intervalSession,
    },
  ])('opens $label custom input empty instead of copying the selected value', ({ label, existing }) => {
    renderSessionEditor(existing);

    fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getByText(label === 'Rep target pace' ? 'Custom pace...' : 'Custom...'));

    expectCustomInputBlank();
  });

  it('opens a previously selected custom target pace as an empty input for replacement', () => {
    renderSessionEditor(intervalSession);

    fireEvent.click(screen.getByText('Rep target pace'));
    fireEvent.click(screen.getByText('Custom pace...'));
    fireEvent.change(expectCustomInputBlank(), {
      target: { value: '3:42' },
    });
    fireEvent.blur(screen.getByTestId('editable-chip-custom-input'));

    fireEvent.click(screen.getByText('Custom pace...'));

    expectCustomInputBlank();
  });
});

describe('SessionEditor haptics', () => {
  it('emits selection haptics only when chip values change', () => {
    vi.mocked(Haptics.selectionAsync).mockClear();

    renderSessionEditor(intervalSession);

    fireEvent.click(screen.getByText('Tempo'));
    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('4:15 /km'));
    fireEvent.click(screen.getByText('Warm-up'));
    fireEvent.click(screen.getAllByText('MIN')[0]);
    fireEvent.click(screen.getByText('Custom...'));

    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(3);
  });
});

describe('SessionEditor colour language', () => {
  it('keeps unselected session type chips on the editor surface', () => {
    renderSessionEditor({ type: 'EASY', distance: 8, pace: '5:20' });

    expect(screen.getByText('Interval').parentElement?.style.backgroundColor).toBe(rgb(C.surface));
  });

  it('uses quiet metric styling for expanded repetition controls', () => {
    renderSessionEditor(intervalSession);

    fireEvent.click(screen.getByText('Repetitions'));

    expectSelectedMetricChip('800m', C.metricDistance);
    expect(screen.getByText('200m').style.color).toBe(rgb(C.metricDistance));
    expect(screen.getAllByText('KM')[0].style.color).toBe(rgb(C.metricDistance));
  });

  it.each([
    {
      type: 'EASY' as const,
      distance: 8,
      pace: '5:20',
      selectedPreset: '8 km',
    },
    {
      type: 'TEMPO' as const,
      distance: 10,
      pace: '4:20',
      selectedPreset: '10 km',
    },
    {
      type: 'LONG' as const,
      distance: 20,
      pace: '5:10',
      selectedPreset: '20 km',
    },
  ])('uses distance styling for selected $type distance chips', (session) => {
    renderSessionEditor(session);

    fireEvent.click(screen.getByText('Distance'));

    expectSelectedMetricChip(session.selectedPreset, C.metricDistance);
  });

  it('uses time styling for selected minute duration chips', () => {
    renderSessionEditor({
      ...intervalSession,
      warmup: { unit: 'min', value: 10 },
    });

    fireEvent.click(screen.getByText('Warm-up'));

    expectSelectedMetricChip('10 min', C.metricTime);
    expect(
      screen.getAllByText('MIN').some((label) => label.style.color === rgb(C.metricTime)),
    ).toBe(true);
  });
});

describe('SessionEditor keyboard-safe custom duration editing', () => {
  it.each([
    { label: 'Warm-up', field: 'warmup' as const },
    { label: 'Cool-down', field: 'cooldown' as const },
  ])('saves a custom $label value while rendered in the keyboard-safe frame', ({ label, field }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByTestId('session-editor-keyboard-frame')).toBeTruthy();

    fireEvent.click(screen.getByText(label));
    fireEvent.click(screen.getByText('Custom...'));
    expect(screen.queryByPlaceholderText('Custom km')).toBeNull();
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '2.5' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('2.5 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      [field]: { unit: 'km', value: 2.5 },
    }));
  });
});

describe('SessionEditor warmup and cooldown availability', () => {
  it.each([
    { type: 'EASY' as const, distance: 8, pace: '5:20' },
    { type: 'LONG' as const, distance: 16, pace: '5:10' },
  ])('hides and strips workout bookends for $type sessions', ({ type, distance, pace }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={0}
        existing={{
          type,
          distance,
          pace,
          warmup: { unit: 'km', value: 1.5 },
          cooldown: { unit: 'km', value: 1 },
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.queryByText('Warm-up')).toBeNull();
    expect(screen.queryByText('Cool-down')).toBeNull();

    fireEvent.click(screen.getByText('Update session'));

    const saved = onSave.mock.calls[0][1];
    expect(saved).toMatchObject({ type, distance, pace });
    expect(saved).not.toHaveProperty('warmup');
    expect(saved).not.toHaveProperty('cooldown');
  });
});

describe('SessionEditor target pace editing', () => {
  it('uses the full weekday in the screen header', () => {
    renderSessionEditor(intervalSession);

    expect(screen.getByText('Cancel').style.fontWeight).toBe('700');
    expect(screen.getByText('Tuesday')).toBeTruthy();
  });

  it('shows Training paces first and Custom pace options below', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={3}
        existing={{
          type: 'TEMPO',
          distance: 10,
          pace: '4:21',
          intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.threshold),
        }}
        trainingPaceProfile={profile}
        onSave={vi.fn()}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));

    expect(screen.getByText('Training paces')).toBeTruthy();
    expect(screen.getByText('Custom')).toBeTruthy();
    expect(screen.queryByText('Manual paces')).toBeNull();
    expect(screen.queryByText('Single pace')).toBeNull();
    expect(screen.queryByText('Range')).toBeNull();
    expect(screen.getByText('Threshold')).toBeTruthy();
    expect(screen.getByText('4:14-4:25/km · controlled hard')).toBeTruthy();
    expect(screen.getByText('4:15 /km')).toBeTruthy();
    expect(screen.getByText('Custom pace...')).toBeTruthy();
    expect(screen.getByText('Custom range...')).toBeTruthy();
  });

  it('offers Recovery as a Training pace for long runs without changing the default', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={6}
        existing={{
          type: 'LONG',
          distance: 18,
          pace: '5:40',
          intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.easy),
        }}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText('Easy · Training pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Target pace'));

    expect(screen.getByText('Recovery')).toBeTruthy();
    expect(screen.getByText(/very easy/)).toBeTruthy();

    fireEvent.click(screen.getByText('Recovery'));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      distance: 18,
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.recovery),
    }));
  });

  it('labels interval Training pace targets as Training paces', () => {
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
          intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.interval),
        }}
        trainingPaceProfile={profile}
        onSave={vi.fn()}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText('Interval · Training pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Rep target pace'));

    expect(screen.getByText('Training paces')).toBeTruthy();
    expect(screen.getAllByText('Interval').length).toBeGreaterThan(0);
    expect(screen.getByText('3:47-3:58/km · hard repeatable')).toBeTruthy();
  });

  it('refreshes profile-linked interval targets from the current Training pace profile on open', () => {
    const onSave = vi.fn();
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
          paceRange: { min: '3:47', max: '4:05' },
        },
      },
    };

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:59',
          intensityTarget: trainingPaceBandToIntensityTarget(beforeProfile.bands.interval),
        }}
        trainingPaceProfile={afterProfile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText(/6×800m · 3:47-4:05/)).toBeTruthy();
    expect(screen.getByText('3:47-4:05/km')).toBeTruthy();
    expect(screen.queryByText(/3:47-4:10\/km/)).toBeNull();

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      pace: '3:56',
      intensityTarget: trainingPaceBandToIntensityTarget(afterProfile.bands.interval),
    }));
  });

  it('shows profile band context and saves custom paces as manual targets', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={3}
        existing={{
          type: 'TEMPO',
          distance: 10,
          pace: '4:21',
          intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.threshold),
        }}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText('4:14-4:25/km')).toBeTruthy();
    expect(screen.queryByText('Threshold · profile pace')).toBeNull();
    expect(screen.getByText('Threshold · Training pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Target pace'));
    expect(screen.getAllByText('Threshold').length).toBeGreaterThan(0);
    expect(screen.getByText('4:14-4:25/km · controlled hard')).toBeTruthy();
    expect(screen.getByText('Race pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Custom pace...'));
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '4:08' },
    });
    fireEvent.blur(customInput);
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(3, expect.objectContaining({
      type: 'TEMPO',
      distance: 10,
      pace: '4:08',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '4:08',
      },
    }));
  });

  it('re-selects a profile chip to put the session back onto profile pace updates', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={3}
        existing={{
          type: 'TEMPO',
          distance: 10,
          pace: '4:08',
          intensityTarget: {
            source: 'manual',
            mode: 'pace',
            pace: '4:08',
          },
        }}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText('Custom pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('Threshold'));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(3, expect.objectContaining({
      type: 'TEMPO',
      distance: 10,
      pace: '4:20',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.threshold),
    }));
  });

  it('keeps manual single pace chips available alongside profile pace chips', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={3}
        existing={{
          type: 'TEMPO',
          distance: 10,
          pace: '4:21',
          intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.threshold),
        }}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));

    expect(screen.queryByText('Threshold · profile pace')).toBeNull();
    expect(screen.getByText('Threshold')).toBeTruthy();
    expect(screen.getByText('4:15 /km')).toBeTruthy();

    fireEvent.click(screen.getByText('4:15 /km'));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(3, expect.objectContaining({
      type: 'TEMPO',
      distance: 10,
      pace: '4:15',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        pace: '4:15',
      },
    }));
  });

  it('hides the sticky session action while a custom pace input is active', () => {
    render(
      <SessionEditor
        dayIndex={3}
        existing={{ type: 'TEMPO', distance: 10, pace: '4:21' }}
        onSave={vi.fn()}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('Custom pace...'));

    expect(screen.queryByText('Update session')).toBeNull();

    fireEvent.blur(screen.getByTestId('editable-chip-custom-input'));

    expect(screen.getByText('Update session')).toBeTruthy();
  });

  it('saves manual pace ranges from faster and slower boundaries', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
        }}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Rep target pace'));
    expect(screen.getAllByText('Interval').length).toBeGreaterThan(0);
    expect(screen.getByText('3:50 /km')).toBeTruthy();

    fireEvent.click(screen.getByText('Custom range...'));
    fireEvent.change(screen.getByTestId('session-editor-pace-range-faster'), {
      target: { value: '3:40' },
    });
    fireEvent.change(screen.getByTestId('session-editor-pace-range-slower'), {
      target: { value: '3:50' },
    });
    fireEvent.blur(screen.getByTestId('session-editor-pace-range-slower'));

    expect(screen.getByText('Custom range')).toBeTruthy();
    expect(screen.queryByText('Apply range')).toBeNull();

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'min', value: 1.5 },
      pace: '3:45',
      intensityTarget: {
        source: 'manual',
        mode: 'pace',
        paceRange: { min: '3:40', max: '3:50' },
      },
    }));
  });

  it('keeps the visible pace chip window stable for non-edge selections', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={3}
        existing={{
          type: 'TEMPO',
          distance: 10,
          pace: '4:21',
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('4:31 /km'));

    expect(screen.getByText('4:06 /km')).toBeTruthy();
    expect(screen.getByText('4:31 /km')).toBeTruthy();
    expect(screen.queryByText('4:46 /km')).toBeNull();
  });

  it('defaults newly added sessions to profile targets when a profile exists', () => {
    const onSave = vi.fn();
    const profile = deriveTrainingPaceProfile({
      raceDistance: '10K',
      targetTime: '00:45:00',
    });

    render(
      <SessionEditor
        dayIndex={0}
        existing={null}
        trainingPaceProfile={profile}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.getByText('5:24-5:46/km')).toBeTruthy();
    expect(screen.queryByText('Easy · profile pace')).toBeNull();
    expect(screen.getByText('Easy · Training pace')).toBeTruthy();

    fireEvent.click(screen.getByText('Add session'));

    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({
      type: 'EASY',
      pace: '5:35',
      intensityTarget: trainingPaceBandToIntensityTarget(profile.bands.easy),
    }));
  });

  it('saves a changed target pace for tempo sessions', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={3}
        existing={{ type: 'TEMPO', distance: 10, pace: '4:20' }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText('4:15 /km'));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(3, expect.objectContaining({
      type: 'TEMPO',
      distance: 10,
      pace: '4:15',
    }));
  });

  it('saves a custom target pace for interval sessions', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Rep target pace'));
    fireEvent.click(screen.getByText('Custom pace...'));
    expect(screen.queryByPlaceholderText('Custom pace')).toBeNull();
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '3:42' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('Custom pace...')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      reps: 6,
      repDist: 800,
      repDuration: { unit: 'km', value: 0.8 },
      recovery: { unit: 'min', value: 1.5 },
      pace: '3:42',
    }));
  });

  it.each([
    { type: 'EASY' as const, distance: 8, pace: '5:20', nextPace: '5:15' },
    { type: 'LONG' as const, distance: 16, pace: '5:10', nextPace: '5:05' },
  ])('saves a changed target pace for $type sessions', ({ type, distance, pace, nextPace }) => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={0}
        existing={{ type, distance, pace }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Target pace'));
    fireEvent.click(screen.getByText(`${nextPace} /km`));
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(0, expect.objectContaining({
      type,
      distance,
      pace: nextPace,
    }));
  });
});

describe('SessionEditor distance editing', () => {
  it('keeps a visible custom distance option for default long runs', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={6}
        existing={{ type: 'LONG', distance: 20, pace: '5:10' }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    fireEvent.click(screen.getByText('Distance'));

    expect(screen.getByText('20 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Custom...'));
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '21' },
    });
    fireEvent.blur(customInput);

    expect(screen.getByText('21 km')).toBeTruthy();
    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(6, expect.objectContaining({
      type: 'LONG',
      distance: 21,
      pace: '5:10',
    }));
  });
});

describe('SessionEditor interval notebook rows', () => {
  it('saves custom repetition duration and recovery without the old rep distance section', () => {
    const onSave = vi.fn();

    render(
      <SessionEditor
        dayIndex={1}
        existing={{
          type: 'INTERVAL',
          reps: 6,
          repDist: 800,
          recovery: '90s',
          pace: '3:50',
        }}
        onSave={onSave}
        onClose={vi.fn()}
        presentation="screen"
      />,
    );

    expect(screen.queryByText('Rep distance')).toBeNull();

    fireEvent.click(screen.getByText('Repetitions'));
    expect(screen.getByText('Rep length')).toBeTruthy();
    fireEvent.click(screen.getAllByText('MIN')[0]);
    fireEvent.click(screen.getByText('4 min'));

    fireEvent.click(screen.getByText('Recovery between reps'));
    fireEvent.click(screen.getByText('Custom...'));
    const customInput = screen.getByTestId('editable-chip-custom-input');
    fireEvent.change(customInput, {
      target: { value: '2.5' },
    });
    fireEvent.blur(customInput);

    fireEvent.click(screen.getByText('Update session'));

    expect(onSave).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'INTERVAL',
      reps: 6,
      repDuration: { unit: 'min', value: 4 },
      recovery: { unit: 'min', value: 2.5 },
      pace: '3:50',
    }));
    const saved = onSave.mock.calls[0][1] as Partial<PlannedSession>;
    expect(Object.prototype.hasOwnProperty.call(saved, 'repDist')).toBe(true);
    expect(saved.repDist).toBeUndefined();
  });
});
