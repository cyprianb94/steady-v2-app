import type { Injury } from '@steady/types';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';

type RecoveryResumeOption = { type: 'current' } | { type: 'choose'; weekNumber: number };

interface AdvanceRecoveryStepOptions {
  activeInjury: Injury;
  today: string;
  updateInjury: (input: {
    rtrStep: number;
    rtrStepCompletedDates: string[];
    status: Injury['status'];
  }) => Promise<unknown>;
  refresh: () => Promise<void>;
}

interface EndRecoveryOptions {
  planId: string;
  option: RecoveryResumeOption;
  clearInjury: () => Promise<unknown>;
  refresh: () => Promise<void>;
  activeInjury?: Injury | null;
  completeCurrentStep?: boolean;
  today?: string;
  updateInjury?: (input: {
    rtrStep: number;
    rtrStepCompletedDates: string[];
    status: Injury['status'];
  }) => Promise<unknown>;
}

function buildCompletionDates(activeInjury: Injury, today: string) {
  const completionDates = [...activeInjury.rtrStepCompletedDates];
  completionDates[activeInjury.rtrStep] = today;
  return completionDates;
}

export async function advanceRecoveryStep({
  activeInjury,
  today,
  updateInjury,
  refresh,
}: AdvanceRecoveryStepOptions) {
  await updateInjury({
    rtrStep: activeInjury.rtrStep + 1,
    rtrStepCompletedDates: buildCompletionDates(activeInjury, today),
    status: 'returning',
  });
  await refresh();
}

export async function endRecovery({
  planId,
  option,
  clearInjury,
  refresh,
  activeInjury = null,
  completeCurrentStep = false,
  today,
  updateInjury,
}: EndRecoveryOptions) {
  if (option.type === 'current') {
    await clearResumeWeekOverride(planId);
  } else {
    await setResumeWeekOverride(planId, option.weekNumber);
  }

  if (completeCurrentStep && activeInjury && today && updateInjury) {
    await updateInjury({
      rtrStep: activeInjury.rtrStep + 1,
      rtrStepCompletedDates: buildCompletionDates(activeInjury, today),
      status: 'returning',
    });
  }

  await clearInjury();
  await refresh();
}
