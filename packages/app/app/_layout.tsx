import 'react-native-gesture-handler';
import React from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ToastProvider } from '../providers/ToastProvider';
import { PreferencesProvider } from '../providers/PreferencesProvider';
import { AppleHealthSyncProvider } from '../providers/AppleHealthSyncProvider';
import { StravaSyncProvider } from '../providers/StravaSyncProvider';

export default function RootLayout() {
  useFonts({
    PlayfairDisplay: require('../assets/fonts/PlayfairDisplay-Regular.ttf'),
    'PlayfairDisplay-Bold': require('../assets/fonts/PlayfairDisplay-Bold.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'SpaceMono-Bold': require('../assets/fonts/SpaceMono-Bold.ttf'),
    DMSans: require('../assets/fonts/DMSans-Regular.ttf'),
    'DMSans-Medium': require('../assets/fonts/DMSans-Medium.ttf'),
    'DMSans-SemiBold': require('../assets/fonts/DMSans-SemiBold.ttf'),
    'DMSans-Bold': require('../assets/fonts/DMSans-Bold.ttf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <PreferencesProvider>
            <ToastProvider>
              <StravaSyncProvider>
                <AppleHealthSyncProvider>
                  <BottomSheetModalProvider>
                    <Stack screenOptions={{ headerShown: false }}>
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="onboarding" />
                      <Stack.Screen name="edit-session" />
                      <Stack.Screen name="settings/training-paces" />
                    </Stack>
                  </BottomSheetModalProvider>
                </AppleHealthSyncProvider>
              </StravaSyncProvider>
            </ToastProvider>
          </PreferencesProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
