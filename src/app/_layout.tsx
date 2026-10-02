import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PlayerProvider } from '@/state/player-context';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AnimatedSplashOverlay />
      <StatusBar style="light" />
      <AuthProvider>
        <PlayerProvider>
          <AppNavigator />
        </PlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="book/[bookId]" />
        <Stack.Screen name="player/[bookId]" />
          <Stack.Screen name="processing/[bookId]" />
          <Stack.Screen name="profile-edit" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
