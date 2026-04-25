import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface AnimatedProgressFillProps {
  progress: number;
  fillStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(1, progress));
}

export function AnimatedProgressFill({
  progress,
  fillStyle,
  testID,
}: AnimatedProgressFillProps) {
  const reducedMotion = useReducedMotion();
  const clampedProgress = clampProgress(progress);
  const animatedProgress = useRef(new Animated.Value(clampedProgress)).current;
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    if (reducedMotion) {
      animatedProgress.setValue(clampedProgress);
      return;
    }

    Animated.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, clampedProgress, reducedMotion]);

  const animatedWidth = useMemo(
    () => animatedProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, trackWidth],
      extrapolate: 'clamp',
    }),
    [animatedProgress, trackWidth],
  );

  function handleLayout(event: LayoutChangeEvent) {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth > 0 && nextWidth !== trackWidth) {
      setTrackWidth(nextWidth);
    }
  }

  return (
    <View onLayout={handleLayout} style={styles.frame} testID={testID}>
      {trackWidth > 0 ? (
        <Animated.View
          style={[
            styles.fill,
            fillStyle,
            { width: animatedWidth },
          ]}
        />
      ) : (
        <View
          style={[
            styles.fill,
            fillStyle,
            { width: `${clampedProgress * 100}%` },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    height: '100%',
  },
  fill: {
    height: '100%',
  },
});
