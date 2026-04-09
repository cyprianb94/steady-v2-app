import React from 'react';

function resolveStyle(style: any): any {
  if (typeof style === 'function') return resolveStyle(style({ pressed: false }));
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(resolveStyle));
  return style ?? {};
}

function createMockComponent(tag: string) {
  return function MockComponent({ testID, children, style, ...props }: any) {
    const resolved = style ? resolveStyle(style) : undefined;
    const { onPress, ...rest } = props;
    return React.createElement(
      'div',
      { 'data-testid': testID, 'data-rn': tag, style: resolved, onClick: onPress, ...rest },
      children,
    );
  };
}

export const View = createMockComponent('View');
export const Text = createMockComponent('Text');
export const ScrollView = createMockComponent('ScrollView');
export const ActivityIndicator = createMockComponent('ActivityIndicator');
export const TouchableOpacity = createMockComponent('TouchableOpacity');
export const Pressable = createMockComponent('Pressable');
export const FlatList = createMockComponent('FlatList');

export function Modal({ visible, children, ...props }: any) {
  if (!visible) return null;
  return React.createElement('div', { 'data-rn': 'Modal', ...props }, children);
}
export const Alert = { alert: () => {} };
export const LayoutAnimation = {
  configureNext: () => {},
  Presets: { easeInEaseOut: {} },
};
export const UIManager = {
  setLayoutAnimationEnabledExperimental: () => {},
};
export const StyleSheet = {
  create: <T extends Record<string, any>>(styles: T): T => styles,
};
export const Platform = { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default };
