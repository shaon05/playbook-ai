import { Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export function PrimaryButton({ title, style, ...props }: PressableProps & { title: string }) { return <Pressable {...props} accessibilityRole="button" style={({ pressed, hovered }) => StyleSheet.flatten([styles.button, typeof style === 'function' ? style({ pressed, hovered }) : style])}><Text style={styles.text}>{title}</Text></Pressable>; }
const styles = StyleSheet.create({ button: { minHeight: 52, borderRadius: 999, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.six }, text: { color: Colors.text, fontSize: 16, fontWeight: '800' } });
