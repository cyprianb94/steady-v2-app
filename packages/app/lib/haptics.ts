import * as Haptics from 'expo-haptics';

export function triggerSelectionHaptic() {
  void Haptics.selectionAsync().catch(() => undefined);
}
