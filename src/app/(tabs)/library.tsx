import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCard } from '@/components/books/book-card';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/library/filter-chip';
import { Colors, Spacing } from '@/constants/theme';
import { listBooks, type ApiBook } from '@/services/api';
import type { Book, LibraryFilter } from '@/types/library';

const filters: LibraryFilter[] = ['All', 'In Progress', 'Finished', 'Favorites', 'Downloaded'];

function toLibraryBook(book: ApiBook): Book {
  return { id: book.id, title: book.title, author: book.author ?? 'Uploaded PDF', coverColor: Colors.accent, coverLabel: book.title.slice(0, 18).toUpperCase(), progress: 0, currentChapter: book.status === 'UPLOADED' ? 'Ready for processing' : 'Upload pending', totalChapters: 0, duration: '', remainingTime: '', isFavorite: false, isDownloaded: false, description: book.original_filename, chapters: [] };
}

export default function LibraryScreen() {
  const [filter, setFilter] = useState<LibraryFilter>('All');
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    try { setError(null); setBooks(await listBooks()); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to load your library.'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void loadBooks(); }, [loadBooks]));

  const visibleBooks = useMemo(() => books.filter((book) => {
    const matchesFilter = filter === 'All' || (filter === 'In Progress' && book.status === 'PROCESSING') || (filter === 'Finished' && book.status === 'READY') || (filter === 'Favorites' && false) || (filter === 'Downloaded' && false);
    return matchesFilter && `${book.title} ${book.author ?? ''} ${book.original_filename}`.toLowerCase().includes(query.toLowerCase());
  }).map(toLibraryBook), [books, filter, query]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>YOUR SHELF</Text><Text style={styles.heading}>Your Library</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search your library" placeholderTextColor={Colors.textSecondary} accessibilityLabel="Search your library" style={styles.search} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}</ScrollView>{loading ? <ActivityIndicator color={Colors.accentSecondary} style={styles.loading} /> : error ? <Text style={styles.error}>{error}</Text> : <View style={styles.list}>{visibleBooks.map((book) => <BookCard key={book.id} book={book} variant="compact" />)}</View>}{!loading && !error && visibleBooks.length === 0 ? <EmptyState /> : null}</ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 150 }, eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, heading: { color: Colors.text, fontSize: 32, fontWeight: '800', marginTop: Spacing.two }, search: { height: 50, borderRadius: 14, backgroundColor: Colors.surface, color: Colors.text, paddingHorizontal: Spacing.four, marginTop: Spacing.five, fontSize: 15 }, filters: { paddingVertical: Spacing.four }, list: { gap: Spacing.three }, loading: { marginTop: Spacing.seven }, error: { color: Colors.danger, marginTop: Spacing.seven, lineHeight: 22 } });
