import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import type { ComponentProps } from 'react';
import { SymbolView } from 'expo-symbols';

import { Colors, Spacing } from '@/constants/theme';

type SymbolName = NonNullable<ComponentProps<typeof SymbolView>['name']>;
export function IconButton({ symbol, label, style, ...props }: PressableProps & { symbol: string; label: string }) { const name = { ios: symbol, android: symbol, web: symbol } as SymbolName; return <Pressable {...props} accessibilityRole="button" accessibilityLabel={label} style={({ pressed, hovered }) => StyleSheet.flatten([styles.button, typeof style === 'function' ? style({ pressed, hovered }) : style])}><SymbolView name={name} tintColor={Colors.text} size={20} /></Pressable>; }
const styles = StyleSheet.create({ button: { minWidth: 48, minHeight: 48, borderRadius: 24, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center', padding: Spacing.three } });
