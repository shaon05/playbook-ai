import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export function AuthLoadingScreen() { return <View style={styles.container}><Text style={styles.mark}>P</Text><Text style={styles.title}>PlayBook</Text><Text style={styles.subtitle}>Getting your listening space ready</Text><ActivityIndicator color={Colors.accentSecondary} style={styles.indicator} /></View>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }, mark: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.accent, color: Colors.text, textAlign: 'center', textAlignVertical: 'center', fontSize: 36, fontWeight: '900' }, title: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: Spacing.four }, subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: Spacing.one }, indicator: { marginTop: Spacing.five } });
