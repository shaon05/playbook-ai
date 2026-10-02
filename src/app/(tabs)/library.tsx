import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BookCard } from '@/components/books/book-card';
import { EmptyState } from '@/components/common/empty-state';
import { FilterChip } from '@/components/library/filter-chip';
import { mockBooks } from '@/data/mock-books';
import { Colors, Spacing } from '@/constants/theme';
import type { LibraryFilter } from '@/types/library';

const filters: LibraryFilter[] = ['All', 'In Progress', 'Finished', 'Favorites', 'Downloaded'];
export default function LibraryScreen() { const [filter, setFilter] = useState<LibraryFilter>('All'); const [query, setQuery] = useState(''); const books = useMemo(() => mockBooks.filter((book) => { const matchesFilter = filter === 'All' || (filter === 'In Progress' && book.progress > 0 && book.progress < 100) || (filter === 'Finished' && book.progress === 100) || (filter === 'Favorites' && book.isFavorite) || (filter === 'Downloaded' && book.isDownloaded); return matchesFilter && `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase()); }), [filter, query]); return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}><Text style={styles.eyebrow}>YOUR SHELF</Text><Text style={styles.heading}>Your Library</Text><TextInput value={query} onChangeText={setQuery} placeholder="Search your library" placeholderTextColor={Colors.textSecondary} accessibilityLabel="Search your library" style={styles.search} /><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{filters.map((item) => <FilterChip key={item} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}</ScrollView><View style={styles.list}>{books.map((book) => <BookCard key={book.id} book={book} variant="compact" />)}</View>{books.length === 0 ? <EmptyState /> : null}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 150 }, eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, heading: { color: Colors.text, fontSize: 32, fontWeight: '800', marginTop: Spacing.two }, search: { height: 50, borderRadius: 14, backgroundColor: Colors.surface, color: Colors.text, paddingHorizontal: Spacing.four, marginTop: Spacing.five, fontSize: 15 }, filters: { paddingVertical: Spacing.four }, list: { gap: Spacing.three } });
