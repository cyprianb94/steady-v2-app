import type { Injury, TrainingPlanWithAnnotation } from '@steady/types';
import { isScreenshotDemoMode } from '../../demo/screenshot-demo';

export const MVP_RECOVERY_UI_ENABLED = isScreenshotDemoMode();

// TODO(STV2-99): Re-enable the parked injury/recovery screen integrations once the post-MVP slice is hardened.
export function getVisibleActiveInjury(plan: TrainingPlanWithAnnotation | null): Injury | null {
  if (!MVP_RECOVERY_UI_ENABLED) {
    return null;
  }

  const activeInjury = plan?.activeInjury ?? null;
  return activeInjury && activeInjury.status !== 'resolved' ? activeInjury : null;
}

export function getVisibleHistoricalInjury(plan: TrainingPlanWithAnnotation | null): Injury | null {
  if (!MVP_RECOVERY_UI_ENABLED) {
    return null;
  }

  return plan?.activeInjury ?? null;
}
