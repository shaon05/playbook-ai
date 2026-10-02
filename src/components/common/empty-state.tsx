import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/common/primary-button';
import { Colors, Spacing } from '@/constants/theme';

export function EmptyState() { return <View style={styles.container}><Text style={styles.title}>Your listening library starts here.</Text><Text style={styles.body}>Upload a book and turn what you want to read into something you can listen to.</Text><Link href="/upload" asChild><PrimaryButton title="Upload your first book" /></Link></View>; }
const styles = StyleSheet.create({ container: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.five, alignItems: 'center' }, title: { color: Colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' }, body: { color: Colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center', marginVertical: Spacing.three } });
