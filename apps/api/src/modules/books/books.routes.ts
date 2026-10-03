import { Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiEnv } from "../../config/env";
import { ApiError } from "../../errors/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { createUploadRateLimitStore, uploadRateLimit } from "../../middleware/upload-rate-limit";
import type { StorageProvider } from "../../providers/storage/storage.provider";
import type { MalwareScanner } from "../../security/malware-scanner";
import { validateDocumentBytes } from "../../security/document-validator";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";
import { recordSecurityEvent } from "../../security/enforcement";
import { isVisibleInLibrary } from "./book-visibility";
import { duplicateMessageForStatus, isActiveDuplicateConstraintError } from "./private-library-duplicates";

const uuidSchema = z.string().uuid();
const createBookSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"]),
  sizeBytes: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
}).strict();

function safeTitle(filename: string) {
  return filename.replace(/\.pdf$/i, "").trim().slice(0, 200) || "Untitled PDF";
}

function sourceKey(userId: string, bookId: string) {
  return `quarantine/users/${userId}/uploads/${bookId}/original`;
}

function asBook(value: Record<string, unknown>) {
  return value;
}

function logDatabaseError(event: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(JSON.stringify({ event, code: error.code, message: error.message, details: error.details, hint: error.hint }));
}

function logUploadStage(stage: string, values: { bookId?: string; status?: number; code?: string; message?: string } = {}) {
  console.error(JSON.stringify({ event: "private_upload_stage", stage, ...values }));
}

export function createBooksRouter(env: ApiEnv, storage: StorageProvider, clientFactory?: (token: string) => SupabaseClient, scanner?: MalwareScanner) {
  const router = Router();
  const uploadRateLimitStore = env.NODE_ENV === "production" && env.SUPABASE_SERVICE_ROLE_KEY ? createUploadRateLimitStore(env, createSupabaseAdminClient(env)) : createUploadRateLimitStore(env);
  router.use(requireAuth(env, clientFactory));

  router.post("/", uploadRateLimit(env, uploadRateLimitStore), async (req, res, next) => {
    let stage = "create_authorization";
    let bookId: string | undefined;
    try {
      const input = createBookSchema.parse(req.body);
      if (input.sizeBytes > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "This file is too large.");
      const userId = req.auth!.id;
      const client = req.supabase!;
      const restrictionTable = client.from("account_restrictions") as unknown as { select?: (columns: string) => { eq: (...args: unknown[]) => { eq: (...args: unknown[]) => { in: (...args: unknown[]) => { limit: (count: number) => { maybeSingle: () => Promise<{ data: unknown }> } } } } } };
      const { data: restriction } = typeof restrictionTable.select === "function" ? await restrictionTable.select("id").eq("user_id", userId).eq("status", "ACTIVE").in("restriction_type", ["UPLOAD_BLOCKED", "ACCOUNT_SUSPENDED"]).limit(1).maybeSingle() : { data: null };
      if (restriction) throw new ApiError(403, "UPLOAD_RESTRICTED", "Your upload access has been temporarily restricted. Contact Support and provide your security reference.");
      const { data: book, error: bookError } = await client.from("books").insert({ user_id: userId, title: input.title ?? safeTitle(input.originalFilename), status: "UPLOAD_PENDING", original_filename: input.originalFilename, mime_type: input.mimeType, file_size_bytes: input.sizeBytes }).select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").single();
      logDatabaseError("supabase_books_insert_failed", bookError);
      if (bookError || !book) throw new ApiError(500, "BOOK_CREATE_FAILED", "Unable to create the book upload.");
      bookId = book.id;
      stage = "presigned_upload_authorization";
      const key = sourceKey(userId, book.id);
      const { error: fileError } = await client.from("book_files").insert({ book_id: book.id, user_id: userId, file_type: "SOURCE", storage_provider: "S3", storage_bucket: env.AWS_S3_BUCKET, storage_key: key, mime_type: input.mimeType, size_bytes: input.sizeBytes });
      logDatabaseError("supabase_book_files_insert_failed", fileError);
      if (fileError) { await client.from("books").delete().eq("id", book.id).eq("user_id", userId); throw new ApiError(500, "BOOK_FILE_CREATE_FAILED", "Unable to prepare the book upload."); }
      const { error: uploadRecordError } = await client.from("document_uploads").insert({ user_id: userId, book_id: book.id, upload_context: "PRIVATE_LIBRARY", original_filename: input.originalFilename, declared_mime_type: input.mimeType, storage_key: key });
      logDatabaseError("supabase_document_upload_insert_failed", uploadRecordError);
      if (uploadRecordError) { await client.from("book_files").delete().eq("book_id", book.id).eq("user_id", userId); await client.from("books").delete().eq("id", book.id).eq("user_id", userId); throw new ApiError(500, "UPLOAD_RECORD_CREATE_FAILED", "Unable to prepare the document upload."); }
      try {
        const upload = await storage.createUploadUrl({ key, contentType: input.mimeType, contentLength: input.sizeBytes, expiresInSeconds: env.S3_PRESIGNED_URL_EXPIRES_SECONDS });
        res.status(201).json({ data: { book: asBook(book), uploadUrl: upload.url, requiredHeaders: upload.headers, expiresAt: upload.expiresAt } });
      } catch {
        logUploadStage("presigned_upload_authorization", { bookId, status: 502, code: "S3_ERROR" });
        await client.from("books").update({ status: "UPLOAD_FAILED" }).eq("id", book.id).eq("user_id", userId);
        throw new ApiError(502, "S3_ERROR", "Unable to prepare secure file storage.");
      }
    } catch (error) {
      logUploadStage(stage, { bookId, status: error instanceof ApiError ? error.statusCode : error instanceof z.ZodError ? 400 : 500, code: error instanceof ApiError ? error.code : error instanceof z.ZodError ? "VALIDATION_ERROR" : "INTERNAL_SERVER_ERROR", message: error instanceof ApiError ? error.message : error instanceof z.ZodError ? "request validation failed" : error instanceof Error ? error.message : "unknown error" });
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const { data, error } = await req.supabase!.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("user_id", req.auth!.id).is("deleted_at", null).order("created_at", { ascending: false });
      if (error) throw new ApiError(500, "BOOK_LIST_FAILED", "Unable to load your library.");
      const visibleBooks = (data ?? []).filter((book) => isVisibleInLibrary(book.status));
      const ids = visibleBooks.map((book) => book.id);
      const { data: uploads, error: uploadError } = ids.length ? await req.supabase!.from("document_uploads").select("book_id,security_status,validation_status").eq("user_id", req.auth!.id).in("book_id", ids) : { data: [], error: null };
      if (uploadError) throw new ApiError(500, "BOOK_LIST_FAILED", "Unable to load your library.");
      const securityByBook = new Map((uploads ?? []).map((upload) => [upload.book_id, upload]));
      res.json({ data: visibleBooks.map((book) => ({ ...book, ...(securityByBook.get(book.id) ?? { security_status: "QUARANTINED", validation_status: "PENDING" }), can_view_original: securityByBook.get(book.id)?.security_status === "CLEAN" && securityByBook.get(book.id)?.validation_status === "VALID" })) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:bookId", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const { data, error } = await req.supabase!.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at,book_files(id,file_type,storage_provider,size_bytes,etag)").eq("id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (error) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to load this book.");
      if (!data) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: upload } = await req.supabase!.from("document_uploads").select("security_status,validation_status").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      res.json({ data: { ...data, ...(upload ?? { security_status: "QUARANTINED", validation_status: "PENDING" }), can_view_original: upload?.security_status === "CLEAN" && upload?.validation_status === "VALID" } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:bookId/original-url", async (req, res, next) => {
    try {
      if (!storage.createDownloadUrl) throw new ApiError(503, "PDF_VIEW_UNAVAILABLE", "Original document viewing is unavailable.");
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book } = await client.from("books").select("id,mime_type").eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).maybeSingle();
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: upload } = await client.from("document_uploads").select("security_status,validation_status").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (upload?.security_status !== "CLEAN" || upload.validation_status !== "VALID") throw new ApiError(409, "PDF_NOT_READY", "This document is still being checked for safe viewing.");
      const { data: file } = await client.from("book_files").select("storage_key,mime_type").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("file_type", "SOURCE").maybeSingle();
      if (!file) throw new ApiError(404, "BOOK_FILE_NOT_FOUND", "Original document not found.");
      const signed = await storage.createDownloadUrl({ key: file.storage_key, contentType: file.mime_type || book.mime_type, expiresInSeconds: Math.min(300, env.S3_PRESIGNED_URL_EXPIRES_SECONDS) });
      res.json({ data: { url: signed.url, expiresAt: signed.expiresAt } });
    } catch (error) { next(error); }
  });

  router.post("/:bookId/upload-complete", async (req, res, next) => {
    let stage = "upload_completion_lookup";
    const bookIdForLog = req.params.bookId;
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (bookError) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to verify this book.");
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: existingJob, error: existingJobError } = await client.from("processing_jobs").select("id,status,progress_percent").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existingJobError) throw new ApiError(500, "PROCESSING_JOB_LOOKUP_FAILED", "Unable to verify document preparation.");
      if (existingJob) return res.json({ data: { book, job: existingJob } });
      stage = "s3_upload_verification";
      const { data: file, error: fileError } = await client.from("book_files").select("id,storage_key,mime_type,size_bytes").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (fileError || !file) throw new ApiError(500, "BOOK_FILE_LOOKUP_FAILED", "Unable to verify this upload.");
      const metadata = await storage.getObjectMetadata({ key: file.storage_key });
      if (!metadata || metadata.contentLength !== file.size_bytes || (metadata.contentType && metadata.contentType !== file.mime_type)) throw new ApiError(400, "UPLOAD_VERIFICATION_FAILED", "The uploaded PDF could not be verified.");
      const uploadRecord = await client.from("document_uploads").select("id,security_status,validation_status,declared_mime_type").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (uploadRecord.error || !uploadRecord.data) throw new ApiError(500, "UPLOAD_RECORD_LOOKUP_FAILED", "Unable to verify this document upload.");
      const tempPath = path.join(os.tmpdir(), `playbook-upload-${uploadRecord.data.id}`); const admin = env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient(env) : client;
      let sourceSha256: string | null = null;
      stage = "document_security_validation";
      try {
        await client.from("document_uploads").update({ security_status: "SCANNING", file_size_bytes: metadata.contentLength }).eq("id", uploadRecord.data.id).eq("user_id", req.auth!.id);
        await storage.downloadObject({ key: file.storage_key, destination: tempPath });
        const bytes = new Uint8Array(await import("node:fs/promises").then((fs) => fs.readFile(tempPath))); const hash = createHash("sha256").update(bytes).digest("hex"); sourceSha256 = hash;
        const validation = await validateDocumentBytes(bytes, uploadRecord.data.declared_mime_type, env.MAX_IMAGE_PIXELS);
        if (!validation.valid) { const reference = await recordSecurityEvent(admin, { uploadId: uploadRecord.data.id, userId: req.auth!.id, eventType: validation.reasonCode === "FILE_TYPE_MISMATCH" ? "FILE_TYPE_MISMATCH" : "UNSUPPORTED_FILE_TYPE", severity: "LOW", reasonCode: validation.reasonCode ?? "INVALID_DOCUMENT", safeSummary: validation.summary ?? "The document could not be accepted.", detectedFileType: validation.detectedMimeType, fileSha256: hash }); await client.from("document_uploads").update({ security_status: "REJECTED", validation_status: "INVALID", detected_mime_type: validation.detectedMimeType, sha256: hash, incident_reference: reference }).eq("id", uploadRecord.data.id).eq("user_id", req.auth!.id); throw new ApiError(400, "INVALID_DOCUMENT", `${validation.summary ?? "The document could not be accepted."} Reference ${reference}.`); }
        const scan = scanner ? await scanner.scan({ bucket: env.QUARANTINE_BUCKET ?? env.AWS_S3_BUCKET, storageKey: file.storage_key, uploadId: uploadRecord.data.id, sha256: hash }) : { status: "SCAN_FAILED" as const, provider: "none", code: "SCANNER_NOT_CONFIGURED" };
        if (scan.status === "SCAN_FAILED") { await client.from("document_uploads").update({ security_status: "SCAN_FAILED", validation_status: "PENDING", sha256: hash }).eq("id", uploadRecord.data.id).eq("user_id", req.auth!.id); throw new ApiError(409, "SECURITY_SCAN_PENDING", "We could not complete the security scan yet. Please try again shortly."); }
        if (scan.status !== "CLEAN") { const severity = scan.status === "MALICIOUS" ? "HIGH" : "MEDIUM"; const reference = await recordSecurityEvent(admin, { uploadId: uploadRecord.data.id, userId: req.auth!.id, eventType: scan.status === "MALICIOUS" ? "MALWARE_DETECTED" : "SUSPICIOUS_PAYLOAD", severity, reasonCode: scan.code, safeSummary: scan.status === "MALICIOUS" ? "This file could not be accepted for security reasons." : "This file could not be safely verified.", fileSha256: hash, scannerProvider: scan.provider, scannerResultCode: scan.code }); await client.from("document_uploads").update({ security_status: scan.status, validation_status: "PENDING", sha256: hash, incident_reference: reference }).eq("id", uploadRecord.data.id).eq("user_id", req.auth!.id); throw new ApiError(400, "SECURITY_REJECTED", `This file could not be accepted for security reasons. Reference ${reference}.`); }
        await client.from("document_uploads").update({ security_status: "CLEAN", validation_status: "VALID", detected_mime_type: validation.detectedMimeType, sha256: hash }).eq("id", uploadRecord.data.id).eq("user_id", req.auth!.id);
      } finally { await rm(tempPath, { force: true }); }
      const { data: updated, error: updateError } = await client.from("books").update({ status: "UPLOADED", source_sha256: sourceSha256 }).eq("id", bookId).eq("user_id", req.auth!.id).select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").single();
      if (isActiveDuplicateConstraintError(updateError)) {
        const { data: existingBook, error: duplicateLookupError } = await client.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("user_id", req.auth!.id).eq("source_sha256", sourceSha256).is("deleted_at", null).maybeSingle();
        if (duplicateLookupError || !existingBook) throw new ApiError(500, "BOOK_UPDATE_FAILED", "Unable to complete the book upload.");
        const { data: existingJob } = await client.from("processing_jobs").select("id,status,progress_percent").eq("book_id", existingBook.id).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").order("created_at", { ascending: false }).limit(1).maybeSingle();
        const duplicate = duplicateMessageForStatus(existingBook.status);
        await client.from("books").update({ deleted_at: new Date().toISOString() }).eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null);
        try { await storage.deleteObject({ key: file.storage_key }); } catch (error) { console.error(JSON.stringify({ event: "private_duplicate_cleanup_failed", bookId, message: error instanceof Error ? error.message : "storage cleanup failed" })); }
        return res.json({ data: { book: existingBook, job: existingJob ?? null, duplicate: true, existingBookId: existingBook.id, title: duplicate.title, message: duplicate.message } });
      }
      if (updateError || !updated) throw new ApiError(500, "BOOK_UPDATE_FAILED", "Unable to complete the book upload.");
      await client.from("book_files").update({ etag: metadata.etag ?? null, source_sha256: sourceSha256 }).eq("id", file.id).eq("user_id", req.auth!.id);
      stage = "processing_job_creation";
      const { data: job, error: jobError } = await client.from("processing_jobs").insert({ user_id: req.auth!.id, book_id: bookId, job_type: "DOCUMENT_EXTRACTION", status: "QUEUED", progress_percent: 0 }).select("id,status,progress_percent").single();
      if (jobError || !job) {
        if (jobError?.code === "23505") {
          const { data: existingJob } = await client.from("processing_jobs").select("id,status,progress_percent").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existingJob) return res.json({ data: { book: updated, job: existingJob } });
        }
        console.error(JSON.stringify({ event: "extraction_queue_insert_failed", code: jobError?.code ?? "NO_JOB", message: jobError?.message ?? "No processing job was returned." }));
        throw new ApiError(500, "EXTRACTION_QUEUE_FAILED", "The upload finished, but document preparation could not be started.");
      }
      const { data: queuedBook, error: queuedError } = await client.from("books").update({ status: "EXTRACTION_QUEUED" }).eq("id", bookId).eq("user_id", req.auth!.id).select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").single();
      if (queuedError || !queuedBook) throw new ApiError(500, "EXTRACTION_QUEUE_FAILED", "The upload finished, but document preparation could not be started.");
      res.json({ data: { book: queuedBook, job } });
    } catch (error) {
      logUploadStage(stage, { bookId: bookIdForLog, status: error instanceof ApiError ? error.statusCode : error instanceof z.ZodError ? 400 : 500, code: error instanceof ApiError ? error.code : error instanceof z.ZodError ? "VALIDATION_ERROR" : "INTERNAL_SERVER_ERROR", message: error instanceof ApiError ? error.message : error instanceof z.ZodError ? "request validation failed" : error instanceof Error ? error.message : "unknown error" });
      next(error);
    }
  });

  router.post("/:bookId/upload-failed", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const { data, error } = await req.supabase!.from("books").update({ status: "UPLOAD_FAILED" }).eq("id", bookId).eq("user_id", req.auth!.id).in("status", ["CREATED", "UPLOAD_PENDING"]).select("id,status").maybeSingle();
      if (error) {
        logDatabaseError("supabase_upload_failed_state_update_failed", error);
        logUploadStage("upload_failed_state_persist", { bookId, status: 500, code: error.code, message: error.message });
        throw new ApiError(500, "UPLOAD_FAILURE_SAVE_FAILED", "Unable to save the upload failure state.");
      }
      if (!data) throw new ApiError(404, "BOOK_NOT_FOUND", "Upload record not found.");
      res.json({ data });
    } catch (error) { next(error); }
  });

  router.post("/:bookId/upload-retry", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book } = await client.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).maybeSingle();
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Upload record not found.");
      if (!( ["CREATED", "UPLOAD_PENDING", "UPLOAD_FAILED"] as string[]).includes(book.status)) throw new ApiError(409, "UPLOAD_NOT_RETRYABLE", "This document has already completed upload.");
      const { data: existingJob } = await client.from("processing_jobs").select("id").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").limit(1).maybeSingle();
      if (existingJob) throw new ApiError(409, "UPLOAD_NOT_RETRYABLE", "Document preparation has already started.");
      const { data: file } = await client.from("book_files").select("storage_key,mime_type,size_bytes").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("file_type", "SOURCE").maybeSingle();
      if (!file) throw new ApiError(404, "BOOK_FILE_NOT_FOUND", "Upload file record not found.");
      const { error: resetError } = await client.from("document_uploads").update({ security_status: "QUARANTINED", validation_status: "PENDING", detected_mime_type: null, file_size_bytes: null, sha256: null, incident_reference: null }).eq("book_id", bookId).eq("user_id", req.auth!.id).eq("upload_context", "PRIVATE_LIBRARY");
      if (resetError) throw new ApiError(500, "UPLOAD_RETRY_RESET_FAILED", "Unable to retry this upload.");
      await client.from("books").update({ status: "UPLOAD_PENDING" }).eq("id", bookId).eq("user_id", req.auth!.id);
      const upload = await storage.createUploadUrl({ key: file.storage_key, contentType: file.mime_type, contentLength: file.size_bytes, expiresInSeconds: env.S3_PRESIGNED_URL_EXPIRES_SECONDS });
      res.json({ data: { book: { ...book, status: "UPLOAD_PENDING" }, uploadUrl: upload.url, requiredHeaders: upload.headers, expiresAt: upload.expiresAt } });
    } catch (error) { next(error); }
  });

  router.get("/:bookId/processing-status", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").select("id,status").eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).maybeSingle();
      if (bookError) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to load processing status.");
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: job } = await client.from("processing_jobs").select("status,progress_percent,error_code,error_message").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: upload } = await client.from("document_uploads").select("security_status,validation_status").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      const stage = book.status === "UPLOADED" ? "Upload complete" : book.status === "EXTRACTION_QUEUED" ? "Reading document" : book.status === "EXTRACTING" ? "Reading document" : book.status === "OCR_REQUIRED" || book.status === "OCR_PROCESSING" ? "Recognizing scanned pages" : book.status === "TEXT_READY" || book.status === "ANALYSIS_QUEUED" ? "Understanding your book" : book.status === "ANALYZING" ? "Finding chapters" : book.status === "CHAPTERS_READY" ? "Book ready" : book.status === "EXTRACTION_FAILED" || book.status === "PROCESSING_FAILED" ? "We couldn't prepare this document." : "Preparing your book";
      res.json({ data: { bookId, status: book.status, progress: job?.progress_percent ?? (book.status === "TEXT_READY" ? 100 : 0), stage, errorCode: book.status === "EXTRACTION_FAILED" ? job?.error_code ?? null : null, safeErrorMessage: book.status === "EXTRACTION_FAILED" || book.status === "PROCESSING_FAILED" ? "We couldn't prepare this document." : null, jobStatus: job?.status ?? null, securityStatus: upload?.security_status ?? "QUARANTINED", validationStatus: upload?.validation_status ?? "PENDING", canViewOriginal: upload?.security_status === "CLEAN" && upload?.validation_status === "VALID" } });
    } catch (error) { next(error); }
  });

  router.post("/:bookId/retry", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book } = await client.from("books").select("id,status").eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).maybeSingle();
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      if (!("EXTRACTION_FAILED" === book.status || "PROCESSING_FAILED" === book.status || "FAILED" === book.status)) throw new ApiError(409, "BOOK_NOT_RETRYABLE", "This document does not need a retry.");
      const { data: upload } = await client.from("document_uploads").select("security_status,validation_status").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (upload?.security_status !== "CLEAN" || upload.validation_status !== "VALID") throw new ApiError(409, "PDF_NOT_READY", "This document must pass its safety check before processing can restart.");
      const { data: active } = await client.from("processing_jobs").select("id,status").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").in("status", ["QUEUED", "RUNNING"]).maybeSingle();
      if (active) return res.json({ data: { bookId, jobId: active.id, status: active.status } });
      const { data: job, error } = await client.from("processing_jobs").insert({ user_id: req.auth!.id, book_id: bookId, job_type: "DOCUMENT_EXTRACTION", status: "QUEUED", progress_percent: 0 }).select("id,status,progress_percent").single();
      if (error || !job) throw new ApiError(500, "RETRY_FAILED", "Unable to restart document preparation.");
      await client.from("books").update({ status: "EXTRACTION_QUEUED" }).eq("id", bookId).eq("user_id", req.auth!.id);
      res.status(202).json({ data: { bookId, jobId: job.id, status: job.status } });
    } catch (error) { next(error); }
  });

  router.get("/:bookId/chapters", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").select("id,content_asset_id").eq("id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (bookError) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to load this book.");
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      if (!book.content_asset_id) return res.json({ data: [] });
      const { data, error } = await client.from("content_chapters").select("id,chapter_index,title,start_page,end_page,text_start_offset,text_end_offset,word_count,estimated_listening_seconds").eq("content_asset_id", book.content_asset_id).order("chapter_index", { ascending: true });
      if (error) throw new ApiError(500, "CHAPTERS_LOOKUP_FAILED", "Unable to load chapters.");
      res.json({ data: data ?? [] });
    } catch (error) { next(error); }
  });

  router.delete("/:bookId", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book } = await client.from("books").select("id,status").eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).maybeSingle();
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: sourceFile } = ["CREATED", "UPLOAD_PENDING", "UPLOAD_FAILED"].includes(book.status)
        ? await client.from("book_files").select("storage_key").eq("book_id", bookId).eq("user_id", req.auth!.id).eq("file_type", "SOURCE").maybeSingle()
        : { data: null };
      const { data, error } = await client.from("books").update({ deleted_at: new Date().toISOString() }).eq("id", bookId).eq("user_id", req.auth!.id).is("deleted_at", null).select("id").maybeSingle();
      if (error) throw new ApiError(500, "BOOK_DELETE_FAILED", "Unable to remove this book from your library.");
      if (!data) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      if (sourceFile?.storage_key) {
        try { await storage.deleteObject({ key: sourceFile.storage_key }); }
        catch (error) { console.error(JSON.stringify({ event: "private_upload_cleanup_failed", bookId, message: error instanceof Error ? error.message : "storage cleanup failed" })); }
      }
      const admin = env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient(env) : client;
      await admin.from("processing_jobs").update({ status: "FAILED", error_code: "USER_REMOVED", error_message: "The user removed this document before preparation completed." }).eq("book_id", bookId).eq("user_id", req.auth!.id).eq("job_type", "DOCUMENT_EXTRACTION").eq("status", "QUEUED");
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
