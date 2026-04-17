import React from 'react';
import { TextInput, TouchableOpacity, View } from 'react-native';

export function GestureHandlerRootView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={style}>{children}</View>;
}

export { TextInput, TouchableOpacity };
