import React from 'react';
import { Image, type ImageSourcePropType, type StyleProp, type ImageStyle } from 'react-native';

export type RunStatusIconStatus = 'completed' | 'varied' | 'missed';

const STATUS_ASSETS: Record<RunStatusIconStatus, ImageSourcePropType> = {
  completed: require('../../assets/run-status/run-status-completed.png'),
  varied: require('../../assets/run-status/run-status-varied.png'),
  missed: require('../../assets/run-status/run-status-missed.png'),
};

const STATUS_LABELS: Record<RunStatusIconStatus, string> = {
  completed: 'Completed run',
  varied: 'Varied run',
  missed: 'Unfinished run',
};

interface RunStatusIconProps {
  status: RunStatusIconStatus;
  size?: number;
  testID?: string;
  style?: StyleProp<ImageStyle>;
}

export function RunStatusIcon({ status, size = 18, testID, style }: RunStatusIconProps) {
  return (
    <Image
      accessibilityIgnoresInvertColors
      accessibilityLabel={STATUS_LABELS[status]}
      accessibilityRole="image"
      source={STATUS_ASSETS[status]}
      style={[{ width: size, height: size }, style]}
      testID={testID}
    />
  );
}
