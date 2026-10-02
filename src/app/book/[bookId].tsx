import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChapterRow } from '@/components/library/chapter-row';
import { IconButton } from '@/components/common/icon-button';
import { PrimaryButton } from '@/components/common/primary-button';
import { findBook } from '@/data/mock-books';
import { Colors, Spacing } from '@/constants/theme';
import { deleteBook, getBook, type ApiBook } from '@/services/api';

function formatBytes(bytes: number) { return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }

export default function BookScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const mockBook = findBook(bookId);
  if (mockBook) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Link href="/library" style={styles.back}>‹ Library</Link><View style={[styles.cover, { backgroundColor: mockBook.coverColor }]}><Text style={styles.coverText}>{mockBook.coverLabel}</Text></View><Text style={styles.title}>{mockBook.title}</Text><Text style={styles.author}>{mockBook.author}</Text><Text style={styles.meta}>{mockBook.progress}% complete · {mockBook.currentChapter}</Text><Link href={`/player/${mockBook.id}`} asChild><PrimaryButton title="Continue Listening" style={styles.primary} /></Link><View style={styles.actions}><IconButton symbol="heart" label="Favorite book" /><IconButton symbol="arrow.down.circle" label="Download book" /><IconButton symbol="ellipsis" label="More options" /></View><View style={styles.section}><Text style={styles.sectionTitle}>Chapters</Text>{mockBook.chapters.map((chapter) => <ChapterRow key={chapter.id} chapter={chapter} />)}</View><View style={styles.section}><Text style={styles.sectionTitle}>About this book</Text><Text style={styles.description}>{mockBook.description}</Text></View></ScrollView></SafeAreaView>;
  return <RemoteBookScreen bookId={bookId} />;
}

function RemoteBookScreen({ bookId }: { bookId?: string }) {
  const [book, setBook] = useState<ApiBook | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (bookId) void getBook(bookId).then(setBook).catch((cause) => setError(cause instanceof Error ? cause.message : 'Book not found.')); }, [bookId]);

  async function removeBook() {
    if (!book) return;
    Alert.alert('Delete book?', 'This removes the uploaded document from your library.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await deleteBook(book.id); router.replace('/library'); } catch (cause) { Alert.alert('Delete failed', cause instanceof Error ? cause.message : 'Unable to delete this book.'); } } }]);
  }

  if (error) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.title}>{error}</Text><Link href="/library" style={styles.link}>Back to library</Link></View></SafeAreaView>;
  if (!book) return <SafeAreaView style={styles.safe}><View style={styles.center}><Text style={styles.author}>Loading book…</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Link href="/library" style={styles.back}>‹ Library</Link><View style={[styles.cover, { backgroundColor: Colors.accent }]}><Text style={styles.coverText}>{book.title.slice(0, 18).toUpperCase()}</Text></View><Text style={styles.title}>{book.title}</Text><Text style={styles.author}>{book.author ?? 'Uploaded PDF'}</Text><Text style={styles.meta}>{book.status === 'UPLOADED' ? 'Ready for processing' : book.status}</Text><View style={styles.section}><Text style={styles.sectionTitle}>File</Text><Text style={styles.description}>{book.original_filename}</Text><Text style={styles.description}>{formatBytes(book.file_size_bytes)} · {new Date(book.created_at).toLocaleDateString()}</Text></View><View style={styles.section}><Text style={styles.sectionTitle}>Next</Text><Text style={styles.description}>Text preparation will be available in a future phase.</Text></View><Pressable accessibilityRole="button" onPress={removeBook} style={styles.delete}><Text style={styles.deleteText}>Delete book</Text></Pressable></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 150 }, back: { color: Colors.accentSecondary, fontSize: 15, fontWeight: '700' }, cover: { width: 190, height: 250, borderRadius: 16, marginTop: Spacing.five, justifyContent: 'flex-end', padding: Spacing.five }, coverText: { color: Colors.text, fontSize: 25, lineHeight: 24, fontWeight: '900' }, title: { color: Colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: Spacing.five }, author: { color: Colors.textSecondary, fontSize: 15, marginTop: Spacing.one }, meta: { color: Colors.accentSecondary, fontSize: 13, marginTop: Spacing.three }, primary: { marginTop: Spacing.five }, actions: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.four }, section: { marginTop: Spacing.seven }, sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '800', marginBottom: Spacing.two }, description: { color: Colors.textSecondary, fontSize: 15, lineHeight: 23, marginTop: Spacing.one }, delete: { borderWidth: 1, borderColor: Colors.danger, borderRadius: 12, padding: Spacing.four, alignItems: 'center', marginTop: Spacing.seven }, deleteText: { color: Colors.danger, fontWeight: '800' }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, link: { color: Colors.accentSecondary, marginTop: Spacing.three } });
