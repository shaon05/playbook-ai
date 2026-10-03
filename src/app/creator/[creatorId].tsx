import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { followCreator, getPublicCreator, getPublicCreatorVerification, type CatalogResult } from '@/services/api';
import { useAuth } from '@/providers/auth-provider';
import { VerifiedBadge } from '@/components/verified-badge';

export default function PublicCreatorScreen() {
  const { creatorId } = useLocalSearchParams<{ creatorId: string }>();
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<Awaited<ReturnType<typeof getPublicCreator>> | null>(null);
  const [verified, setVerified] = useState(false);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!creatorId) return;
    void getPublicCreator(creatorId)
      .then((creator) => { setData(creator); return getPublicCreatorVerification(creatorId).catch(() => ({ status: 'NOT_APPLIED' as const })); })
      .then((verification) => setVerified(verification.status === 'VERIFIED'))
      .catch(() => setError("We couldn't load this creator profile."));
  }, [creatorId]);

  async function follow() {
    if (!creatorId || !isAuthenticated) { router.push('/(auth)/sign-in'); return; }
    try { await followCreator(creatorId); setFollowing(true); } catch { setError('Unable to follow this creator right now.'); }
  }

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    {data ? <>
      <Text style={styles.avatar}>{data.creator.display_name.charAt(0).toUpperCase()}</Text>
      <Text style={styles.title}>{data.creator.display_name}<VerifiedBadge status={verified ? 'VERIFIED' : null} /></Text>
      <Text style={styles.language}>{data.creator.primary_language ?? 'PlayBook creator'}</Text>
      <Text style={styles.followers}>{data.creator.followerCount} followers</Text>
      <Text style={styles.bio}>{data.creator.bio ?? ''}</Text>
      <Pressable style={styles.follow} onPress={() => void follow()}><Text style={styles.followText}>{following ? 'Following' : 'Follow'}</Text></Pressable>
      <Text style={styles.section}>Published Stories</Text>
      {data.stories.map((story: CatalogResult) => <Pressable key={story.id} style={styles.story} onPress={() => router.push(`/catalog/${story.id}` as never)}><Text style={styles.storyTitle}>{story.title}</Text><Text style={styles.storyMeta}>{story.content_type} · {story.language ?? 'Language not specified'}</Text></Pressable>)}
    </> : error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={Colors.accentSecondary} />}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: 100 }, back: { color: Colors.accentSecondary, fontWeight: '700' }, avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent, color: Colors.text, textAlign: 'center', textAlignVertical: 'center', fontSize: 32, fontWeight: '800', marginTop: Spacing.seven }, title: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: Spacing.three }, language: { color: Colors.accentSecondary, marginTop: Spacing.one }, followers: { color: Colors.textSecondary, marginTop: Spacing.two }, bio: { color: Colors.textSecondary, lineHeight: 24, marginTop: Spacing.five }, follow: { backgroundColor: Colors.accentSecondary, borderRadius: 999, alignItems: 'center', padding: Spacing.three, marginTop: Spacing.five }, followText: { color: Colors.background, fontWeight: '800' }, section: { color: Colors.text, fontSize: 20, fontWeight: '800', marginTop: Spacing.seven, marginBottom: Spacing.three }, story: { backgroundColor: Colors.surface, borderRadius: 12, padding: Spacing.four, marginBottom: Spacing.two }, storyTitle: { color: Colors.text, fontWeight: '800' }, storyMeta: { color: Colors.textSecondary, marginTop: Spacing.one }, error: { color: Colors.danger, marginTop: Spacing.seven } });
