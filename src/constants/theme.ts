/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

const palette = {
  background: '#090A0D',
  surface: '#12141A',
  elevated: '#191C23',
  text: '#F8F9FB',
  textSecondary: '#9DA4B2',
  accent: '#7C5CFC',
  accentSecondary: '#2DD4BF',
  success: '#35C987',
  warning: '#F4B740',
  danger: '#FF6464',
} as const;

// Keep light/dark aliases for the starter components while the product is dark-first.
export const Colors = {
  ...palette,
  light: palette,
  dark: palette,
  backgroundElement: palette.surface,
  backgroundSelected: palette.elevated,
} as const;

export const Theme = {
  light: Colors,
  dark: Colors,
} as const;

export type ThemeColor = Exclude<keyof typeof Colors, 'light' | 'dark'>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 20,
  six: 24,
  seven: 32,
  eight: 40,
  nine: 48,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
