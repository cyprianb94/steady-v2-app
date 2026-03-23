import React from 'react';
import { View, StyleSheet } from 'react-native';
import { C } from '../../constants/colours';
import { SESSION_TYPE } from '../../constants/session-types';
import type { SessionType } from '@steady/types';

interface SessionDotProps {
  type: SessionType;
  size?: number;
}

export function SessionDot({ type, size = 8 }: SessionDotProps) {
  const color = type === 'REST' ? C.border : SESSION_TYPE[type].color;
  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {},
});
