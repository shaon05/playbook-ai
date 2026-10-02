import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export function AuthInput({ label, ...props }: TextInputProps & { label: string }) { return <View style={styles.container}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={Colors.textSecondary} style={styles.input} /></View>; }
const styles = StyleSheet.create({ container: { marginTop: Spacing.four }, label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700', marginBottom: Spacing.one }, input: { minHeight: 52, borderRadius: 14, backgroundColor: Colors.surface, color: Colors.text, paddingHorizontal: Spacing.four, fontSize: 16, borderWidth: 1, borderColor: Colors.elevated } });
