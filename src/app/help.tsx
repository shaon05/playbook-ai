import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';

const topics = [
  ['Getting Started', 'How PlayBook works and how to begin listening.'],
  ['Account & Login', 'Sign-in, account access, and keeping your library synced.'],
  ['Uploading PDFs', 'Private PDF uploads, limits, and processing.'],
  ['Listening & Audio', 'Playback, progress, and audio troubleshooting.'],
  ['Library & Progress', 'Your shelf, favorites, and continued listening.'],
  ['Subscriptions & Ads', 'Free and Premium plan basics.'],
  ['Privacy & Security', 'How PlayBook protects your account and documents.'],
  ['Publishing Stories', 'Creator publishing and rights review.'],
  ['Story Review', 'Moderation and changes requested.'],
  ['Creator Analytics', 'Aggregated creator performance information.'],
  ['Revenue & Earnings', 'Creator earnings and future payout information.'],
  ['Copyright & Rights', 'Copyright complaints, appeals, and takedowns.'],
] as const;

export default function HelpScreen() {
  const [query, setQuery] = useState('');
  const visible = useMemo(() => topics.filter(([title, body]) => `${title} ${body}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Link href="/" style={styles.back}>‹ Back</Link><Text style={styles.eyebrow}>SUPPORT</Text><Text style={styles.heading}>Help & Support</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search Help" placeholderTextColor={Colors.textSecondary} style={styles.search} accessibilityLabel="Search Help" /><Text style={styles.sectionTitle}>Popular Topics</Text><View style={styles.list}>{visible.map(([title, body]) => <Pressable key={title} style={styles.topic}><Text style={styles.topicTitle}>{title}</Text><Text style={styles.topicBody}>{body}</Text></Pressable>)}</View><Text style={styles.sectionTitle}>Need more help?</Text><Link href="/(auth)/sign-in" style={styles.action}>Contact Support</Link><Link href="/(auth)/sign-in" style={styles.action}>Report a Problem</Link></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 100 }, back: { color: Colors.accentSecondary, fontWeight: '700' }, eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginTop: Spacing.six }, heading: { color: Colors.text, fontSize: 32, fontWeight: '800', marginTop: Spacing.two }, search: { backgroundColor: Colors.surface, color: Colors.text, borderRadius: 14, height: 50, paddingHorizontal: Spacing.four, marginTop: Spacing.five }, sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.seven, marginBottom: Spacing.three }, list: { gap: Spacing.two }, topic: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.four }, topicTitle: { color: Colors.text, fontSize: 16, fontWeight: '800' }, topicBody: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: Spacing.one }, action: { color: Colors.accentSecondary, fontSize: 16, fontWeight: '800', paddingVertical: Spacing.three } });
