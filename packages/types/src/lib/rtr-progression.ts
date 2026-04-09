import type { Injury } from '../injury';

export interface RtrStepDefinition {
  index: number;
  label: string;
  suggestedSession: string;
}

export interface RtrProgressionStep extends RtrStepDefinition {
  isCurrent: boolean;
  isComplete: boolean;
  completedDate?: string;
}

export interface RtrProgression {
  currentStepIndex: number;
  isComplete: boolean;
  steps: RtrProgressionStep[];
}

export const RTR_STEPS: RtrStepDefinition[] = [
  { index: 0, label: 'Walk/Jog', suggestedSession: '3km' },
  { index: 1, label: 'Easy short', suggestedSession: '5km at easy pace' },
  { index: 2, label: 'Easy normal', suggestedSession: '8km at easy pace' },
  { index: 3, label: 'Resume plan', suggestedSession: 'Return to training plan' },
];

export function getRtrProgression(injury: Injury): RtrProgression {
  const completedDates = injury.rtrStepCompletedDates ?? [];
  const normalizedStep = Number.isFinite(injury.rtrStep)
    ? Math.max(0, Math.min(Math.floor(injury.rtrStep), RTR_STEPS.length))
    : 0;

  const isComplete =
    normalizedStep >= RTR_STEPS.length ||
    RTR_STEPS.every((step) => Boolean(completedDates[step.index]));

  const currentStepIndex = isComplete
    ? RTR_STEPS.length - 1
    : Math.min(normalizedStep, RTR_STEPS.length - 1);

  return {
    currentStepIndex,
    isComplete,
    steps: RTR_STEPS.map((step) => {
      const completedDate = completedDates[step.index];
      return {
        ...step,
        completedDate,
        isComplete: Boolean(completedDate) || normalizedStep > step.index,
        isCurrent: !isComplete && step.index === currentStepIndex,
      };
    }),
  };
}
