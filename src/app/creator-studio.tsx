import { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/theme';
import { CreatorWorkspace } from '@/components/creator-workspace';
import { getCreatorProfile, type CreatorProfile } from '@/services/api';

export default function CreatorStudioScreen() {
  const [profile, setProfile] = useState<CreatorProfile | null | undefined>(undefined);
  useEffect(() => { void getCreatorProfile().then(setProfile).catch(() => setProfile(null)); }, []);
  useEffect(() => { if (profile !== undefined && profile?.status !== 'ACTIVE') router.replace('/(tabs)/profile' as never); }, [profile]);
  if (profile?.status === 'ACTIVE') return <CreatorWorkspace profile={profile} />;
  return <SafeAreaView style={styles.safe}><View style={styles.center}><ActivityIndicator color={Colors.accentSecondary} /><Text style={styles.text}>Checking creator access…</Text></View></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, text: { color: Colors.textSecondary, marginTop: 12 } });
