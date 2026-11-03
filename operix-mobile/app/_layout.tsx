import '../global.css';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { DeclareProvider } from '@/features/declare/DeclareProvider';
import { SplashView } from '@/features/auth/SplashView';

void SplashScreen.preventAutoHideAsync();

/** Durée minimale du splash : le temps de lire la marque, pas davantage. */
const MIN_SPLASH_MS = 1600;

function RootNavigator() {
  const { status } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

  useEffect(() => {
    void SplashScreen.hideAsync();
    const t = setTimeout(() => setMinElapsed(true), MIN_SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  if (status === 'loading' || !minElapsed) return <SplashView />;

  const signedIn = status === 'signedIn';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="declare" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="incidents/index" />
        <Stack.Screen name="incidents/[id]" />
        <Stack.Screen name="near-miss" />
        <Stack.Screen name="actions" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="employees" />
        <Stack.Screen name="settings" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <DeclareProvider>
          <RootNavigator />
        </DeclareProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
