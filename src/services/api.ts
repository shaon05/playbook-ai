import { supabase } from "@/lib/supabase";

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export type ApiErrorBody = { code: string; message: string; details?: unknown };

export class ApiRequestError extends Error {
  constructor(public readonly status: number, public readonly body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiRequestError";
  }
}

export type MeResponse = {
  id: string;
  email: string | null;
  profile: Record<string, unknown> | null;
};

export type ApiBook = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  status: 'CREATED' | 'UPLOAD_PENDING' | 'UPLOADED' | 'EXTRACTION_QUEUED' | 'EXTRACTING' | 'OCR_REQUIRED' | 'OCR_PROCESSING' | 'TEXT_READY' | 'ANALYSIS_QUEUED' | 'ANALYZING' | 'CHAPTERS_READY' | 'UPLOAD_FAILED' | 'PROCESSING_FAILED' | 'PROCESSING' | 'READY' | 'FAILED';
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
  security_status?: 'QUARANTINED' | 'SCANNING' | 'CLEAN' | 'REJECTED' | 'MALICIOUS' | 'SUSPICIOUS' | 'SCAN_FAILED';
  validation_status?: 'PENDING' | 'VALID' | 'INVALID';
  can_view_original?: boolean;
};

export type CreateBookResponse = {
  book: ApiBook;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};
export type ProcessingStatus = { bookId: string; status: string; progress: number; stage: string; errorCode: string | null; safeErrorMessage?: string | null; jobStatus: string | null; securityStatus?: string; validationStatus?: string; canViewOriginal?: boolean };
export type ApiChapter = { id: string; chapter_index: number; title: string; start_page: number | null; end_page: number | null; text_start_offset: number; text_end_offset: number; word_count: number | null; estimated_listening_seconds: number | null };

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiUrl) throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new ApiRequestError(401, { code: "UNAUTHORIZED", message: "Sign in is required." });

  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers, Authorization: `Bearer ${accessToken}` },
  });
  const text = await response.text();
  let payload: { data?: T; error?: ApiErrorBody } = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { throw new ApiRequestError(response.status, { code: "INVALID_RESPONSE", message: "The API returned an invalid response." }); }
  if (!response.ok) throw new ApiRequestError(response.status, payload.error ?? { code: "API_ERROR", message: "The API request failed." });
  return payload.data as T;
}

/** Development connectivity helper for the authenticated mobile session. */
export function getCurrentUserFromApi() {
  return apiRequest<MeResponse>("/me");
}

export type SupportedDocumentMimeType = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/heic' | 'image/heif';
export function createBook(input: { originalFilename: string; mimeType: SupportedDocumentMimeType; sizeBytes: number; title?: string }) {
  return apiRequest<CreateBookResponse>('/books', { method: 'POST', body: JSON.stringify(input) });
}

export function listBooks() {
  return apiRequest<ApiBook[]>('/books');
}

export function getBook(bookId: string) {
  return apiRequest<ApiBook>(`/books/${encodeURIComponent(bookId)}`);
}

export function completeBookUpload(bookId: string) {
  return apiRequest<{ book: ApiBook; job: { id: string; status: string; progress_percent: number } | null; duplicate?: boolean; existingBookId?: string; title?: string; message?: string }>(`/books/${encodeURIComponent(bookId)}/upload-complete`, { method: 'POST', body: JSON.stringify({}) });
}
export function failBookUpload(bookId: string) { return apiRequest<{ id: string; status: 'UPLOAD_FAILED' }>(`/books/${encodeURIComponent(bookId)}/upload-failed`, { method: 'POST', body: JSON.stringify({}) }); }
export function retryBookUpload(bookId: string) { return apiRequest<CreateBookResponse>(`/books/${encodeURIComponent(bookId)}/upload-retry`, { method: 'POST', body: JSON.stringify({}) }); }

export function getProcessingStatus(bookId: string) { return apiRequest<ProcessingStatus>(`/books/${encodeURIComponent(bookId)}/processing-status`); }
export function getOriginalBookUrl(bookId: string) { return apiRequest<{ url: string; expiresAt: string }>(`/books/${encodeURIComponent(bookId)}/original-url`); }
export function retryBook(bookId: string) { return apiRequest<{ bookId: string; jobId: string; status: string }>(`/books/${encodeURIComponent(bookId)}/retry`, { method: 'POST', body: JSON.stringify({}) }); }
export function getChapters(bookId: string) { return apiRequest<ApiChapter[]>(`/books/${encodeURIComponent(bookId)}/chapters`); }
export type CreatorProfile = { id: string; user_id: string; display_name: string; bio: string | null; primary_language: string | null; status: 'PENDING' | 'ACTIVE' | 'SUSPENDED'; avatar_url: string | null; followerCount?: number; verificationStatus?: string };
export function getCreatorProfile() { return apiRequest<CreatorProfile | null>('/creator/profile'); }
export function createCreatorProfile(input: { displayName: string; bio?: string; primaryLanguage?: string }) { return apiRequest<CreatorProfile>('/creator/profile', { method: 'POST', body: JSON.stringify(input) }); }
export function updateCreatorProfile(input: { displayName: string; bio?: string; primaryLanguage?: string; avatarUrl?: string }) { return apiRequest<CreatorProfile>('/creator/profile', { method: 'PATCH', body: JSON.stringify(input) }); }
export type CreatorVerification = { status: 'NOT_APPLIED' | 'APPLIED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REVOKED'; creator_visible_message: string | null; submitted_at: string | null };
export function getCreatorVerification() { return apiRequest<CreatorVerification>('/creator/verification'); }
export function applyForCreatorVerification(reason?: string) { return apiRequest<{ status: CreatorVerification['status']; submitted_at: string }>('/creator/verification/apply', { method: 'POST', body: JSON.stringify({ reason }) }); }
  export type CreatorMonetization = { status: string; standing: string; followersCurrent: number; followersRequired: number; qualifiedListeningSecondsCurrent: number; qualifiedListeningHoursCurrent: number; qualifiedListeningHoursRequired: number; guidelinesAccepted: boolean; goodStanding: boolean; earningBlocked: boolean; eligible: boolean };
  export function getCreatorMonetization() { return apiRequest<CreatorMonetization>('/creator/monetization'); }
  export type CreatorContentEarning = { earningTier: 'NOT_EARNING' | 'EARLY_EARNING' | 'FULL_MONETIZATION'; audioSource: string; generationScope: string | null; commercialGenerationPaid: boolean; creatorShareBps: number | null; platformShareBps: number | null; earningBlockedReason: string | null };
  export function getCreatorSubmissionEarning(id: string) { return apiRequest<CreatorContentEarning>(`/creator/submissions/${encodeURIComponent(id)}/earning`); }
export function getCreatorStudio() { return apiRequest<{ creatorId: string; analytics: unknown[] }>('/creator/studio'); }
export type CreatorDashboard = { range: '7D' | '30D' | 'ALL'; publishedStories: number; impressions: number; qualifiedListens: number; uniqueListeners: number; listeningSeconds: number; averageCompletionPercent: number; completions: number; favorites: number; followers: number; shares: number };
export function getCreatorDashboard(range: CreatorDashboard['range'] = '30D') { return apiRequest<CreatorDashboard>(`/creator/dashboard?range=${range}`); }
export function getCreatorStories() { return apiRequest<{ id: string; creator_submission_id: string | null; title: string; status: string; visibility: string; content_type: string; language: string | null }[]>('/creator/stories'); }
export type CreatorStoryAnalytics = { range: '7D' | '30D' | 'ALL'; title: string; daily: { date: string; impressions: number; qualified_listens: number; unique_listeners: number; listening_seconds: number; average_completion_percent: number; completions: number; favorites_added: number; followers_gained: number; shares: number }[] };
export function getCreatorStoryAnalytics(contentId: string, range: CreatorStoryAnalytics['range'] = '30D') { return apiRequest<CreatorStoryAnalytics>(`/creator/stories/${encodeURIComponent(contentId)}/analytics?range=${range}`); }
export type CatalogGenre = { id: string; name: string; slug: string; sort_order: number };
export function getCatalogGenres() { return fetchPublicApi<CatalogGenre[]>('/catalog/genres'); }
export function getRecommendations() { return fetchPublicApi<CatalogResult[]>('/catalog/recommendations'); }
export type CreatorSubmissionInput = { title: string; shortDescription?: string; description?: string; language?: string; tags?: string[]; visibilityIntent?: 'PRIVATE' | 'PUBLIC'; genreIds?: string[]; rightsDeclaration?: string; declarationVersion?: string; coverStorageKey?: string; coverAltText?: string; audioSourceType?: 'OWN_RECORDING' | 'PROFESSIONAL_STUDIO' | 'EXTERNAL_AI' | 'OTHER_AUTHORIZED_SOURCE'; externalAudioProviderName?: string; audioRightsDeclaration?: string };
export function createCreatorSubmission(input: CreatorSubmissionInput) { return apiRequest<{ id: string; status: string }>('/creator/submissions', { method: 'POST', body: JSON.stringify(input) }); }
export function listCreatorSubmissions() { return apiRequest<{ id: string; title: string; description: string | null; language: string | null; status: string; creator_review_state: string; moderation_notes: string | null; created_at: string; updated_at: string }[]>('/creator/submissions'); }
export function deleteCreatorSubmission(id: string) { return apiRequest<void>(`/creator/submissions/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
export function getCreatorUploadUrl(id: string, input: { originalFilename: string; mimeType: 'application/pdf'; sizeBytes: number }) { return apiRequest<{ uploadUrl: string; requiredHeaders: Record<string, string>; key: string }>(`/creator/submissions/${id}/upload-url`, { method: 'POST', body: JSON.stringify(input) }); }
export function completeCreatorUpload(id: string) { return apiRequest<{ id: string; status: string; source_size_bytes: number }>(`/creator/submissions/${id}/upload-complete`, { method: 'POST', body: JSON.stringify({}) }); }
export function submitCreatorSubmission(id: string, input: Required<Pick<CreatorSubmissionInput, 'title' | 'genreIds' | 'rightsDeclaration' | 'declarationVersion'>> & Pick<CreatorSubmissionInput, 'description'>) { return apiRequest<{ id: string; status: string }>(`/creator/submissions/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }); }
export function getCreatorSubmission(id: string) { return apiRequest<{ id: string; title: string; description: string | null; language: string | null; status: string; creator_review_state: string; rights_declaration?: string | null; source_storage_key?: string | null; source_original_filename: string | null; source_size_bytes: number | null; content_asset_id: string | null; submission_genres: { genre_id: string; genres: { name: string } | null }[]; creator_moderation_reviews: { decision: string; creator_visible_message: string | null }[] }>(`/creator/submissions/${id}`); }
export function updateCreatorSubmission(id: string, input: CreatorSubmissionInput) { return apiRequest<{ id: string; title: string; description: string | null; language: string | null; status: string }>(`/creator/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(input) }); }
export function getCreatorCoverUploadUrl(id: string, input: { mimeType: 'image/jpeg' | 'image/png'; sizeBytes: number }) { return apiRequest<{ uploadUrl: string; requiredHeaders: Record<string, string>; key: string }>(`/creator/submissions/${id}/cover-upload-url`, { method: 'POST', body: JSON.stringify(input) }); }
export function completeCreatorCoverUpload(id: string, key: string, altText?: string) { return apiRequest<{ id: string; cover_storage_key: string; cover_alt_text: string | null }>(`/creator/submissions/${id}/cover-upload-complete`, { method: 'POST', body: JSON.stringify({ key, altText }) }); }
export function getCreatorAudioUploadUrl(id: string, input: { mimeType: 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/flac'; sizeBytes: number; audioSourceType: string; externalAudioProviderName?: string }) { return apiRequest<{ uploadUrl: string; requiredHeaders: Record<string, string>; key: string }>(`/creator/submissions/${id}/audio-upload-url`, { method: 'POST', body: JSON.stringify(input) }); }
export function completeCreatorAudioUpload(id: string, key: string, input: { audioSourceType: string; externalAudioProviderName?: string; rightsDeclaration: string; rightsVersion: string }) { return apiRequest<{ id: string; audio_status: string; audio_duration_seconds: number }>(`/creator/submissions/${id}/audio-upload-complete`, { method: 'POST', body: JSON.stringify({ key, ...input }) }); }
export function submitCreatorSubmissionDirect(id: string, input: Required<Pick<CreatorSubmissionInput, 'title' | 'language' | 'genreIds' | 'rightsDeclaration' | 'declarationVersion'>> & CreatorSubmissionInput) { return apiRequest<{ id: string; status: string }>(`/creator/submissions/${id}/submit`, { method: 'POST', body: JSON.stringify(input) }); }
export function applyForMonetization() { return apiRequest<{ status: string }>('/creator/monetization/apply', { method: 'POST', body: JSON.stringify({}) }); }
export function acceptCreatorGuidelines(version: string) { return apiRequest<{ acceptedAt: string }>('/creator/guidelines/accept', { method: 'POST', body: JSON.stringify({ version }) }); }
export function publishCreatorSubmission(id: string) { return apiRequest<{ id: string; status: string; visibility: string }>(`/creator/submissions/${id}/publish`, { method: 'POST', body: JSON.stringify({}) }); }
export function unpublishCreatorSubmission(id: string) { return apiRequest<{ id: string; status: string }>(`/creator/submissions/${id}/unpublish`, { method: 'POST', body: JSON.stringify({}) }); }
  export function getPublicCreator(creatorId: string) { return fetchPublicApi<{ creator: { id: string; display_name: string; bio: string | null; primary_language: string | null; avatar_url: string | null; followerCount: number }; stories: CatalogResult[] }>(`/creator/public/${encodeURIComponent(creatorId)}`); }
  export function getPublicCreatorVerification(creatorId: string) { return fetchPublicApi<{ status: 'VERIFIED' | 'NOT_APPLIED' }>(`/creator/public/${encodeURIComponent(creatorId)}/verification`); }
export function followCreator(creatorId: string) { return apiRequest<void>(`/creator/${encodeURIComponent(creatorId)}/follow`, { method: 'POST', body: JSON.stringify({}) }); }
export function unfollowCreator(creatorId: string) { return apiRequest<void>(`/creator/${encodeURIComponent(creatorId)}/follow`, { method: 'DELETE' }); }
export type CatalogResult = { id: string; title: string; author_display_name: string | null; description: string | null; content_type: string; language: string | null; creator_id: string | null };
export function searchCatalog(query: string) { return fetchPublicApi<{ content: CatalogResult[]; creators: unknown[] }>(`/search?q=${encodeURIComponent(query)}`); }
export function getCatalogContent(contentId: string) { return fetchPublicApi<CatalogResult>(`/catalog/content/${encodeURIComponent(contentId)}`); }
async function fetchPublicApi<T>(path: string): Promise<T> { const base = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, ''); if (!base) throw new Error('EXPO_PUBLIC_API_URL is not configured.'); const response = await fetch(`${base}${path}`, { headers: { Accept: 'application/json' } }); const payload = await response.json() as { data?: T; error?: ApiErrorBody }; if (!response.ok) throw new Error(payload.error?.message ?? 'Unable to load public content.'); return payload.data as T; }

export function deleteBook(bookId: string) {
  return apiRequest<void>(`/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
}
