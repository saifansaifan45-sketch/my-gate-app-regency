/* eslint-disable @typescript-eslint/no-require-imports */
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import { Outfit_700Bold } from '@expo-google-fonts/outfit';
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans';
import { useFonts as useLocalFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { AuthProvider } from '../src/store/auth';
import { ToastProvider } from '../src/store/toast';
import { NavigationHistoryTracker } from '../src/navigation/history';

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useLocalFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Outfit_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    Satoshi_400Regular: require('../assets/fonts/Satoshi_400Regular.ttf'),
    Satoshi_500Medium: require('../assets/fonts/Satoshi_500Medium.ttf'),
    Satoshi_700Bold: require('../assets/fonts/Satoshi_700Bold.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ToastProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <NavigationHistoryTracker />
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'fade',
              animationDuration: 260,
              gestureEnabled: true,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" options={{ animation: 'fade' }} />
          </Stack>
        </QueryClientProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
