/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';

export function useTheme() {
  // The product is intentionally dark-first for the MVP. Keep this hook so a
  // future light theme can be introduced without changing every component.
  return Colors;
}
