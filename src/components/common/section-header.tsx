import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

export function SectionHeader({ title, href }: { title: string; href?: '/library' }) { return <View style={styles.row}><Text style={styles.title}>{title}</Text>{href ? <Link href={href} style={styles.link}>See all</Link> : null}</View>; }
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three }, title: { color: Colors.text, fontSize: 20, fontWeight: '800' }, link: { color: Colors.accentSecondary, fontSize: 14, fontWeight: '700' } });
