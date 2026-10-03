import { Router } from "express";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiEnv } from "../../config/env";
import { ApiError } from "../../errors/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import { uploadRateLimit } from "../../middleware/upload-rate-limit";
import type { StorageProvider } from "../../providers/storage/storage.provider";
import type { MalwareScanner } from "../../security/malware-scanner";
import { validateDocumentBytes } from "../../security/document-validator";
import { createSupabaseAdminClient } from "../../lib/supabase-admin";
import { recordSecurityEvent } from "../../security/enforcement";

const uuid = z.string().uuid();
const pageInput = z.object({ originalFilename: z.string().trim().min(1).max(255), mimeType: z.enum(["image/jpeg", "image/png", "image/heic", "image/heif"]), sizeBytes: z.number().int().positive(), pageIndex: z.number().int().min(0) }).strict();

export function createDocumentsRouter(env: ApiEnv, storage: StorageProvider, clientFactory?: (token: string) => SupabaseClient, scanner?: MalwareScanner) {
  const router = Router();
  router.use(requireAuth(env, clientFactory));
  router.post("/", async (req, res, next) => {
    try {
      const title = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body).title;
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").insert({ user_id: req.auth!.id, title, status: "UPLOAD_PENDING", original_filename: title, mime_type: "image/jpeg", file_size_bytes: 1 }).select("id").single();
      if (bookError || !book) throw new ApiError(500, "DOCUMENT_CREATE_FAILED", "Unable to create the document.");
      const { data: document, error } = await client.from("documents").insert({ user_id: req.auth!.id, book_id: book.id, status: "DRAFT" }).select("id,book_id,status").single();
      if (error || !document) throw new ApiError(500, "DOCUMENT_CREATE_FAILED", "Unable to create the document.");
      res.status(201).json({ data: document });
    } catch (error) { next(error); }
  });

  router.post("/:documentId/pages", uploadRateLimit(env), async (req, res, next) => {
    try {
      const documentId = uuid.parse(req.params.documentId); const input = pageInput.parse(req.body); const client = req.supabase!;
      const { data: document } = await client.from("documents").select("id,book_id").eq("id", documentId).eq("user_id", req.auth!.id).maybeSingle();
      if (!document) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
      const key = `quarantine/users/${req.auth!.id}/documents/${documentId}/pages/${randomUUID()}/original`;
      const { data: page, error: pageError } = await client.from("document_input_pages").insert({ document_id: documentId, page_index: input.pageIndex }).select("id").single();
      if (pageError || !page) throw new ApiError(409, "PAGE_ORDER_CONFLICT", "That page position is already in use.");
      const { data: upload, error: uploadError } = await client.from("document_uploads").insert({ user_id: req.auth!.id, book_id: document.book_id, document_id: documentId, input_page_id: page.id, upload_context: "PRIVATE_LIBRARY", original_filename: input.originalFilename, declared_mime_type: input.mimeType, storage_key: key }).select("id").single();
      if (uploadError || !upload) throw new ApiError(500, "UPLOAD_RECORD_CREATE_FAILED", "Unable to prepare the page upload.");
      await client.from("document_input_pages").update({ upload_id: upload.id }).eq("id", page.id);
      const signed = await storage.createUploadUrl({ key, contentType: input.mimeType, contentLength: input.sizeBytes, expiresInSeconds: env.S3_PRESIGNED_URL_EXPIRES_SECONDS });
      res.status(201).json({ data: { pageId: page.id, uploadId: upload.id, uploadUrl: signed.url, requiredHeaders: signed.headers, expiresAt: signed.expiresAt } });
    } catch (error) { next(error); }
  });

  router.post("/:documentId/pages/:pageId/complete", async (req, res, next) => {
    try {
      const documentId = uuid.parse(req.params.documentId); const pageId = uuid.parse(req.params.pageId); const client = req.supabase!;
      const { data: page } = await client.from("document_input_pages").select("id,upload_id").eq("id", pageId).eq("document_id", documentId).maybeSingle();
      if (!page?.upload_id) throw new ApiError(404, "PAGE_NOT_FOUND", "Document page not found.");
      const { data: upload } = await client.from("document_uploads").select("id,storage_key,declared_mime_type").eq("id", page.upload_id).eq("user_id", req.auth!.id).maybeSingle();
      if (!upload) throw new ApiError(404, "UPLOAD_NOT_FOUND", "Page upload not found.");
      const metadata = await storage.getObjectMetadata({ key: upload.storage_key });
      if (!metadata?.contentLength || metadata.contentLength > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) throw new ApiError(400, "UPLOAD_VERIFICATION_FAILED", "The uploaded page could not be verified.");
      const tempPath = path.join(os.tmpdir(), `playbook-page-${upload.id}`); const admin = env.SUPABASE_SERVICE_ROLE_KEY ? createSupabaseAdminClient(env) : client;
      try {
        await client.from("document_input_pages").update({ security_status: "SCANNING" }).eq("id", page.id);
        await storage.downloadObject({ key: upload.storage_key, destination: tempPath }); const bytes = new Uint8Array(await readFile(tempPath)); const hash = createHash("sha256").update(bytes).digest("hex");
        const validation = await validateDocumentBytes(bytes, upload.declared_mime_type, env.MAX_IMAGE_PIXELS);
        if (!validation.valid) { await client.from("document_input_pages").update({ security_status: "REJECTED", validation_status: "INVALID" }).eq("id", page.id); throw new ApiError(400, "INVALID_DOCUMENT", validation.summary ?? "This page could not be read safely."); }
        const scan = scanner ? await scanner.scan({ bucket: env.QUARANTINE_BUCKET ?? env.AWS_S3_BUCKET, storageKey: upload.storage_key, uploadId: upload.id, sha256: hash }) : { status: "SCAN_FAILED" as const, provider: "none", code: "SCANNER_NOT_CONFIGURED" };
        if (scan.status === "SCAN_FAILED") { await client.from("document_input_pages").update({ security_status: "SCAN_FAILED" }).eq("id", page.id); throw new ApiError(409, "SECURITY_SCAN_PENDING", "The page security scan is not complete yet. Please retry."); }
        if (scan.status !== "CLEAN") { const reference = await recordSecurityEvent(admin, { uploadId: upload.id, userId: req.auth!.id, eventType: "MALWARE_DETECTED", severity: "HIGH", reasonCode: scan.code, safeSummary: "This page could not be accepted for security reasons.", detectedFileType: validation.detectedMimeType, fileSha256: hash, scannerProvider: scan.provider, scannerResultCode: scan.code }); await client.from("document_input_pages").update({ security_status: scan.status, validation_status: "PENDING" }).eq("id", page.id); throw new ApiError(400, "SECURITY_REJECTED", `This page could not be accepted for security reasons. Reference ${reference}.`); }
        await client.from("document_uploads").update({ security_status: "CLEAN", validation_status: "VALID", detected_mime_type: validation.detectedMimeType, file_size_bytes: metadata.contentLength, sha256: hash }).eq("id", upload.id);
        await client.from("document_input_pages").update({ security_status: "CLEAN", validation_status: "VALID" }).eq("id", page.id);
        res.json({ data: { pageId: page.id, securityStatus: "CLEAN", validationStatus: "VALID" } });
      } finally { await rm(tempPath, { force: true }); }
    } catch (error) { next(error); }
  });

  router.patch("/:documentId/pages/order", async (req, res, next) => {
    try {
      const documentId = uuid.parse(req.params.documentId); const orderedPageIds = z.array(uuid).min(1).parse(req.body.orderedPageIds); const client = req.supabase!;
      if (new Set(orderedPageIds).size !== orderedPageIds.length) throw new ApiError(400, "INVALID_PAGE_ORDER", "Page order contains duplicates.");
      const { data: pages } = await client.from("document_input_pages").select("id").eq("document_id", documentId).eq("security_status", "CLEAN");
      const existing = (pages ?? []).map((page) => page.id).sort(); if (existing.length !== orderedPageIds.length || existing.join() !== [...orderedPageIds].sort().join()) throw new ApiError(400, "INVALID_PAGE_ORDER", "Page order must contain every page exactly once.");
      for (const [pageIndex, pageId] of orderedPageIds.entries()) await client.from("document_input_pages").update({ page_index: 1000000 + pageIndex }).eq("id", pageId).eq("document_id", documentId);
      for (const [pageIndex, pageId] of orderedPageIds.entries()) await client.from("document_input_pages").update({ page_index: pageIndex }).eq("id", pageId).eq("document_id", documentId);
      res.json({ data: { documentId, orderedPageIds } });
    } catch (error) { next(error); }
  });

  router.post("/:documentId/complete", async (req, res, next) => {
    try {
      const documentId = uuid.parse(req.params.documentId); const client = req.supabase!;
      const { data: document } = await client.from("documents").select("id,book_id").eq("id", documentId).eq("user_id", req.auth!.id).maybeSingle(); if (!document) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
      const { data: pages } = await client.from("document_input_pages").select("id,page_index,security_status,validation_status").eq("document_id", documentId).order("page_index");
      if (!pages?.length || pages.some((page) => page.security_status !== "CLEAN" || page.validation_status !== "VALID")) throw new ApiError(409, "DOCUMENT_SECURITY_GATE_FAILED", "Every document page must pass security checks before processing.");
      const { data: job, error } = await client.from("processing_jobs").insert({ user_id: req.auth!.id, book_id: document.book_id, job_type: "DOCUMENT_EXTRACTION", status: "QUEUED", progress_percent: 0 }).select("id,status,progress_percent").single(); if (error || !job) throw new ApiError(500, "EXTRACTION_QUEUE_FAILED", "The document could not be queued.");
      await client.from("documents").update({ status: "PROCESSING" }).eq("id", documentId); await client.from("books").update({ status: "EXTRACTION_QUEUED" }).eq("id", document.book_id).eq("user_id", req.auth!.id);
      res.json({ data: { documentId, bookId: document.book_id, job } });
    } catch (error) { next(error); }
  });

  router.delete("/:documentId", async (req, res, next) => {
    try {
      const documentId = uuid.parse(req.params.documentId); const client = req.supabase!;
      const { data: document } = await client.from("documents").select("book_id").eq("id", documentId).eq("user_id", req.auth!.id).maybeSingle();
      if (!document) throw new ApiError(404, "DOCUMENT_NOT_FOUND", "Document not found.");
      const { error } = await client.from("books").delete().eq("id", document.book_id).eq("user_id", req.auth!.id);
      if (error) throw new ApiError(500, "DOCUMENT_DELETE_FAILED", "The temporary document could not be cleaned up.");
      res.status(204).send();
    } catch (error) { next(error); }
  });
  return router;
}
