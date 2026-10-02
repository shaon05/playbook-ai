import { File } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { completeBookUpload, createBook, type ApiBook } from '@/services/api';

export type UploadProgress = { phase: 'preparing' | 'uploading' | 'complete'; percent: number };
const maxUploadSizeBytes = Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_SIZE_MB ?? 100) * 1024 * 1024;

export async function uploadPdf(asset: DocumentPickerAsset, onProgress: (progress: UploadProgress) => void): Promise<ApiBook> {
  const mimeType = asset.mimeType?.toLowerCase() || 'application/pdf';
  const sizeBytes = asset.size;
  if (mimeType !== 'application/pdf') throw new Error('Only PDF files are currently supported.');
  if (!sizeBytes || sizeBytes <= 0) throw new Error('The selected file size could not be read.');
  if (sizeBytes > maxUploadSizeBytes) throw new Error('This file is too large.');
  onProgress({ phase: 'preparing', percent: 0 });

  const prepared = await createBook({ originalFilename: asset.name, mimeType: 'application/pdf', sizeBytes, title: asset.name.replace(/\.pdf$/i, '') });
  const file = new File(asset.uri);
  const result = await file.upload(prepared.uploadUrl, {
    httpMethod: 'PUT',
    headers: prepared.requiredHeaders,
    uploadType: 0,
    onProgress: ({ bytesSent, totalBytes }) => onProgress({ phase: 'uploading', percent: totalBytes > 0 ? Math.round((bytesSent / totalBytes) * 100) : 0 }),
  });
  if (result.status < 200 || result.status >= 300) throw new Error('The PDF upload failed.');
  const completed = await completeBookUpload(prepared.book.id);
  onProgress({ phase: 'complete', percent: 100 });
  return completed.book;
}
