import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { getBook, getProcessingStatus, type ApiBook, type ProcessingStatus } from '@/services/api';

const terminal = new Set(['TEXT_READY', 'OCR_REQUIRED', 'EXTRACTION_FAILED']);

export default function ProcessingScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const [book, setBook] = useState<ApiBook | null>(null);
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => { if (!bookId) return; try { const [nextBook, nextStatus] = await Promise.all([getBook(bookId), getProcessingStatus(bookId)]); setBook(nextBook); setStatus(nextStatus); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load document status.'); } }, [bookId]);
  useFocusEffect(useCallback(() => { void refresh(); const timer = setInterval(() => { if (!terminal.has(status?.status ?? '')) void refresh(); }, 3000); return () => clearInterval(timer); }, [refresh, status?.status]));
  const progress = status?.progress ?? (status?.status === 'TEXT_READY' ? 100 : 0);
  const complete = status?.status === 'TEXT_READY';
  const needsOcr = status?.status === 'OCR_REQUIRED';
  return <SafeAreaView style={styles.safe}><View style={styles.content}><View style={styles.spinner}><Text style={styles.spinnerText}>{complete || needsOcr ? '✓' : '◌'}</Text></View><Text style={styles.title}>{error ? 'Unable to prepare document' : needsOcr ? 'Additional text recognition required' : complete ? 'Your book is ready for the next step' : status?.stage ?? 'Preparing your book'}</Text><Text style={styles.body}>{error ?? (needsOcr ? 'This document appears to be scanned. It needs additional text recognition before it can be understood.' : complete ? `${book?.title ?? 'Your book'} is ready for the next step.` : 'We’re reading your document. You can leave this screen and check back later.')}</Text><View style={styles.track}><View style={[styles.fill, { width: `${progress}%` }]} /></View><Text style={styles.percent}>{progress}%</Text>{error || needsOcr || complete ? <Pressable accessibilityRole="button" onPress={() => router.replace(`/book/${bookId}`)} style={styles.button}><Text style={styles.buttonText}>{needsOcr ? 'View book' : complete ? 'View book' : 'Try again later'}</Text></Pressable> : <Link href="/library" style={styles.link}>Back to library</Link>}</View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { flex: 1, padding: Spacing.six, alignItems: 'center', justifyContent: 'center' }, spinner: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.elevated, alignItems: 'center', justifyContent: 'center' }, spinnerText: { color: Colors.accentSecondary, fontSize: 48 }, title: { color: Colors.text, fontSize: 28, fontWeight: '800', marginTop: Spacing.six, textAlign: 'center' }, body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: Spacing.three }, track: { width: '100%', height: 6, backgroundColor: '#303540', borderRadius: 3, marginTop: Spacing.seven }, fill: { height: 6, backgroundColor: Colors.accentSecondary, borderRadius: 3 }, percent: { color: Colors.textSecondary, fontSize: 12, marginTop: Spacing.two }, button: { backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: Spacing.six, paddingVertical: Spacing.four, marginTop: Spacing.seven }, buttonText: { color: Colors.text, fontSize: 16, fontWeight: '800' }, link: { color: Colors.accentSecondary, fontSize: 15, fontWeight: '700', marginTop: Spacing.seven } });
