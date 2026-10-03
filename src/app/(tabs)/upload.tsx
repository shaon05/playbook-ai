import { useRef, useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing } from '@/constants/theme';
import { ApiRequestError, deleteBook } from '@/services/api';
import { uploadMultiPageDocument, type DocumentPageInput, type MultiPageProgress } from '@/services/multipage-upload';
import { useAuth } from '@/providers/auth-provider';

function imageMime(mime: string | undefined, name: string) {
  const value = mime?.toLowerCase();
  if (value === 'image/png') return 'image/png' as const;
  if (value === 'image/heic' || /\.heic$/i.test(name)) return 'image/heic' as const;
  if (value === 'image/heif' || /\.heif$/i.test(name)) return 'image/heif' as const;
  return 'image/jpeg' as const;
}

export default function UploadScreen() {
  const { isAuthenticated } = useAuth();
  const mode = 'private';
  const creatorProfile: { status?: string } = {};
  const [pages, setPages] = useState<DocumentPageInput[]>([]);
  const [progress, setProgress] = useState<MultiPageProgress | null>(null); const [fileBusy, setFileBusy] = useState(false);
  const [lastFile, setLastFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null); const [uploadError, setUploadError] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const failedBookId = useRef<string | null>(null);
  const busy = fileBusy || Boolean(progress && progress.phase !== 'complete');

  async function addPickerAssets(assets: ImagePicker.ImagePickerAsset[]) {
    const next: DocumentPageInput[] = [];
    for (const asset of assets) {
      const file = new File(asset.uri);
      next.push({ localUri: asset.uri, filename: asset.fileName ?? 'photo.jpg', mimeType: imageMime(asset.mimeType, asset.fileName ?? ''), sizeBytes: asset.fileSize ?? file.size });
    }
    setPages((current) => [...current, ...next]);
  }

  async function chooseFile() {
    if (!isAuthenticated) { router.push('/(auth)/sign-in'); return; }
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
    if (!result.canceled) {
      const asset = result.assets[0];
      if (fileBusy) return; setLastFile(asset); await uploadFile(asset);
    }
  }

  async function choosePhotos() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsEditing: false, allowsMultipleSelection: true, selectionLimit: 30 });
    if (!result.canceled) await addPickerAssets(result.assets);
  }

  async function openCamera() {
    if (!cameraPermission?.granted) { const permission = await requestCameraPermission(); if (!permission.granted) { Alert.alert('Camera permission needed', 'PlayBook needs camera access to photograph document pages.'); return; } }
    setCameraOpen(true);
  }

  async function capturePage() {
    const photo = await camera.current?.takePictureAsync({ quality: 1 });
    if (!photo) return;
    const file = new File(photo.uri);
    setPages((current) => [...current, { localUri: photo.uri, filename: `page-${current.length + 1}.jpg`, mimeType: 'image/jpeg', sizeBytes: file.size }]);
  }

  function showUploadError(error: unknown) {
    if (error instanceof ApiRequestError && error.body.code === 'UPLOAD_RESTRICTED') { router.push('/support/security-appeal' as never); return; }
    const message = error instanceof Error ? error.message : 'We could not upload this document. Please try again.';
    setUploadError(message);
    Alert.alert('Upload failed', message, [
      { text: 'Remove', style: 'destructive', onPress: () => { const bookId = failedBookId.current; if (bookId) void deleteBook(bookId).then(() => { failedBookId.current = null; setUploadError(null); }).catch(() => undefined); } },
      { text: 'OK' },
    ]);
  }

  async function uploadFile(asset: DocumentPicker.DocumentPickerAsset, retryBookId?: string) {
    if (fileBusy) return;
    setUploadError(null);
    setFileBusy(true);
    const sameFailedAsset = lastFile?.uri === asset.uri ? failedBookId.current ?? undefined : undefined;
    try {
      const { uploadDocument } = await import('@/services/book-upload');
      const result = await uploadDocument(asset, () => undefined, retryBookId ?? sameFailedAsset);
      failedBookId.current = null;
      if (result.duplicate) {
        Alert.alert(result.title ?? 'Already in your Library', result.message ?? 'This document has already been added.', [
          { text: 'View Document', onPress: () => router.replace(`/book/${result.existingBookId ?? result.book.id}`) },
          { text: 'Back to Library', onPress: () => router.replace('/library') },
        ]);
        return;
      }
      router.replace(`/processing/${result.book.id}`);
    } catch (error) {
      const candidate = error && typeof error === 'object' && 'bookId' in error && typeof error.bookId === 'string' ? error.bookId : null;
      if (candidate) failedBookId.current = candidate;
      showUploadError(error);
    } finally {
      setFileBusy(false);
    }
  }

  async function continueUpload() {
    if (!isAuthenticated) { router.push('/(auth)/sign-in'); return; }
    try { const result = await uploadMultiPageDocument(pages, pages[0]?.filename.replace(/\.[^.]+$/, '') || 'Photo document', setProgress); router.replace(`/processing/${result.bookId}`); } catch (error) { setProgress(null); showUploadError(error); }
  }

  function movePage(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= pages.length) return; setPages((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; }); }

  if (isAuthenticated && mode !== 'private' && creatorProfile === undefined) return <SafeAreaView style={styles.safe}><View style={styles.workspaceLoading}><ActivityIndicator color={Colors.accentSecondary} /><Text style={styles.meta}>Loading your workspace…</Text></View></SafeAreaView>;
  if (isAuthenticated && mode !== 'private' && creatorProfile?.status === 'ACTIVE') return <SafeAreaView style={styles.safe}><View style={styles.workspaceLoading}><ActivityIndicator color={Colors.accentSecondary} /><Text style={styles.meta}>Opening Creator Studio…</Text></View></SafeAreaView>;
  const creatorNotice = mode !== 'private' && creatorProfile?.status === 'PENDING' ? <View style={styles.creatorNotice}><Text style={styles.creatorNoticeTitle}>Creator profile · Awaiting approval</Text><Text style={styles.creatorNoticeBody}>Your creator profile is being reviewed. Creator publishing tools will appear here after approval.</Text></View> : mode !== 'private' && creatorProfile?.status === 'SUSPENDED' ? <View style={styles.creatorNotice}><Text style={styles.creatorNoticeTitle}>Creator publishing restricted</Text><Text style={styles.creatorNoticeBody}>Creator publishing controls are unavailable while this profile is suspended. Private library uploads remain subject to your account restrictions.</Text></View> : null;

  if (cameraOpen) return <SafeAreaView style={styles.cameraSafe}><CameraView ref={camera} style={styles.camera} facing="back"><View style={styles.cameraControls}><Pressable style={{ alignSelf: 'flex-start' }} onPress={() => setCameraOpen(false)}><Text style={styles.cancel}>‹ Cancel</Text></Pressable><Text style={styles.cameraCount}>Page {pages.length + 1}</Text><Pressable style={styles.capture} onPress={() => void capturePage()}><Text style={styles.captureText}>Take Photo</Text></Pressable><View style={styles.cameraRow}><Pressable onPress={() => setPages((current) => current.slice(0, -1))}><Text style={styles.cancel}>Retake</Text></Pressable><Pressable onPress={() => setCameraOpen(false)}><Text style={styles.cancel}>Done</Text></Pressable></View></View></CameraView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{creatorNotice}<Text style={styles.eyebrow}>ADD TO YOUR SHELF</Text><Text style={styles.heading}>Upload Document</Text><Text style={styles.body}>Choose a file, select multiple photos, or capture pages with your camera.</Text><View style={styles.actions}><Pressable disabled={busy} style={styles.action} onPress={() => void chooseFile()}><Text style={styles.actionText}>Choose File</Text></Pressable><Pressable disabled={busy} style={styles.action} onPress={() => void choosePhotos()}><Text style={styles.actionText}>Choose Photos</Text></Pressable><Pressable disabled={busy} style={styles.action} onPress={() => void openCamera()}><Text style={styles.actionText}>Take Photos</Text></Pressable></View>{uploadError ? <View style={styles.errorBox}><Text style={styles.error}>{uploadError}</Text>{lastFile ? <Pressable disabled={busy} onPress={() => void uploadFile(lastFile)}><Text style={styles.retry}>Try Again</Text></Pressable> : null}</View> : null}{pages.length > 0 ? <View style={styles.pages}><Text style={styles.sectionTitle}>Document Pages</Text>{pages.map((page, index) => <View key={`${page.localUri}-${index}`} style={styles.page}><Image source={{ uri: page.localUri }} style={styles.thumbnail} /><View style={styles.pageInfo}><Text style={styles.pageTitle}>Page {index + 1}</Text><View style={styles.pageActions}><Pressable onPress={() => movePage(index, -1)}><Text style={styles.smallAction}>Up</Text></Pressable><Pressable onPress={() => movePage(index, 1)}><Text style={styles.smallAction}>Down</Text></Pressable><Pressable onPress={() => setPages((current) => current.filter((_, pageIndex) => pageIndex !== index))}><Text style={styles.remove}>Remove</Text></Pressable></View></View></View>)}<Pressable style={styles.addPage} onPress={() => void choosePhotos()}><Text style={styles.actionText}>Add Page</Text></Pressable><Pressable disabled={busy} style={styles.continue} onPress={() => void continueUpload()}><Text style={styles.continueText}>Continue</Text></Pressable></View> : null}{busy ? <View style={styles.progress}><ActivityIndicator color={Colors.accentSecondary} /><Text style={styles.meta}>{progress?.phase === 'uploading' ? `Uploading page ${progress.page} of ${progress.total}` : progress?.phase === 'checking' ? `Checking page ${progress.page} of ${progress.total}` : 'Preparing document...'}</Text></View> : null}<Text style={styles.formats}>PDF, JPG, PNG, or HEIC · Maximum 100 MB</Text></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: Colors.background }, content: { padding: Spacing.six, paddingBottom: Spacing.eight }, workspaceLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, creatorNotice: { backgroundColor: Colors.surface, borderRadius: 16, padding: Spacing.four, marginBottom: Spacing.five }, creatorNoticeTitle: { color: Colors.text, fontWeight: '800', fontSize: 16 }, creatorNoticeBody: { color: Colors.textSecondary, lineHeight: 21, marginTop: Spacing.one }, eyebrow: { color: Colors.accentSecondary, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, heading: { color: Colors.text, fontSize: 30, fontWeight: '800', marginTop: Spacing.three }, body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginTop: Spacing.three }, actions: { gap: Spacing.three, marginTop: Spacing.seven }, action: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.four, alignItems: 'center' }, actionText: { color: Colors.text, fontWeight: '800' }, errorBox: { backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.four, marginTop: Spacing.four }, error: { color: Colors.danger, lineHeight: 20 }, retry: { color: Colors.accentSecondary, fontWeight: '800', marginTop: Spacing.three }, pages: { marginTop: Spacing.seven, gap: Spacing.three }, sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '800' }, page: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, backgroundColor: Colors.surface, borderRadius: 14, padding: Spacing.three }, thumbnail: { width: 56, height: 72, borderRadius: 8, backgroundColor: Colors.background }, pageInfo: { flex: 1, gap: Spacing.two }, pageTitle: { color: Colors.text, fontWeight: '800' }, pageActions: { flexDirection: 'row', gap: Spacing.three }, smallAction: { color: Colors.accentSecondary, fontWeight: '700' }, remove: { color: Colors.danger, fontWeight: '700' }, addPage: { borderColor: Colors.border, borderWidth: 1, borderRadius: 14, padding: Spacing.four, alignItems: 'center' }, continue: { backgroundColor: Colors.accentSecondary, borderRadius: 14, padding: Spacing.four, alignItems: 'center' }, continueText: { color: Colors.background, fontWeight: '800' }, formats: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.five }, meta: { color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.four }, progress: { alignItems: 'center', marginTop: Spacing.five }, cameraSafe: { flex: 1, backgroundColor: '#000' }, camera: { flex: 1 }, cameraControls: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.five, paddingBottom: Spacing.seven }, cameraCount: { color: Colors.text, fontWeight: '800' }, capture: { backgroundColor: Colors.accentSecondary, borderRadius: 999, paddingHorizontal: Spacing.six, paddingVertical: Spacing.four }, captureText: { color: Colors.background, fontWeight: '800' }, cameraRow: { flexDirection: 'row', gap: Spacing.seven }, cancel: { color: Colors.text, fontWeight: '800' } });
