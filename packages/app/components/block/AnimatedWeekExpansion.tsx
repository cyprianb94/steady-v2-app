import React from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { C } from '../../constants/colours';

interface AnimatedWeekExpansionProps {
  children: React.ReactNode;
  expanded: boolean;
  showDivider?: boolean;
  onCollapseEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

const EXPAND_DURATION_MS = 200;
const COLLAPSE_DURATION_MS = 130;
const EXPANDED_MARGIN_TOP = 12;
const EXPANDED_PADDING_TOP = 10;
const EXPANDED_TRANSLATE_Y = -4;

export function AnimatedWeekExpansion({
  children,
  expanded,
  showDivider = true,
  onCollapseEnd,
  style,
}: AnimatedWeekExpansionProps) {
  const progress = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  const [measuredHeight, setMeasuredHeight] = React.useState(0);

  React.useEffect(() => {
    if (expanded && measuredHeight <= 0) {
      return;
    }

    if (!expanded && measuredHeight <= 0) {
      onCollapseEnd?.();
      return;
    }

    progress.value = withTiming(
      expanded ? 1 : 0,
      {
        duration: expanded ? EXPAND_DURATION_MS : COLLAPSE_DURATION_MS,
        easing: expanded ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      },
      (finished) => {
        if (finished && !expanded && onCollapseEnd) {
          runOnJS(onCollapseEnd)();
        }
      },
    );
  }, [expanded, measuredHeight, onCollapseEnd, progress]);

  const revealStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: expanded
      ? progress.value
      : interpolate(progress.value, [0, 0.08, 1], [0, 1, 1]),
    marginTop: EXPANDED_MARGIN_TOP * progress.value,
    paddingTop: showDivider ? EXPANDED_PADDING_TOP * progress.value : 0,
    borderTopWidth: showDivider ? progress.value : 0,
    borderTopColor: C.border,
    overflow: 'hidden',
    transform: [
      {
        translateY: interpolate(progress.value, [0, 1], [EXPANDED_TRANSLATE_Y, 0]),
      },
    ],
  }), [expanded, showDivider]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextHeight = event.nativeEvent.layout.height;
    if (nextHeight > 0) {
      contentHeight.value = nextHeight;
      setMeasuredHeight((current) => (
        Math.abs(current - nextHeight) > 0.5 ? nextHeight : current
      ));
    }
  }

  return (
    <Animated.View
      pointerEvents={expanded ? 'auto' : 'none'}
      style={[style, revealStyle]}
    >
      <View
        onLayout={handleLayout}
        style={[
          styles.content,
          expanded && measuredHeight <= 0 && styles.measuringContent,
        ]}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 10,
  },
  measuringContent: {
    position: 'absolute',
    left: 0,
    right: 0,
    opacity: 0,
  },
});
