import { File } from 'expo-file-system';
import { apiRequest, type SupportedDocumentMimeType } from '@/services/api';

export type DocumentPageInput = { localUri: string; filename: string; mimeType: Extract<SupportedDocumentMimeType, `image/${string}`>; sizeBytes: number };
export type MultiPageProgress = { phase: 'preparing' | 'uploading' | 'checking' | 'complete'; page: number; total: number };
type CreatedDocument = { id: string; book_id: string; status: string };
type UploadPageResponse = { pageId: string; uploadId: string; uploadUrl: string; requiredHeaders: Record<string, string> };

export async function uploadMultiPageDocument(pages: DocumentPageInput[], title: string, onProgress: (progress: MultiPageProgress) => void) {
  if (!pages.length) throw new Error('Add at least one page.');
  onProgress({ phase: 'preparing', page: 0, total: pages.length });
  const document = await apiRequest<CreatedDocument>('/documents', { method: 'POST', body: JSON.stringify({ title }) });
  const pageIds: string[] = [];
  for (const [index, page] of pages.entries()) {
    onProgress({ phase: 'uploading', page: index + 1, total: pages.length });
    const prepared = await apiRequest<UploadPageResponse>(`/documents/${document.id}/pages`, { method: 'POST', body: JSON.stringify({ originalFilename: page.filename, mimeType: page.mimeType, sizeBytes: page.sizeBytes, pageIndex: index }) });
    const result = await new File(page.localUri).upload(prepared.uploadUrl, { httpMethod: 'PUT', headers: prepared.requiredHeaders, uploadType: 0 });
    if (result.status < 200 || result.status >= 300) throw new Error(`Page ${index + 1} upload failed.`);
    onProgress({ phase: 'checking', page: index + 1, total: pages.length });
    await apiRequest(`/documents/${document.id}/pages/${prepared.pageId}/complete`, { method: 'POST', body: JSON.stringify({}) });
    pageIds.push(prepared.pageId);
  }
  await apiRequest(`/documents/${document.id}/pages/order`, { method: 'PATCH', body: JSON.stringify({ orderedPageIds: pageIds }) });
  const completed = await apiRequest<{ documentId: string; bookId: string }>('/documents/' + document.id + '/complete', { method: 'POST', body: JSON.stringify({}) });
  onProgress({ phase: 'complete', page: pages.length, total: pages.length });
  return completed;
}
