import "dotenv/config";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { loadEnv } from "./config/env";
import { createSupabaseAdminClient } from "./lib/supabase-admin";
import { S3StorageProvider } from "./providers/storage/s3.storage.provider";
import { extractPdf } from "./modules/extraction/extraction.service";

const env = loadEnv();
const db = createSupabaseAdminClient(env);
const storage = new S3StorageProvider(env);

async function completeFromAsset(job: { id: string; user_id: string; book_id: string }, asset: any, file: any, cacheStatus: "HIT" | "MISS") {
  const extractionStatus = asset.status === "OCR_REQUIRED" ? "OCR_REQUIRED" : "TEXT_READY";
  const { data: extraction, error } = await db.from("document_extractions").insert({ book_id: job.book_id, user_id: job.user_id, source_file_id: file.id, content_asset_id: asset.id, status: extractionStatus, extractor: "pdfjs-dist", extractor_version: env.EXTRACTION_PIPELINE_VERSION, page_count: asset.page_count ?? 0, pages_with_text: asset.pages_with_text ?? 0, total_characters: asset.total_characters ?? 0, total_words: asset.total_words ?? 0, quality_score: asset.quality_score, requires_ocr: extractionStatus === "OCR_REQUIRED", storage_bucket: asset.normalized_storage_key ? env.AWS_S3_BUCKET : null, normalized_storage_key: asset.normalized_storage_key, normalized_content_sha256: asset.normalized_content_sha256, source_etag: file.etag ?? null, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }).select("id").single();
  if (error || !extraction) throw new Error("EXTRACTION_METADATA_FAILED");
  await db.from("books").update({ content_asset_id: asset.id, status: extractionStatus }).eq("id", job.book_id).eq("user_id", job.user_id);
  await db.from("processing_jobs").update({ status: "COMPLETED", progress_percent: 100, metadata: { cache_status: cacheStatus, cache_stage: "EXTRACTION", pipeline_version: env.EXTRACTION_PIPELINE_VERSION }, completed_at: new Date().toISOString() }).eq("id", job.id);
}

async function runOnce() {
  const { data: candidate } = await db.from("processing_jobs").select("id,user_id,book_id,attempt").eq("job_type", "DOCUMENT_EXTRACTION").eq("status", "QUEUED").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!candidate) return false;
  const { data: job } = await db.from("processing_jobs").update({ status: "RUNNING", progress_percent: 5, attempt: candidate.attempt + 1, started_at: new Date().toISOString() }).eq("id", candidate.id).eq("status", "QUEUED").select("id,user_id,book_id,attempt").single();
  if (!job) return false;
  const tempDir = await mkdir(path.join(env.EXTRACTION_TEMP_DIR || os.tmpdir(), "playbook", job.id), { recursive: true }).then(() => path.join(env.EXTRACTION_TEMP_DIR || os.tmpdir(), "playbook", job.id));
  const sourcePath = path.join(tempDir, "source.pdf");
  try {
    await db.from("books").update({ status: "EXTRACTING" }).eq("id", job.book_id).eq("user_id", job.user_id);
    await db.from("processing_jobs").update({ progress_percent: 10 }).eq("id", job.id);
    const { data: file } = await db.from("book_files").select("id,storage_key,storage_bucket,mime_type,size_bytes,etag").eq("book_id", job.book_id).eq("user_id", job.user_id).eq("file_type", "SOURCE").single();
    if (!file) throw new Error("SOURCE_FILE_NOT_FOUND");
    await storage.downloadObject({ key: file.storage_key, destination: sourcePath });
    await db.from("processing_jobs").update({ progress_percent: 20 }).eq("id", job.id);
    const bytes = new Uint8Array(await readFile(sourcePath));
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    await db.from("book_files").update({ source_sha256: sourceHash }).eq("id", file.id).eq("user_id", job.user_id);
    const { data: sourceAsset } = await db.from("content_assets").select("*").eq("source_sha256", sourceHash).eq("extraction_pipeline_version", env.EXTRACTION_PIPELINE_VERSION).maybeSingle();
    if (sourceAsset?.status === "TEXT_READY" || sourceAsset?.status === "OCR_REQUIRED") {
      await completeFromAsset(job, sourceAsset, file, "HIT");
      console.info(JSON.stringify({ event: "extraction_cache_hit", jobId: job.id, bookId: job.book_id, cacheStage: "EXTRACTION", pipelineVersion: env.EXTRACTION_PIPELINE_VERSION }));
      return true;
    }
    if (sourceAsset?.status === "PROCESSING") {
      await db.from("processing_jobs").update({ metadata: { cache_status: "WAITING_FOR_CANONICAL_PROCESSING", cache_stage: "EXTRACTION", pipeline_version: env.EXTRACTION_PIPELINE_VERSION } }).eq("id", job.id);
      await new Promise((resolve) => setTimeout(resolve, env.EXTRACTION_POLL_INTERVAL_MS));
      return true;
    }
    let asset = sourceAsset;
    if (!asset) {
      const { data: createdAsset } = await db.from("content_assets").insert({ source_sha256: sourceHash, status: "PROCESSING", extraction_pipeline_version: env.EXTRACTION_PIPELINE_VERSION }).select("*").single();
      asset = createdAsset;
      if (!asset) {
        const { data: racedAsset } = await db.from("content_assets").select("*").eq("source_sha256", sourceHash).eq("extraction_pipeline_version", env.EXTRACTION_PIPELINE_VERSION).maybeSingle();
        if (!racedAsset) throw new Error("CACHE_ASSET_CREATE_FAILED");
        if (racedAsset.status === "PROCESSING") { await new Promise((resolve) => setTimeout(resolve, env.EXTRACTION_POLL_INTERVAL_MS)); return true; }
        await completeFromAsset(job, racedAsset, file, "HIT"); return true;
      }
    }
    const result = await extractPdf(bytes, job.book_id);
    const extractionStatus = result.requiresOcr ? "OCR_REQUIRED" : "TEXT_READY";
    const extractionKey = `content-assets/${asset.id}/extraction/${env.EXTRACTION_PIPELINE_VERSION}/normalized.json.gz`;
    if (!result.requiresOcr) await storage.putObject({ key: extractionKey, body: result.artifact, contentType: "application/json", contentEncoding: "gzip" });
    const { data: updatedAsset, error: assetError } = await db.from("content_assets").update({ status: extractionStatus, normalized_content_sha256: result.normalizedContentHash, page_count: result.pageCount, pages_with_text: result.pagesWithText, total_characters: result.totalCharacters, total_words: result.totalWords, quality_score: result.qualityScore, normalized_storage_key: result.requiresOcr ? null : extractionKey, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("status", "PROCESSING").select("*").single();
    if (assetError || !updatedAsset) throw new Error("CACHE_ASSET_UPDATE_FAILED");
    await completeFromAsset(job, updatedAsset, file, "MISS");
    const { data: extraction } = await db.from("document_extractions").select("id").eq("book_id", job.book_id).eq("user_id", job.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (extraction) await db.from("document_pages").insert(result.pages.map((page) => ({ extraction_id: extraction.id, book_id: job.book_id, page_number: page.pageNumber, character_start: page.characterStart, character_end: page.characterEnd, character_count: page.characterCount, word_count: page.wordCount, has_text: page.hasText })));
    console.info(JSON.stringify({ event: "extraction_completed", jobId: job.id, bookId: job.book_id, pages: result.pageCount, characters: result.totalCharacters, status: extractionStatus, cacheStatus: "MISS" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_EXTRACTION_ERROR";
    const errorCode = message.startsWith("SOURCE_") ? message : message.includes("PASSWORD") ? "PASSWORD_PROTECTED_PDF" : message.includes("INVALID") ? "INVALID_PDF" : message.includes("NO_PAGES") ? "NO_PAGES" : "EXTRACTION_ERROR";
    await db.from("books").update({ status: "EXTRACTION_FAILED" }).eq("id", job.book_id).eq("user_id", job.user_id);
    await db.from("processing_jobs").update({ status: "FAILED", error_code: errorCode, error_message: errorCode === "EXTRACTION_ERROR" ? "Document extraction failed." : message, completed_at: new Date().toISOString() }).eq("id", job.id);
    console.error(JSON.stringify({ event: "extraction_failed", jobId: job.id, bookId: job.book_id, errorCode }));
  } finally { await rm(tempDir, { recursive: true, force: true }); }
  return true;
}

async function main() { console.info(JSON.stringify({ event: "extraction_worker_started" })); while (await runOnce()) { /* process one job at a time */ } }
void main();
