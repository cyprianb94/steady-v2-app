import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import { C } from '../../constants/colours';

interface DragHandleProps {
  testID?: string;
  disabled?: boolean;
  active?: boolean;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onLongPress?: PressableProps['onLongPress'];
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchEnd?: PressableProps['onTouchEnd'];
  onMouseDown?: (event: { clientY: number; stopPropagation?: () => void }) => void;
  onMouseMove?: (event: { clientY: number; stopPropagation?: () => void }) => void;
  onMouseUp?: (event: { stopPropagation?: () => void }) => void;
}

export function DragHandle({
  testID,
  disabled = false,
  active = false,
  onTouchStart,
  onLongPress,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: DragHandleProps) {
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      delayLongPress={160}
      onPress={(event) => {
        event.stopPropagation?.();
      }}
      onTouchStart={disabled ? undefined : onTouchStart}
      onLongPress={disabled ? undefined : onLongPress}
      onTouchMove={disabled ? undefined : onTouchMove}
      onTouchEnd={disabled ? undefined : onTouchEnd}
      {...({
        onMouseDown: disabled ? undefined : onMouseDown,
        onMouseMove: disabled ? undefined : onMouseMove,
        onMouseUp: disabled ? undefined : onMouseUp,
      } as object)}
      style={[
        styles.handle,
        disabled && styles.handleDisabled,
        active && styles.handleActive,
      ]}
    >
      <View style={[styles.dot, disabled && styles.dotDisabled]} />
      <View style={[styles.dot, disabled && styles.dotDisabled]} />
      <View style={[styles.dot, disabled && styles.dotDisabled]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 28,
    minHeight: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  handleDisabled: {
    opacity: 0.45,
  },
  handleActive: {
    backgroundColor: `${C.clay}12`,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.muted,
  },
  dotDisabled: {
    backgroundColor: C.border,
  },
});
