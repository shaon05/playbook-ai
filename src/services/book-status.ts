import type { ApiBook, ProcessingStatus } from '@/services/api';

export type UserBookStatus = 'UPLOADING' | 'PREPARING' | 'ALMOST_READY' | 'READY' | 'FAILED';
export type BookStatusView = { status: UserBookStatus; label: string; detail: string; eta: string; canViewOriginal: boolean; isTerminal: boolean };

const failed = new Set(['UPLOAD_FAILED', 'PROCESSING_FAILED', 'EXTRACTION_FAILED', 'FAILED']);
const ready = new Set(['CHAPTERS_READY', 'READY']);
const almostReady = new Set(['TEXT_READY', 'ANALYSIS_QUEUED', 'ANALYZING']);

export function mapBookStatus(book: Pick<ApiBook, 'status' | 'security_status' | 'validation_status' | 'can_view_original'>, processing?: Pick<ProcessingStatus, 'status' | 'securityStatus' | 'validationStatus' | 'canViewOriginal'> | null): BookStatusView {
  const raw = processing?.status ?? book.status;
  const canViewOriginal = Boolean(processing?.canViewOriginal ?? book.can_view_original ?? ((processing?.securityStatus === 'CLEAN' && processing.validationStatus === 'VALID') || (book.security_status === 'CLEAN' && book.validation_status === 'VALID')));
  if (failed.has(raw)) return { status: 'FAILED', label: "We couldn't prepare this document.", detail: 'You can retry preparation or read the original PDF.', eta: '', canViewOriginal, isTerminal: true };
  if (ready.has(raw)) return { status: 'READY', label: 'Ready', detail: 'Your document is ready.', eta: '', canViewOriginal: true, isTerminal: true };
  if (almostReady.has(raw)) return { status: 'ALMOST_READY', label: 'Almost ready…', detail: 'PlayBook is finishing your document in the background.', eta: 'Usually ready in a few minutes', canViewOriginal, isTerminal: false };
  if (book.security_status !== 'CLEAN' || book.validation_status !== 'VALID' || processing?.securityStatus !== 'CLEAN' || processing?.validationStatus !== 'VALID') return { status: 'PREPARING', label: 'Checking your document…', detail: 'We are checking your document before making it available.', eta: 'Usually ready in a few minutes', canViewOriginal: false, isTerminal: false };
  return { status: 'PREPARING', label: 'Preparing your document…', detail: 'PlayBook is preparing your document in the background.', eta: 'About 2–5 minutes', canViewOriginal, isTerminal: false };
}

export function estimateUploadEta(status: string): string {
  if (status === 'OCR_REQUIRED' || status === 'OCR_PROCESSING') return 'May take a few minutes';
  if (status === 'ANALYZING' || status === 'ANALYSIS_QUEUED') return 'About 1–2 minutes';
  return 'About 2–5 minutes';
}
