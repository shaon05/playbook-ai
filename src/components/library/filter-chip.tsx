import { Pressable, StyleSheet, Text } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import type { LibraryFilter } from '@/types/library';

export function FilterChip({ label, selected, onPress }: { label: LibraryFilter; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} style={[styles.chip, selected && styles.selected]}><Text style={[styles.text, selected && styles.selectedText]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ chip: { borderRadius: 999, borderWidth: 1, borderColor: Colors.elevated, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginRight: Spacing.two }, selected: { backgroundColor: Colors.accent, borderColor: Colors.accent }, text: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' }, selectedText: { color: Colors.text } });
