import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { Colors, Spacing } from '@/constants/theme';
import { findBook } from '@/data/mock-books';
import { usePlayer } from '@/state/player-context';

export function MiniPlayer() {
  const player = usePlayer();
  const book = findBook(player.activeBookId);
  if (!book) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open player for ${book.title}`} onPress={() => router.push(`/player/${book.id}`)} style={styles.container}>
      <View style={[styles.cover, { backgroundColor: book.coverColor }]}><Text style={styles.coverText}>{book.coverLabel.split('\n')[0]}</Text></View>
      <View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{book.title}</Text><Text style={styles.subtitle}>{book.currentChapter}</Text></View>
      <Text accessibilityLabel={player.isPlaying ? 'Pause' : 'Play'} style={styles.play}>{player.isPlaying ? 'Ⅱ' : '▶'}</Text>
      <View style={[styles.progress, { width: `${player.progress}%` }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: Spacing.four, right: Spacing.four, bottom: 82, minHeight: 64, backgroundColor: Colors.elevated, borderRadius: 14, padding: Spacing.two, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, overflow: 'hidden' },
  cover: { width: 48, height: 48, borderRadius: 10, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  coverText: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  copy: { flex: 1 },
  title: { color: Colors.text, fontWeight: '700', fontSize: 14 },
  subtitle: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  play: { color: Colors.text, fontSize: 18, paddingHorizontal: Spacing.two },
  progress: { position: 'absolute', left: 0, bottom: 0, height: 3, width: '42%', backgroundColor: Colors.accentSecondary },
});
