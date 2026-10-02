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
  status: 'CREATED' | 'UPLOAD_PENDING' | 'UPLOADED' | 'UPLOAD_FAILED' | 'PROCESSING' | 'READY' | 'FAILED';
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
};

export type CreateBookResponse = {
  book: ApiBook;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  expiresAt: string;
};
export type ProcessingStatus = { bookId: string; status: string; progress: number; stage: string; errorCode: string | null; jobStatus: string | null };

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

export function createBook(input: { originalFilename: string; mimeType: 'application/pdf'; sizeBytes: number; title?: string }) {
  return apiRequest<CreateBookResponse>('/books', { method: 'POST', body: JSON.stringify(input) });
}

export function listBooks() {
  return apiRequest<ApiBook[]>('/books');
}

export function getBook(bookId: string) {
  return apiRequest<ApiBook>(`/books/${encodeURIComponent(bookId)}`);
}

export function completeBookUpload(bookId: string) {
  return apiRequest<{ book: ApiBook; job: { id: string; status: string; progress_percent: number } }>(`/books/${encodeURIComponent(bookId)}/upload-complete`, { method: 'POST', body: JSON.stringify({}) });
}

export function getProcessingStatus(bookId: string) { return apiRequest<ProcessingStatus>(`/books/${encodeURIComponent(bookId)}/processing-status`); }

export function deleteBook(bookId: string) {
  return apiRequest<void>(`/books/${encodeURIComponent(bookId)}`, { method: 'DELETE' });
}
