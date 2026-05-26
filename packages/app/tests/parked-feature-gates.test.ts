import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsScreenshotDemoMode = vi.hoisted(() => vi.fn());

describe('parked feature gates', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockIsScreenshotDemoMode.mockReturnValue(false);
    vi.doMock('../demo/screenshot-demo', () => ({
      isScreenshotDemoMode: mockIsScreenshotDemoMode,
    }));
  });

  it('keeps Steady AI entry points parked even if the shared freeze flag is lifted alone', async () => {
    vi.doMock('@steady/types', () => ({
      STEADY_AI_FREEZE_ACTIVE: false,
    }));

    const {
      shouldAllowSteadyAiConversationInput,
      shouldAllowSteadyAiLlmCalls,
      shouldShowHumanCoachSettingsEntry,
      shouldShowHomeSteadyAiNudge,
      shouldShowSteadyAiSettingsEntry,
      shouldShowSteadyAiTab,
    } = await import('../features/parked-feature-gates');

    expect(shouldShowSteadyAiTab()).toBe(false);
    expect(shouldShowSteadyAiSettingsEntry()).toBe(false);
    expect(shouldShowHomeSteadyAiNudge()).toBe(false);
    expect(shouldAllowSteadyAiConversationInput()).toBe(false);
    expect(shouldAllowSteadyAiLlmCalls()).toBe(false);
    expect(shouldShowHumanCoachSettingsEntry()).toBe(false);
  });

  it('keeps recovery hidden in normal mode and screenshot demo mode', async () => {
    vi.doMock('@steady/types', () => ({
      STEADY_AI_FREEZE_ACTIVE: true,
    }));
    const { isRecoveryUiEnabled } = await import('../features/parked-feature-gates');

    expect(isRecoveryUiEnabled()).toBe(false);

    mockIsScreenshotDemoMode.mockReturnValue(true);

    expect(isRecoveryUiEnabled()).toBe(false);
  });
});
