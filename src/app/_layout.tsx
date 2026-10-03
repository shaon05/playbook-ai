import { DarkTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { PlayerProvider } from '@/state/player-context';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { AuthLoadingScreen } from '@/components/auth/auth-loading-screen';
import { AppModeProvider } from '@/state/app-mode-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <AnimatedSplashOverlay />
      <StatusBar style="light" />
      <AuthProvider>
        <AppModeProvider>
          <PlayerProvider>
            <AppNavigator />
          </PlayerProvider>
        </AppModeProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

function AppNavigator() {
  const { isLoading, isAuthenticated } = useAuth();
  if (isLoading) return <AuthLoadingScreen />;
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="help" />
      <Stack.Screen name="book/[bookId]" />
      <Stack.Screen name="player/[bookId]" />
      <Stack.Screen name="catalog/[contentId]" />
      <Stack.Screen name="creator/[creatorId]" />
      <Stack.Protected guard={isAuthenticated}>
          <Stack.Screen name="processing/[bookId]" />
          <Stack.Screen name="profile-edit" />
          <Stack.Screen name="creator-profile" />
          <Stack.Screen name="creator-studio" />
          <Stack.Screen name="creator-content-edit" />
          <Stack.Screen name="creator-submit" />
          <Stack.Screen name="creator-submission/[submissionId]" />
          <Stack.Screen name="support/security-appeal" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
