import * as Haptics from 'expo-haptics';

function safelyTrigger(trigger: () => Promise<void>) {
  void trigger().catch(() => undefined);
}

export function triggerSelectionChangeHaptic() {
  safelyTrigger(() => Haptics.selectionAsync());
}

export function triggerSegmentTickHaptic() {
  safelyTrigger(() => Haptics.selectionAsync());
}

export function triggerDragStartHaptic() {
  safelyTrigger(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function triggerDragSlotHaptic() {
  safelyTrigger(() => Haptics.selectionAsync());
}
