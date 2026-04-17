import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import { C } from '../../constants/colours';

const HANDLE_BAR_WIDTHS = Platform.select({
  android: [16, 16],
  default: [18, 18, 18],
}) as number[];

interface DragHandleProps {
  testID?: string;
  disabled?: boolean;
  active?: boolean;
  onTouchStart?: (event: GestureResponderEvent) => void;
  onLongPress?: PressableProps['onLongPress'];
  onTouchMove?: (event: GestureResponderEvent) => void;
  onTouchCancel?: (event: GestureResponderEvent) => void;
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
  onTouchCancel,
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
      onTouchCancel={disabled ? undefined : onTouchCancel}
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
      {HANDLE_BAR_WIDTHS.map((width, index) => (
        <View
          key={index}
          style={[
            styles.bar,
            { width },
            disabled && styles.barDisabled,
          ]}
        />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 38,
    minHeight: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginRight: 2,
  },
  handleDisabled: {
    opacity: 0.45,
  },
  handleActive: {
    backgroundColor: `${C.clay}12`,
  },
  bar: {
    height: 2.5,
    borderRadius: 999,
    backgroundColor: C.muted,
  },
  barDisabled: {
    backgroundColor: C.border,
  },
});
