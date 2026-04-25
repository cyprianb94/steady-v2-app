import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colours';
import { FONTS } from '../constants/typography';
import { useReducedMotion } from '../hooks/useReducedMotion';

type ToastTone = 'success' | 'error' | 'neutral';

interface ToastState {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function toneStyles(tone: ToastTone) {
  switch (tone) {
    case 'success':
      return {
        backgroundColor: C.forest,
        textColor: C.surface,
      };
    case 'error':
      return {
        backgroundColor: C.clay,
        textColor: C.surface,
      };
    default:
      return {
        backgroundColor: C.ink,
        textColor: C.surface,
      };
  }
}

export function ToastProvider({ children }: React.PropsWithChildren) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    if (!toast) return;
    const id = toast.id;

    opacity.stopAnimation();
    translateY.stopAnimation();

    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
    } else {
      opacity.setValue(0);
      translateY.setValue(-8);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    const timeoutId = setTimeout(() => {
      if (reducedMotion) {
        setToast((current) => (current?.id === id ? null : current));
        return;
      }

      Animated.timing(opacity, {
        toValue: 0,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setToast((current) => (current?.id === id ? null : current));
      });
      Animated.timing(translateY, {
        toValue: -6,
        duration: 160,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, 2800);

    return () => clearTimeout(timeoutId);
  }, [opacity, reducedMotion, toast, translateY]);

  return (
    <ToastContext.Provider
      value={{
        showToast(message, tone = 'neutral') {
          setToast({
            id: Date.now(),
            message,
            tone,
          });
        },
      }}
    >
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrapper,
            {
              top: insets.top + 12,
            },
            {
              opacity,
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              { backgroundColor: toneStyles(toast.tone).backgroundColor },
            ]}
          >
            <Text style={[styles.message, { color: toneStyles(toast.tone).textColor }]}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return value;
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 100,
  },
  toast: {
    maxWidth: 420,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  message: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 13,
    lineHeight: 18,
  },
});
