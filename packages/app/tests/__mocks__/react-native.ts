import React from 'react';

function resolveStyle(style: any): any {
  if (typeof style === 'function') return resolveStyle(style({ pressed: false }));
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(resolveStyle));
  if (!style) return {};
  if (Array.isArray(style.transform)) {
    return {
      ...style,
      transform: style.transform
        .map((part: any) => {
          if ('translateY' in part) {
            const value = typeof part.translateY?.value === 'number' ? part.translateY.value : part.translateY;
            return `translateY(${Number(value) || 0}px)`;
          }
          return '';
        })
        .filter(Boolean)
        .join(' '),
    };
  }
  return style;
}

function createMockComponent(tag: string) {
  return function MockComponent({ testID, children, style, ...props }: any) {
    const resolved = style ? resolveStyle(style) : undefined;
    const {
      delayLongPress: _delayLongPress,
      onPress,
      onLongPress,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      ...rest
    } = props;
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-rn': tag,
        style: resolved,
        onClick: onPress,
        onMouseDown: (event: any) => {
          onTouchStart?.({ nativeEvent: { pageY: event.clientY ?? 0 } });
          onLongPress?.({ nativeEvent: { pageY: event.clientY ?? 0 } });
        },
        onMouseMove: (event: any) => onTouchMove?.({ nativeEvent: { pageY: event.clientY ?? 0 } }),
        onMouseUp: (event: any) => onTouchEnd?.({ nativeEvent: { pageY: event.clientY ?? 0 } }),
        ...rest,
      },
      children,
    );
  };
}

class AnimatedValue {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  setValue(value: number) {
    this.value = value;
  }
}

export const View = createMockComponent('View');
export const Text = createMockComponent('Text');
export const ScrollView = createMockComponent('ScrollView');
export const ActivityIndicator = createMockComponent('ActivityIndicator');
export const TouchableOpacity = createMockComponent('TouchableOpacity');
export const Pressable = createMockComponent('Pressable');
export const FlatList = createMockComponent('FlatList');
export const Animated = {
  Value: AnimatedValue,
  View: createMockComponent('Animated.View'),
};

export function Modal({ visible, children, animationType: _animationType, transparent: _transparent, ...props }: any) {
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
