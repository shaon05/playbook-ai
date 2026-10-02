import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { uploadPdf, type UploadProgress } from '@/services/book-upload';

export default function UploadScreen() {
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  async function choosePdf() {
    if (progress && progress.phase !== 'complete') return;
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFilename(asset.name);
    try {
      const book = await uploadPdf(asset, setProgress);
      router.replace(`/processing/${book.id}`);
    } catch (error) {
      setProgress(null);
      Alert.alert('Upload failed', error instanceof Error ? error.message : 'We could not upload this PDF. Please try again.');
    }
  }

  const isUploading = progress && progress.phase !== 'complete';
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ADD TO YOUR SHELF</Text>
        <Text style={styles.heading}>Turn something you want to read{`\n`}into something you can listen to.</Text>
        <Text style={styles.body}>Choose a PDF and we’ll keep it private while we prepare it for your library.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Choose a PDF" disabled={!!isUploading} onPress={choosePdf} style={({ pressed }) => [styles.upload, pressed && styles.pressed, isUploading && styles.disabled]}>
          {isUploading ? <ActivityIndicator color={Colors.accentSecondary} /> : <Text style={styles.uploadIcon}>↑</Text>}
          <Text style={styles.uploadTitle}>{isUploading ? (progress?.phase === 'preparing' ? 'Preparing upload' : 'Uploading PDF') : 'Upload a PDF'}</Text>
          {filename ? <Text numberOfLines={1} style={styles.filename}>{filename}</Text> : null}
          {progress?.phase === 'uploading' ? <><Text style={styles.progressText}>{progress.percent}%</Text><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.percent}%` }]} /></View></> : null}
          {!isUploading ? <Text style={styles.choose}>Choose file</Text> : null}
        </Pressable>
        <Text style={styles.formats}>PDF only · Maximum 100 MB</Text>
        <Text style={styles.privacy}>Your uploads are private by default.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { flex: 1, padding: Spacing.six, justifyContent: 'center' },
  eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heading: { color: Colors.text, fontSize: 28, lineHeight: 34, fontWeight: '800', marginTop: Spacing.three },
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: Spacing.three },
  upload: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.accent, borderRadius: 16, padding: Spacing.six, alignItems: 'center', marginTop: Spacing.seven, backgroundColor: Colors.surface },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.9 },
  uploadIcon: { color: Colors.accentSecondary, fontSize: 38 },
  uploadTitle: { color: Colors.text, fontSize: 18, fontWeight: '800', marginTop: Spacing.three },
  filename: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.one, maxWidth: '100%' },
  formats: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: Spacing.three },
  choose: { color: Colors.text, backgroundColor: Colors.accent, borderRadius: 999, paddingHorizontal: Spacing.five, paddingVertical: Spacing.three, fontSize: 15, fontWeight: '800', marginTop: Spacing.five },
  progressText: { color: Colors.accentSecondary, fontSize: 14, fontWeight: '800', marginTop: Spacing.three },
  progressTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: Colors.elevated, marginTop: Spacing.two, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.accentSecondary },
  privacy: { color: Colors.textSecondary, textAlign: 'center', fontSize: 13, marginTop: Spacing.four },
});
