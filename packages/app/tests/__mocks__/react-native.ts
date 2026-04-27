import React from 'react';

function resolveStyle(style: any): any {
  if (typeof style?.value === 'number') return style.value;
  if (typeof style === 'function') return resolveStyle(style({ pressed: false }));
  if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean).map(resolveStyle));
  if (!style) return {};
  if (typeof style !== 'object') return style;
  if (Array.isArray(style.transform)) {
    return {
      ...style,
      transform: style.transform
        .map((part: any) => {
          if ('translateY' in part) {
            const value = resolveStyle(part.translateY);
            return `translateY(${Number(value) || 0}px)`;
          }
          if ('scaleX' in part) {
            const value = resolveStyle(part.scaleX);
            return `scaleX(${Number(value) || 0})`;
          }
          return '';
        })
        .filter(Boolean)
        .join(' '),
    };
  }
  return Object.fromEntries(
    Object.entries(style).map(([key, value]) => [key, resolveStyle(value)]),
  );
}

function createMockComponent(tag: string) {
  return function MockComponent({ testID, children, style, ...props }: any) {
    const resolved = style ? resolveStyle(style) : undefined;
    const {
      accessibilityRole: _accessibilityRole,
      accessibilityLabel: _accessibilityLabel,
      accessibilityState: _accessibilityState,
      accessibilityIgnoresInvertColors: _accessibilityIgnoresInvertColors,
      delayLongPress: _delayLongPress,
      numberOfLines: _numberOfLines,
      onLayout: _onLayout,
      onPress,
      onPressIn,
      onPressOut,
      onLongPress,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onStartShouldSetResponder,
      onMoveShouldSetResponder: _onMoveShouldSetResponder,
      onResponderTerminationRequest: _onResponderTerminationRequest,
      onResponderGrant,
      onResponderMove,
      onResponderRelease,
      onResponderTerminate: _onResponderTerminate,
      ...rest
    } = props;
    const nativeEvent = (event: any) => {
      const pageX = event.clientX ?? event.pageX ?? 0;
      const pageY = event.clientY ?? event.pageY ?? 0;

      return {
        nativeEvent: {
          locationX: pageX,
          locationY: pageY,
          pageX,
          pageY,
        },
      };
    };

    return React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-rn': tag,
        style: resolved,
        onClick: onPress,
        onMouseDown: (event: any) => {
          const rnEvent = nativeEvent(event);
          onPressIn?.(rnEvent);
          onTouchStart?.(rnEvent);
          const wantsResponder = onStartShouldSetResponder
            ? onStartShouldSetResponder(rnEvent)
            : Boolean(onResponderGrant);
          if (wantsResponder) {
            onResponderGrant?.(rnEvent);
          }
          onLongPress?.(rnEvent);
        },
        onMouseMove: (event: any) => {
          const rnEvent = nativeEvent(event);
          onTouchMove?.(rnEvent);
          onResponderMove?.(rnEvent);
        },
        onMouseUp: (event: any) => {
          const rnEvent = nativeEvent(event);
          onTouchEnd?.(rnEvent);
          onResponderRelease?.(rnEvent);
          onPressOut?.(rnEvent);
        },
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

  stopAnimation() {}

  interpolate({ inputRange, outputRange }: { inputRange: number[]; outputRange: any[] }) {
    const [inputStart, inputEnd] = inputRange;
    const [outputStart, outputEnd] = outputRange;
    const ratio = inputEnd === inputStart ? 0 : (this.value - inputStart) / (inputEnd - inputStart);

    if (typeof outputStart === 'number' && typeof outputEnd === 'number') {
      return { value: outputStart + ((outputEnd - outputStart) * ratio) };
    }

    return { value: ratio >= 1 ? outputEnd : outputStart };
  }
}

export const View = createMockComponent('View');
export const Text = createMockComponent('Text');
export const ActivityIndicator = createMockComponent('ActivityIndicator');
export const RefreshControl = createMockComponent('RefreshControl');
export const Image = createMockComponent('Image');
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
    keyboardType: _keyboardType,
    selectTextOnFocus: _selectTextOnFocus,
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
  { testID, children, style, contentContainerStyle: _contentContainerStyle, showsVerticalScrollIndicator: _showsVerticalScrollIndicator, snapToInterval: _snapToInterval, decelerationRate: _decelerationRate, nestedScrollEnabled: _nestedScrollEnabled, scrollEnabled: _scrollEnabled, keyboardDismissMode: _keyboardDismissMode, keyboardShouldPersistTaps: _keyboardShouldPersistTaps, onMomentumScrollEnd: _onMomentumScrollEnd, refreshControl: _refreshControl, ...props }: any,
  ref: any,
) {
  const resolved = style ? resolveStyle(style) : undefined;
  React.useImperativeHandle(ref, () => ({
    scrollTo: () => {},
    scrollToEnd: () => {},
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
  timing: (value: AnimatedValue, config: { toValue: number }) => ({
    start: (callback?: (result: { finished: boolean }) => void) => {
      value.setValue(config.toValue);
      callback?.({ finished: true });
    },
  }),
};
export const Easing = {
  cubic: (value: number) => value,
  out: (fn: (value: number) => number) => fn,
  in: (fn: (value: number) => number) => fn,
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
export const AccessibilityInfo = {
  isReduceMotionEnabled: () => Promise.resolve(false),
  addEventListener: () => ({
    remove: () => {},
  }),
};
