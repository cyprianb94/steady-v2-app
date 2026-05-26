import { STEADY_AI_FREEZE_ACTIVE } from '@steady/types';
import { isScreenshotDemoMode } from '../demo/screenshot-demo';

export const PARKED_FEATURE_GATES = {
  recoveryUi: {
    normalApp: false,
    screenshotDemo: false,
  },
  steadyAi: {
    tabEntry: false,
    settingsEntry: false,
    homeNudge: false,
    conversationInput: false,
    llmCalls: false,
  },
  humanCoach: {
    settingsEntry: false,
  },
} as const;

export function isRecoveryUiEnabled(): boolean {
  return (
    PARKED_FEATURE_GATES.recoveryUi.normalApp
    || (PARKED_FEATURE_GATES.recoveryUi.screenshotDemo && isScreenshotDemoMode())
  );
}

export function shouldShowSteadyAiTab(): boolean {
  return !STEADY_AI_FREEZE_ACTIVE && PARKED_FEATURE_GATES.steadyAi.tabEntry;
}

export function shouldShowSteadyAiSettingsEntry(): boolean {
  return !STEADY_AI_FREEZE_ACTIVE && PARKED_FEATURE_GATES.steadyAi.settingsEntry;
}

export function shouldShowHomeSteadyAiNudge(): boolean {
  return !STEADY_AI_FREEZE_ACTIVE && PARKED_FEATURE_GATES.steadyAi.homeNudge;
}

export function shouldAllowSteadyAiConversationInput(): boolean {
  return !STEADY_AI_FREEZE_ACTIVE && PARKED_FEATURE_GATES.steadyAi.conversationInput;
}

export function shouldAllowSteadyAiLlmCalls(): boolean {
  return !STEADY_AI_FREEZE_ACTIVE && PARKED_FEATURE_GATES.steadyAi.llmCalls;
}

export function shouldShowHumanCoachSettingsEntry(): boolean {
  return PARKED_FEATURE_GATES.humanCoach.settingsEntry;
}
