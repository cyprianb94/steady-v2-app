import React, { createContext, useContext, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../constants/colours';
import { FONTS } from '../constants/typography';

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

  useEffect(() => {
    if (!toast) return;
    const timeoutId = setTimeout(() => {
      setToast((current) => (current?.id === toast.id ? null : current));
    }, 2800);

    return () => clearTimeout(timeoutId);
  }, [toast]);

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
        <View
          pointerEvents="none"
          style={[
            styles.wrapper,
            {
              top: insets.top + 12,
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
        </View>
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
