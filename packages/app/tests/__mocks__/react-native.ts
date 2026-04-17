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
      accessibilityRole: _accessibilityRole,
      delayLongPress: _delayLongPress,
      numberOfLines: _numberOfLines,
      onLayout: _onLayout,
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
export const ActivityIndicator = createMockComponent('ActivityIndicator');
export const RefreshControl = createMockComponent('RefreshControl');
export const TouchableOpacity = createMockComponent('TouchableOpacity');
export const TouchableHighlight = createMockComponent('TouchableHighlight');
export const TouchableWithoutFeedback = createMockComponent('TouchableWithoutFeedback');
export const Pressable = createMockComponent('Pressable');
export const FlatList = createMockComponent('FlatList');
export const SectionList = createMockComponent('SectionList');
export const VirtualizedList = createMockComponent('VirtualizedList');
export const KeyboardAvoidingView = createMockComponent('KeyboardAvoidingView');

export const TextInput = React.forwardRef(function MockTextInput(
  {
    testID,
    style,
    value,
    defaultValue,
    placeholder,
    editable = true,
    multiline,
    onChangeText,
    onSubmitEditing,
    onFocus,
    onBlur,
    selectionColor: _selectionColor,
    placeholderTextColor: _placeholderTextColor,
    returnKeyType: _returnKeyType,
    blurOnSubmit: _blurOnSubmit,
    ...props
  }: any,
  ref: any,
) {
  const resolved = style ? resolveStyle(style) : undefined;
  const tag = multiline ? 'textarea' : 'input';

  return React.createElement(tag, {
    ref,
    'data-testid': testID,
    'data-rn': 'TextInput',
    style: resolved,
    value,
    defaultValue,
    placeholder,
    disabled: editable === false,
    onFocus,
    onBlur,
    onChange: (event: any) => onChangeText?.(event.target.value),
    onKeyDown: (event: any) => {
      if (event.key === 'Enter') {
        onSubmitEditing?.({ nativeEvent: { text: event.currentTarget.value } });
      }
    },
    ...props,
  });
});

export const ScrollView = React.forwardRef(function MockScrollView(
  { testID, children, style, contentContainerStyle: _contentContainerStyle, showsVerticalScrollIndicator: _showsVerticalScrollIndicator, snapToInterval: _snapToInterval, decelerationRate: _decelerationRate, nestedScrollEnabled: _nestedScrollEnabled, scrollEnabled: _scrollEnabled, onMomentumScrollEnd: _onMomentumScrollEnd, refreshControl: _refreshControl, ...props }: any,
  ref: any,
) {
  const resolved = style ? resolveStyle(style) : undefined;
  React.useImperativeHandle(ref, () => ({
    scrollTo: () => {},
  }));

  return React.createElement(
    'div',
    {
      'data-testid': testID,
      'data-rn': 'ScrollView',
      style: resolved,
      ...props,
    },
    children,
  );
});
export const Animated = {
  Value: AnimatedValue,
  View: createMockComponent('Animated.View'),
};
export const NativeModules = {
  BlobModule: {},
  SourceCode: {
    scriptURL: undefined,
  },
};

export function Modal({
  visible,
  children,
  animationType: _animationType,
  transparent: _transparent,
  onRequestClose: _onRequestClose,
  ...props
}: any) {
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
  absoluteFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
};
export const Platform = { OS: 'ios', select: (obj: any) => obj.ios ?? obj.default };
export const Dimensions = {
  get: () => ({ width: 390, height: 844 }),
};
export const AppState = {
  currentState: 'active',
  addEventListener: () => ({
    remove: () => {},
  }),
};
