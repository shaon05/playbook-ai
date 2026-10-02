import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/constants/theme';

export default function AuthCallbackScreen() { const { code } = useLocalSearchParams<{ code?: string }>(); useEffect(() => { let active = true; if (code) supabase.auth.exchangeCodeForSession(code).finally(() => { if (active) router.replace('/'); }); else router.replace('/sign-in'); return () => { active = false; }; }, [code]); return <View style={styles.container}><ActivityIndicator color={Colors.accentSecondary} /><Text style={styles.text}>Finishing secure sign in…</Text></View>; }
const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }, text: { color: Colors.textSecondary, marginTop: 16 } });
