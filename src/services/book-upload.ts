import { File, UploadType } from 'expo-file-system';
import type { DocumentPickerAsset } from 'expo-document-picker';
import { completeBookUpload, createBook, failBookUpload, retryBookUpload, type ApiBook, type SupportedDocumentMimeType } from '@/services/api';

export type UploadProgress = { phase: 'preparing' | 'uploading' | 'complete'; percent: number };
export class UploadTransferError extends Error { constructor(public readonly bookId: string) { super('The document upload failed.'); this.name = 'UploadTransferError'; } }
const maxUploadSizeBytes = Number(process.env.EXPO_PUBLIC_MAX_UPLOAD_SIZE_MB ?? 100) * 1024 * 1024;

function logUploadStage(stage: string, values: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV !== 'production') console.debug(JSON.stringify({ event: 'private_upload_stage', stage, ...values }));
}

function logUploadFailure(values: Record<string, unknown>) {
  console.error(JSON.stringify({ event: 'private_upload_failed', ...values }));
}

function readS3ErrorBody(body: string | undefined) {
  if (!body) return { s3Code: undefined, s3Message: undefined };
  const read = (tag: string) => body.match(new RegExp(`<${tag}>([^<]{0,300})</${tag}>`, 'i'))?.[1]?.trim();
  return { s3Code: read('Code'), s3Message: read('Message') };
}

function readHeader(headers: Record<string, string> | undefined, name: string) {
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name);
  return entry?.[1];
}

function safeUploadError(error: unknown) {
  const value = error as { name?: unknown; message?: unknown; status?: unknown } | null;
  return {
    errorType: typeof value?.name === 'string' ? value.name : 'UploadError',
    status: typeof value?.status === 'number' ? value.status : undefined,
    message: typeof value?.message === 'string' ? value.message.replace(/https?:\/\/\S+/gi, '[redacted-url]').slice(0, 300) : 'The file transfer failed.',
  };
}

export type UploadDocumentResult = { book: ApiBook; duplicate?: boolean; existingBookId?: string; title?: string; message?: string };

export async function uploadDocument(asset: DocumentPickerAsset, onProgress: (progress: UploadProgress) => void, retryBookId?: string): Promise<UploadDocumentResult> {
  const mimeType = (asset.mimeType?.toLowerCase() || 'application/pdf') as SupportedDocumentMimeType;
  const file = new File(asset.uri);
  const sizeBytes = file.size;
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(mimeType)) throw new Error('This file type is not supported. Upload a PDF, JPG, PNG, or HEIC photo.');
  if (!sizeBytes || sizeBytes <= 0) throw new Error('The selected file size could not be read.');
  if (sizeBytes > maxUploadSizeBytes) throw new Error('This file is too large.');
  onProgress({ phase: 'preparing', percent: 0 });

  logUploadStage('CREATE_UPLOAD_STARTED');
  const prepared = retryBookId ? await retryBookUpload(retryBookId) : await createBook({ originalFilename: asset.name, mimeType, sizeBytes, title: asset.name.replace(/\.(pdf|jpe?g|png|heic|heif)$/i, '') });
  logUploadStage('CREATE_UPLOAD_SUCCEEDED', { bookId: prepared.book.id });
  logUploadStage('S3_UPLOAD_STARTED', { bookId: prepared.book.id, fileSizeBytes: sizeBytes });
  try {
    const result = await file.upload(prepared.uploadUrl, { httpMethod: 'PUT', headers: prepared.requiredHeaders, uploadType: UploadType.BINARY_CONTENT, onProgress: ({ bytesSent, totalBytes }) => onProgress({ phase: 'uploading', percent: totalBytes > 0 ? Math.round((bytesSent / totalBytes) * 100) : 0 }) });
    if (result.status < 200 || result.status >= 300) {
      const s3Error = readS3ErrorBody(result.body);
      logUploadFailure({ stage: 'S3_UPLOAD', bookId: prepared.book.id, status: result.status, ...s3Error, requestId: readHeader(result.headers, 'x-amz-request-id'), extendedRequestId: readHeader(result.headers, 'x-amz-id-2') });
      throw new Error(`S3 upload failed with status ${result.status}.`);
    }
    logUploadStage('S3_UPLOAD_SUCCEEDED', { bookId: prepared.book.id, status: result.status });
  } catch (error) {
    if (!(error instanceof Error && error.message.startsWith('S3 upload failed with status'))) logUploadFailure({ stage: 'S3_UPLOAD', bookId: prepared.book.id, ...safeUploadError(error) });
    await failBookUpload(prepared.book.id).catch(() => undefined);
    throw new UploadTransferError(prepared.book.id);
  }
  logUploadStage('UPLOAD_COMPLETION_STARTED', { bookId: prepared.book.id });
  let completed;
  try { completed = await completeBookUpload(prepared.book.id); }
  catch (error) { logUploadStage('UPLOAD_COMPLETION_FAILED', { bookId: prepared.book.id, ...safeUploadError(error) }); throw error; }
  logUploadStage('UPLOAD_COMPLETION_SUCCEEDED', { bookId: prepared.book.id });
  onProgress({ phase: 'complete', percent: 100 });
  return completed;
}

export const uploadPdf = uploadDocument;
