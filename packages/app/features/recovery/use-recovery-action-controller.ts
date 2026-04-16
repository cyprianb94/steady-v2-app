import { useState } from 'react';
import { Alert } from 'react-native';
import type { CrossTrainingEntry, Injury } from '@steady/types';
import { trpc } from '../../lib/trpc';
import { clearResumeWeekOverride, setResumeWeekOverride } from '../../lib/resume-week';

export type RecoveryResumeOption = { type: 'current' } | { type: 'choose'; weekNumber: number };
export type AdvanceRecoveryResult = 'advanced' | 'needs-resume' | 'idle' | 'failed';

interface AdvanceRecoveryStepOptions {
  activeInjury: Injury;
  today: string;
  updateInjury: (input: {
    rtrStep: number;
    rtrStepCompletedDates: string[];
    status: Injury['status'];
  }) => Promise<unknown>;
  refreshPlan: () => Promise<void>;
}

interface EndRecoveryOptions {
  planId: string;
  option: RecoveryResumeOption;
  clearInjury: () => Promise<unknown>;
  refreshPlan: () => Promise<void>;
  activeInjury?: Injury | null;
  completeCurrentStep?: boolean;
  today?: string | null;
  updateInjury?: (input: {
    rtrStep: number;
    rtrStepCompletedDates: string[];
    status: Injury['status'];
  }) => Promise<unknown>;
}

interface UseRecoveryActionControllerOptions {
  planId?: string | null;
  activeInjury?: Injury | null;
  today?: string | null;
  refreshPlan: () => Promise<void>;
  refreshCrossTraining?: () => Promise<void>;
}

interface UseRecoveryActionControllerResult {
  isSavingGoal: boolean;
  isSavingCrossTraining: boolean;
  deletingEntryId: string | null;
  isUpdatingRtr: boolean;
  isStartingRecovery: boolean;
  isEndingRecovery: boolean;
  isMutatingRecovery: boolean;
  saveReassessedTarget: (value: string) => Promise<boolean>;
  addCrossTraining: (input: {
    date: string;
    type: CrossTrainingEntry['type'];
    durationMinutes: number;
  }) => Promise<boolean>;
  deleteCrossTraining: (id: string) => Promise<boolean>;
  advanceReturnToRun: () => Promise<AdvanceRecoveryResult>;
  markInjury: (name: string) => Promise<boolean>;
  endRecovery: (options: {
    option: RecoveryResumeOption;
    completeCurrentStep?: boolean;
  }) => Promise<boolean>;
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
  refreshPlan,
}: AdvanceRecoveryStepOptions) {
  await updateInjury({
    rtrStep: activeInjury.rtrStep + 1,
    rtrStepCompletedDates: buildCompletionDates(activeInjury, today),
    status: 'returning',
  });
  await refreshPlan();
}

export async function endRecovery({
  planId,
  option,
  clearInjury,
  refreshPlan,
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
  await refreshPlan();
}

export function useRecoveryActionController({
  planId,
  activeInjury = null,
  today = null,
  refreshPlan,
  refreshCrossTraining,
}: UseRecoveryActionControllerOptions): UseRecoveryActionControllerResult {
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [isSavingCrossTraining, setIsSavingCrossTraining] = useState(false);
  const [deletingEntryId, setDeletingEntryId] = useState<string | null>(null);
  const [isUpdatingRtr, setIsUpdatingRtr] = useState(false);
  const [isStartingRecovery, setIsStartingRecovery] = useState(false);
  const [isEndingRecovery, setIsEndingRecovery] = useState(false);

  async function saveReassessedTarget(value: string): Promise<boolean> {
    try {
      setIsSavingGoal(true);
      await trpc.plan.updateInjury.mutate({ reassessedTarget: value });
      await refreshPlan();
      return true;
    } catch (error) {
      console.error('Failed to update reassessed target:', error);
      Alert.alert('Could not update goal', 'Please try again in a moment.');
      return false;
    } finally {
      setIsSavingGoal(false);
    }
  }

  async function addCrossTraining(input: {
    date: string;
    type: CrossTrainingEntry['type'];
    durationMinutes: number;
  }): Promise<boolean> {
    try {
      setIsSavingCrossTraining(true);
      await trpc.crossTraining.log.mutate(input);
      await refreshCrossTraining?.();
      return true;
    } catch (error) {
      console.error('Failed to save cross-training entry:', error);
      Alert.alert('Could not save entry', 'Please try again in a moment.');
      return false;
    } finally {
      setIsSavingCrossTraining(false);
    }
  }

  async function deleteCrossTraining(id: string): Promise<boolean> {
    try {
      setDeletingEntryId(id);
      await trpc.crossTraining.delete.mutate({ id });
      await refreshCrossTraining?.();
      return true;
    } catch (error) {
      console.error('Failed to delete cross-training entry:', error);
      Alert.alert('Could not delete entry', 'Please try again in a moment.');
      return false;
    } finally {
      setDeletingEntryId(null);
    }
  }

  async function advanceReturnToRun(): Promise<AdvanceRecoveryResult> {
    if (!activeInjury || !today) {
      return 'idle';
    }

    if (activeInjury.rtrStep >= 3) {
      return 'needs-resume';
    }

    try {
      setIsUpdatingRtr(true);
      await advanceRecoveryStep({
        activeInjury,
        today,
        updateInjury: trpc.plan.updateInjury.mutate,
        refreshPlan,
      });
      return 'advanced';
    } catch (error) {
      console.error('Failed to update return-to-running progress:', error);
      Alert.alert('Could not update progress', 'Please try again in a moment.');
      return 'failed';
    } finally {
      setIsUpdatingRtr(false);
    }
  }

  async function markInjury(name: string): Promise<boolean> {
    try {
      setIsStartingRecovery(true);
      await trpc.plan.markInjury.mutate({ name });
      await refreshPlan();
      return true;
    } catch (error) {
      console.error('Failed to start recovery:', error);
      Alert.alert('Could not start recovery', 'Please try again in a moment.');
      return false;
    } finally {
      setIsStartingRecovery(false);
    }
  }

  async function handleEndRecovery({
    option,
    completeCurrentStep = false,
  }: {
    option: RecoveryResumeOption;
    completeCurrentStep?: boolean;
  }): Promise<boolean> {
    if (!planId) {
      return false;
    }

    try {
      setIsEndingRecovery(true);
      await endRecovery({
        planId,
        option,
        clearInjury: () => trpc.plan.clearInjury.mutate(),
        refreshPlan,
        activeInjury,
        completeCurrentStep,
        today,
        updateInjury: trpc.plan.updateInjury.mutate,
      });
      return true;
    } catch (error) {
      console.error('Failed to end recovery:', error);
      Alert.alert('Could not end recovery', 'Please try again in a moment.');
      return false;
    } finally {
      setIsEndingRecovery(false);
    }
  }

  return {
    isSavingGoal,
    isSavingCrossTraining,
    deletingEntryId,
    isUpdatingRtr,
    isStartingRecovery,
    isEndingRecovery,
    isMutatingRecovery: isStartingRecovery || isEndingRecovery,
    saveReassessedTarget,
    addCrossTraining,
    deleteCrossTraining,
    advanceReturnToRun,
    markInjury,
    endRecovery: handleEndRecovery,
  };
}
