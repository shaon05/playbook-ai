import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCard } from '@/components/books/book-card';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/library/filter-chip';
import { Colors, Spacing } from '@/constants/theme';
import { listBooks, type ApiBook } from '@/services/api';
import type { Book, LibraryFilter } from '@/types/library';
import { useAuth } from '@/providers/auth-provider';

const filters: LibraryFilter[] = ['All', 'In Progress', 'Finished', 'Favorites', 'Downloaded'];

function toLibraryBook(book: ApiBook): Book {
  return { id: book.id, title: book.title, author: book.author ?? 'Uploaded PDF', coverColor: Colors.accent, coverLabel: book.title.slice(0, 18).toUpperCase(), progress: 0, currentChapter: book.status === 'UPLOADED' ? 'Ready for processing' : 'Upload pending', totalChapters: 0, duration: '', remainingTime: '', isFavorite: false, isDownloaded: false, description: book.original_filename, chapters: [] };
}

export default function LibraryScreen() {
  const { isAuthenticated } = useAuth();
  const [filter, setFilter] = useState<LibraryFilter>('All');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    if (!isAuthenticated) { setBooks([]); setLoading(false); return; }
    try { setError(null); setBooks(await listBooks()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load your library.'); } finally { setLoading(false); }
  }, [isAuthenticated]);
  useFocusEffect(useCallback(() => { void loadBooks(); }, [loadBooks]));

  const visibleBooks = useMemo(() => books.filter((book) => {
    const matchesFilter = filter === 'All' || (filter === 'In Progress' && book.status === 'PROCESSING') || (filter === 'Finished' && book.status === 'READY') || (filter === 'Favorites' && false) || (filter === 'Downloaded' && false);
    return matchesFilter && `${book.title} ${book.author ?? ''} ${book.original_filename}`.toLowerCase().includes(query.toLowerCase());
  }).map(toLibraryBook), [books, filter, query]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><View style={styles.header}><View><Text style={styles.eyebrow}>YOUR SHELF</Text><Text style={styles.heading}>Your Library</Text></View>{isAuthenticated ? <Pressable accessibilityRole="button" onPress={() => router.push('/upload' as never)} style={styles.addDocument}><Text style={styles.addDocumentText}>+ Add Document</Text></Pressable> : null}</View>{!isAuthenticated ? <View style={styles.guestCard}><Text style={styles.guestTitle}>Create your PlayBook account</Text><Text style={styles.guestBody}>Save your library and continue listening across devices.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/sign-in')} style={styles.guestButton}><Text style={styles.guestButtonText}>Sign in or create account</Text></Pressable></View> : <><TextInput value={query} onChangeText={setQuery} placeholder="Search your library" placeholderTextColor={Colors.textSecondary} accessibilityLabel="Search your library" style={styles.search} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}</ScrollView>{loading ? <ActivityIndicator color={Colors.accentSecondary} style={styles.loading} /> : error ? <Text style={styles.error}>{error}</Text> : <View style={styles.list}>{visibleBooks.map((book) => <BookCard key={book.id} book={book} variant="compact" />)}</View>}{!loading && !error && visibleBooks.length === 0 ? <EmptyState /> : null}</>}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 150 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, heading: { color: Colors.text, fontSize: 32, fontWeight: '800', marginTop: Spacing.two }, addDocument: { backgroundColor: Colors.surface, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two }, addDocumentText: { color: Colors.accentSecondary, fontWeight: '800' }, search: { height: 50, borderRadius: 14, backgroundColor: Colors.surface, color: Colors.text, paddingHorizontal: Spacing.four, marginTop: Spacing.five, fontSize: 15 }, filters: { paddingVertical: Spacing.four }, list: { gap: Spacing.three }, loading: { marginTop: Spacing.seven }, error: { color: Colors.danger, marginTop: Spacing.seven, lineHeight: 22 }, guestCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.five, marginTop: Spacing.six }, guestTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' }, guestBody: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: Spacing.two }, guestButton: { backgroundColor: Colors.accent, borderRadius: 999, paddingVertical: Spacing.three, alignItems: 'center', marginTop: Spacing.four }, guestButtonText: { color: Colors.text, fontWeight: '800' } });
