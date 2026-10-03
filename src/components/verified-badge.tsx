import { StyleSheet, Text } from 'react-native';

export function VerifiedBadge({ status }: { status?: string | null }) {
  return status === 'VERIFIED' ? <Text accessibilityLabel="Verified creator" style={styles.badge}>✓</Text> : null;
}
const styles = StyleSheet.create({ badge: { color: '#4f9cff', fontSize: 18, fontWeight: '900', marginLeft: 6 } });
