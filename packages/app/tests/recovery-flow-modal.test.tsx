import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RecoveryFlowModal } from '../components/recovery/RecoveryFlowModal';

const plan = {
  id: 'plan-1',
  raceDate: '2026-09-20',
  phases: {},
  weeks: [
    { weekNumber: 1, phase: 'BASE', sessions: [null, null, null, null, null, null, null], plannedKm: 32 },
    { weekNumber: 2, phase: 'BUILD', sessions: [null, null, null, null, null, null, null], plannedKm: 40 },
  ],
} as any;

describe('RecoveryFlowModal', () => {
  it('wraps the injury flow in a keyboard-avoiding frame', () => {
    render(
      <RecoveryFlowModal
        visible={true}
        mode="mark"
        plan={plan}
        currentWeekNumber={2}
        onClose={vi.fn()}
        onMarkInjury={vi.fn()}
        onEndRecovery={vi.fn()}
      />,
    );

    expect(screen.getByTestId('recovery-keyboard-frame')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. Calf strain')).toBeTruthy();
  });

  it('trims the injury name before starting recovery', async () => {
    const onMarkInjury = vi.fn();

    render(
      <RecoveryFlowModal
        visible={true}
        mode="mark"
        plan={plan}
        currentWeekNumber={2}
        onClose={vi.fn()}
        onMarkInjury={onMarkInjury}
        onEndRecovery={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('e.g. Calf strain'), {
      target: { value: '  Calf strain  ' },
    });
    fireEvent.click(screen.getByText('Start recovery'));

    await waitFor(() => {
      expect(onMarkInjury).toHaveBeenCalledWith('Calf strain');
    });
  });
});
