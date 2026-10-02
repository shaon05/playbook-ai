import { Router } from "express";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiEnv } from "../../config/env";
import { ApiError } from "../../errors/api-error";
import { requireAuth } from "../../middleware/auth.middleware";
import type { StorageProvider } from "../../providers/storage/storage.provider";

const uuidSchema = z.string().uuid();
const createBookSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
}).strict();

function safeTitle(filename: string) {
  return filename.replace(/\.pdf$/i, "").trim().slice(0, 200) || "Untitled PDF";
}

function sourceKey(userId: string, bookId: string) {
  return `users/${userId}/books/${bookId}/source/original.pdf`;
}

function asBook(value: Record<string, unknown>) {
  return value;
}

function logDatabaseError(event: string, error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null) {
  if (!error) return;
  console.error(JSON.stringify({ event, code: error.code, message: error.message, details: error.details, hint: error.hint }));
}

export function createBooksRouter(env: ApiEnv, storage: StorageProvider, clientFactory?: (token: string) => SupabaseClient) {
  const router = Router();
  router.use(requireAuth(env, clientFactory));

  router.post("/", async (req, res, next) => {
    try {
      const input = createBookSchema.parse(req.body);
      if (input.sizeBytes > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) throw new ApiError(413, "FILE_TOO_LARGE", "This file is too large.");
      const userId = req.auth!.id;
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").insert({ user_id: userId, title: input.title ?? safeTitle(input.originalFilename), status: "UPLOAD_PENDING", original_filename: input.originalFilename, mime_type: input.mimeType, file_size_bytes: input.sizeBytes }).select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").single();
      logDatabaseError("supabase_books_insert_failed", bookError);
      if (bookError || !book) throw new ApiError(500, "BOOK_CREATE_FAILED", "Unable to create the book upload.");
      const key = sourceKey(userId, book.id);
      const { error: fileError } = await client.from("book_files").insert({ book_id: book.id, user_id: userId, file_type: "SOURCE", storage_provider: "S3", storage_bucket: env.AWS_S3_BUCKET, storage_key: key, mime_type: input.mimeType, size_bytes: input.sizeBytes });
      logDatabaseError("supabase_book_files_insert_failed", fileError);
      if (fileError) throw new ApiError(500, "BOOK_FILE_CREATE_FAILED", "Unable to prepare the book upload.");
      try {
        const upload = await storage.createUploadUrl({ key, contentType: input.mimeType, contentLength: input.sizeBytes, expiresInSeconds: env.S3_PRESIGNED_URL_EXPIRES_SECONDS });
        res.status(201).json({ data: { book: asBook(book), uploadUrl: upload.url, requiredHeaders: upload.headers, expiresAt: upload.expiresAt } });
      } catch {
        await client.from("books").update({ status: "UPLOAD_FAILED" }).eq("id", book.id).eq("user_id", userId);
        throw new ApiError(502, "S3_ERROR", "Unable to prepare secure file storage.");
      }
    } catch (error) {
      next(error);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      const { data, error } = await req.supabase!.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("user_id", req.auth!.id).order("created_at", { ascending: false });
      if (error) throw new ApiError(500, "BOOK_LIST_FAILED", "Unable to load your library.");
      res.json({ data: data ?? [] });
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
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:bookId/upload-complete", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: book, error: bookError } = await client.from("books").select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").eq("id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (bookError) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to verify this book.");
      if (!book) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      const { data: file, error: fileError } = await client.from("book_files").select("id,storage_key,mime_type,size_bytes").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (fileError || !file) throw new ApiError(500, "BOOK_FILE_LOOKUP_FAILED", "Unable to verify this upload.");
      const metadata = await storage.getObjectMetadata({ key: file.storage_key });
      if (!metadata || metadata.contentLength !== file.size_bytes || (metadata.contentType && metadata.contentType !== file.mime_type)) throw new ApiError(400, "UPLOAD_VERIFICATION_FAILED", "The uploaded PDF could not be verified.");
      const { data: updated, error: updateError } = await client.from("books").update({ status: "UPLOADED" }).eq("id", bookId).eq("user_id", req.auth!.id).select("id,user_id,title,author,status,original_filename,mime_type,file_size_bytes,created_at,updated_at").single();
      if (updateError || !updated) throw new ApiError(500, "BOOK_UPDATE_FAILED", "Unable to complete the book upload.");
      await client.from("book_files").update({ etag: metadata.etag ?? null }).eq("id", file.id).eq("user_id", req.auth!.id);
      res.json({ data: updated });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:bookId", async (req, res, next) => {
    try {
      const bookId = uuidSchema.parse(req.params.bookId);
      const client = req.supabase!;
      const { data: file, error: fileError } = await client.from("book_files").select("id,storage_key").eq("book_id", bookId).eq("user_id", req.auth!.id).maybeSingle();
      if (fileError) throw new ApiError(500, "BOOK_LOOKUP_FAILED", "Unable to delete this book.");
      if (!file) throw new ApiError(404, "BOOK_NOT_FOUND", "Book not found.");
      try {
        await storage.deleteObject({ key: file.storage_key });
      } catch {
        throw new ApiError(502, "S3_ERROR", "Unable to remove the uploaded file.");
      }
      const { error } = await client.from("books").delete().eq("id", bookId).eq("user_id", req.auth!.id);
      if (error) throw new ApiError(500, "BOOK_DELETE_FAILED", "Unable to remove this book from your library.");
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
