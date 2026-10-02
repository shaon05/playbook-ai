import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export function SocialAuthButton({ provider }: { provider: 'Google' | 'Apple' }) { return <Pressable disabled accessibilityRole="button" accessibilityLabel={`Continue with ${provider}`} style={styles.button}><Text style={styles.text}>Continue with {provider}</Text><Text style={styles.note}>Setup required</Text></Pressable>; }
const styles = StyleSheet.create({ button: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: Colors.elevated, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.three, opacity: 0.55 }, text: { color: Colors.text, fontSize: 15, fontWeight: '700' }, note: { color: Colors.textSecondary, fontSize: 11, marginTop: 2 } });
