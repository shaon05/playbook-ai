import "dotenv/config";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { loadEnv } from "./config/env";
import { createSupabaseAdminClient } from "./lib/supabase-admin";
import { S3StorageProvider } from "./providers/storage/s3.storage.provider";
import { extractPdf } from "./modules/extraction/extraction.service";
import { normalizeOcrPages } from "./modules/extraction/ocr-normalization.service";
import { GoogleDocumentAiProvider } from "./providers/ocr/google-document-ai.provider";
import { OpenAiProvider } from "./providers/ai/openai.provider";
import { createCreatorReviewProvider } from "./providers/review/creator-review.provider";
import { recordCreatorReviewSignal } from "./modules/creator/review-signals";
import sharp from "sharp";
import { claimNextProcessingJob } from "./modules/processing/job-claim";
import { runWorkerLoop } from "./modules/processing/worker-lifecycle";

const env = loadEnv();
const db = createSupabaseAdminClient(env);
const storage = new S3StorageProvider(env);
const ocrProvider = env.GOOGLE_CLOUD_PROJECT_ID && env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID ? new GoogleDocumentAiProvider(env) : null;
const aiProvider = env.OPENAI_API_KEY ? new OpenAiProvider(env) : null;
const creatorReviewProvider = createCreatorReviewProvider();
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, code: string): Promise<T> { let timer: NodeJS.Timeout | undefined; try { return await Promise.race([promise, new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(code)), timeoutMs); })]); } finally { if (timer) clearTimeout(timer); } }

function structuralText(text: string) {
  return text.split("\n").filter((line) => line.trim().length > 0).slice(0, 800).join("\n").slice(0, 60000);
}

async function reviewCreatorManuscriptDuplicates(job: { creator_submission_id?: string | null }, asset: any) {
  if (!job.creator_submission_id) return;
  const submissionId = job.creator_submission_id;
  const { data: submission } = await db.from("creator_submissions").select("id,creator_id,title,description,language,source_sha256").eq("id", submissionId).maybeSingle();
  if (!submission) return;
  await db.from("creator_submissions").update({ normalized_content_sha256: asset.normalized_content_sha256 ?? null, content_asset_id: asset.id }).eq("id", submissionId);
  const matches = new Map<string, { id: string; creator_id: string; matchType: "EXACT_SOURCE_MATCH" | "EXACT_CONTENT_MATCH" }>();
  if (submission.source_sha256) {
    const { data } = await db.from("creator_submissions").select("id,creator_id").eq("source_sha256", submission.source_sha256).neq("id", submissionId);
    for (const match of data ?? []) matches.set(match.id, { ...match, matchType: "EXACT_SOURCE_MATCH" });
  }
  if (asset.normalized_content_sha256) {
    const { data } = await db.from("creator_submissions").select("id,creator_id").eq("normalized_content_sha256", asset.normalized_content_sha256).neq("id", submissionId);
    for (const match of data ?? []) if (!matches.has(match.id)) matches.set(match.id, { ...match, matchType: "EXACT_CONTENT_MATCH" });
  }
  for (const match of matches.values()) {
    if (match.creator_id === submission.creator_id) {
      await recordCreatorReviewSignal(db, { submissionId, contentId: asset.id, signalType: match.matchType === "EXACT_SOURCE_MATCH" ? "SAME_CREATOR_SOURCE_MATCH" : "SAME_CREATOR_CONTENT_MATCH", source: "DETERMINISTIC", severity: "LOW", confidence: 1, metadata: { reuseAllowed: true } });
      continue;
    }
    const { data: existing } = await db.from("creator_duplicate_flags").select("id").eq("creator_submission_id", submissionId).eq("matched_submission_id", match.id).eq("duplicate_type", "POTENTIAL_DUPLICATE_MANUSCRIPT").maybeSingle();
    if (!existing) await db.from("creator_duplicate_flags").insert({ creator_submission_id: submissionId, duplicate_type: "POTENTIAL_DUPLICATE_MANUSCRIPT", match_type: match.matchType, matched_submission_id: match.id, requires_review: true });
    await recordCreatorReviewSignal(db, { submissionId, contentId: asset.id, signalType: match.matchType, source: "DETERMINISTIC", severity: "MEDIUM", confidence: 1, metadata: { matchedSubmissionId: match.id, crossCreator: true } });
  }
  const review = await creatorReviewProvider.review({ title: submission.title, description: submission.description, language: submission.language, textExcerpt: null });
  await recordCreatorReviewSignal(db, { submissionId, contentId: asset.id, signalType: "AI_REVIEW_UNAVAILABLE", source: "AI", severity: "MEDIUM", confidence: 0, provider: review.provider, providerVersion: review.providerVersion, metadata: { overallRisk: review.overallRisk, recommendedAction: review.recommendedAction } });
  await db.from("creator_submissions").update({ review_status: "REQUIRES_REVIEW", review_version: review.reviewVersion, review_completed_at: new Date().toISOString(), creator_visible_review_message: "Your submission is awaiting content review." }).eq("id", submissionId);
}

async function finalizeCreatorSubmission(job: { creator_submission_id?: string | null }, asset: any) {
  if (!job.creator_submission_id || asset.status !== "CHAPTERS_READY") return;
  const { data: submission } = await db.from("creator_submissions").select("id,creator_id,title,description,language,cover_storage_key").eq("id", job.creator_submission_id).single();
  if (!submission) return;
  const { data: catalog, error } = await db.from("catalog_content").upsert({ creator_id: submission.creator_id, creator_submission_id: submission.id, content_asset_id: asset.id, title: submission.title, author_display_name: null, description: submission.description, content_type: "STORY", language: submission.language, status: "READY", visibility: "PRIVATE", cover_storage_key: submission.cover_storage_key, audio_status: "NOT_GENERATED" }, { onConflict: "creator_submission_id" }).select("id").single();
  if (error || !catalog) throw new Error("CREATOR_CATALOG_LINK_FAILED");
  const { data: genres } = await db.from("submission_genres").select("genre_id").eq("submission_id", submission.id);
  if (genres?.length) { await db.from("content_genres").delete().eq("catalog_content_id", catalog.id); await db.from("content_genres").insert(genres.map((genre) => ({ catalog_content_id: catalog.id, genre_id: genre.genre_id }))); }
  await db.from("creator_submissions").update({ status: "READY_FOR_CREATOR_REVIEW", content_asset_id: asset.id, processing_error_code: null }).eq("id", submission.id);
}

async function runAnalysis(job: { id: string; user_id: string; book_id: string; creator_submission_id?: string | null }, asset: any, canonicalText: string, pageCount: number) {
  await reviewCreatorManuscriptDuplicates(job, asset);
  if (!aiProvider || !asset.normalized_content_sha256) return;
  await db.from("books").update({ status: "ANALYZING" }).eq("id", job.book_id).eq("user_id", job.user_id);
  const cache = await db.from("content_analyses").select("*").eq("normalized_content_sha256", asset.normalized_content_sha256).eq("model", env.OPENAI_BOOK_ANALYSIS_MODEL).eq("prompt_version", env.BOOK_ANALYSIS_PROMPT_VERSION).eq("pipeline_version", env.BOOK_ANALYSIS_PIPELINE_VERSION).eq("status", "COMPLETED").maybeSingle();
  let analysis = cache.data;
  let cacheHit = Boolean(analysis);
  if (!analysis) {
    const result = await aiProvider.analyzeBook({ pageCount, textLength: canonicalText.length, structuralText: structuralText(canonicalText) });
    const { data, error } = await db.from("content_analyses").insert({ content_asset_id: asset.id, normalized_content_sha256: asset.normalized_content_sha256, provider: "openai", model: env.OPENAI_BOOK_ANALYSIS_MODEL, prompt_version: env.BOOK_ANALYSIS_PROMPT_VERSION, pipeline_version: env.BOOK_ANALYSIS_PIPELINE_VERSION, status: "COMPLETED", document_type: result.analysis.documentType, detected_title: result.analysis.title, detected_author: result.analysis.author, detected_language: result.analysis.language, input_tokens: result.inputTokens ?? null, output_tokens: result.outputTokens ?? null, completed_at: new Date().toISOString() }).select("*").single();
    if (error || !data) throw new Error("AI_ANALYSIS_FAILED");
    analysis = data;
    await db.from("content_chapters").insert(result.analysis.chapters.map((chapter) => ({ content_asset_id: asset.id, analysis_id: data.id, chapter_index: chapter.index, title: chapter.title, start_page: chapter.startPage, end_page: chapter.endPage, text_start_offset: chapter.startTextOffset, text_end_offset: chapter.endTextOffset, word_count: null, estimated_listening_seconds: null })));
  } else {
    const { data: chapters } = await db.from("content_chapters").select("chapter_index,title,start_page,end_page,text_start_offset,text_end_offset,word_count,estimated_listening_seconds").eq("content_asset_id", analysis.content_asset_id).order("chapter_index", { ascending: true });
    if (chapters?.length) await db.from("content_chapters").insert(chapters.map((chapter) => ({ ...chapter, content_asset_id: asset.id, analysis_id: analysis.id })));
  }
  await db.from("usage_ledger").insert({ user_id: job.user_id, book_id: job.book_id, content_asset_id: asset.id, provider: "openai", operation: "BOOK_ANALYSIS", model: env.OPENAI_BOOK_ANALYSIS_MODEL, cache_hit: cacheHit });
  await db.from("content_assets").update({ status: "CHAPTERS_READY", updated_at: new Date().toISOString() }).eq("id", asset.id);
  await db.from("books").update({ status: "CHAPTERS_READY", ...(analysis.detected_title ? { title: analysis.detected_title } : {}), ...(analysis.detected_author ? { author: analysis.detected_author } : {}) }).eq("id", job.book_id).eq("user_id", job.user_id);
  await db.from("processing_jobs").update({ metadata: { cache_status: cacheHit ? "HIT" : "MISS", cache_stage: "ANALYSIS", pipeline_version: env.BOOK_ANALYSIS_PIPELINE_VERSION }, progress_percent: 100, completed_at: new Date().toISOString() }).eq("id", job.id);
  await finalizeCreatorSubmission(job, asset);
}

async function completeFromAsset(job: { id: string; user_id: string; book_id: string }, asset: any, file: any, cacheStatus: "HIT" | "MISS") {
  const extractionStatus = asset.status === "OCR_REQUIRED" ? "OCR_REQUIRED" : asset.status === "CHAPTERS_READY" ? "CHAPTERS_READY" : "TEXT_READY";
  const { data: extraction, error } = await db.from("document_extractions").insert({ book_id: job.book_id, user_id: job.user_id, source_file_id: file.id, content_asset_id: asset.id, status: extractionStatus, extractor: "pdfjs-dist", extractor_version: env.EXTRACTION_PIPELINE_VERSION, page_count: asset.page_count ?? 0, pages_with_text: asset.pages_with_text ?? 0, total_characters: asset.total_characters ?? 0, total_words: asset.total_words ?? 0, quality_score: asset.quality_score, requires_ocr: extractionStatus === "OCR_REQUIRED", storage_bucket: asset.normalized_storage_key ? env.AWS_S3_BUCKET : null, normalized_storage_key: asset.normalized_storage_key, normalized_content_sha256: asset.normalized_content_sha256, source_etag: file.etag ?? null, started_at: new Date().toISOString(), completed_at: new Date().toISOString() }).select("id").single();
  if (error || !extraction) throw new Error("EXTRACTION_METADATA_FAILED");
  await db.from("books").update({ content_asset_id: asset.id, status: extractionStatus }).eq("id", job.book_id).eq("user_id", job.user_id);
  await db.from("processing_jobs").update({ status: "COMPLETED", progress_percent: 100, metadata: { cache_status: cacheStatus, cache_stage: "EXTRACTION", pipeline_version: env.EXTRACTION_PIPELINE_VERSION }, completed_at: new Date().toISOString(), lease_expires_at: null }).eq("id", job.id);
}

async function processMultiPageDocument(job: { id: string; user_id: string; book_id: string }, documentId: string, tempDir: string) {
  if (!ocrProvider) throw new Error("IMAGE_OCR_NOT_CONFIGURED");
  const { data: pages } = await db.from("document_input_pages").select("id,upload_id,page_index,security_status,validation_status").eq("document_id", documentId).order("page_index", { ascending: true });
  if (!pages?.length || pages.some((page) => page.security_status !== "CLEAN" || page.validation_status !== "VALID")) throw new Error("UPLOAD_SECURITY_GATE_FAILED");
  const ocrPages = [];
  const hashes: string[] = [];
  let firstFile: any = null;
  for (const page of pages) {
    const { data: upload } = await db.from("document_uploads").select("id,storage_key,declared_mime_type").eq("id", page.upload_id).eq("user_id", job.user_id).single();
    if (!upload) throw new Error("SOURCE_FILE_NOT_FOUND");
    const { data: file } = await db.from("book_files").select("id,storage_key,storage_bucket,mime_type,size_bytes,etag").eq("storage_key", upload.storage_key).eq("book_id", job.book_id).single();
    if (!file) throw new Error("SOURCE_FILE_NOT_FOUND");
    if (!firstFile) firstFile = file;
    const pagePath = path.join(tempDir, `page-${page.page_index}`);
    await storage.downloadObject({ key: file.storage_key, destination: pagePath });
    const bytes = new Uint8Array(await readFile(pagePath));
    const hash = createHash("sha256").update(bytes).digest("hex"); hashes.push(hash);
    const ocrBytes = file.mime_type === "image/heic" || file.mime_type === "image/heif" ? new Uint8Array(await withTimeout(sharp(bytes).rotate().jpeg({ quality: 92 }).toBuffer(), env.IMAGE_PROCESSING_TIMEOUT_MS, "IMAGE_PROCESSING_TIMEOUT")) : bytes;
    const result = await withTimeout(ocrProvider.processImage({ bytes: ocrBytes, mimeType: file.mime_type === "image/png" ? "image/png" : "image/jpeg" }), env.OCR_TIMEOUT_MS, "OCR_TIMEOUT");
    const pageResult = result.pages[0];
    if (!pageResult?.text?.trim()) throw new Error("NO_READABLE_CONTENT");
    ocrPages.push({ pageNumber: page.page_index + 1, text: pageResult.text, confidence: pageResult.confidence, language: pageResult.language });
  }
  const normalized = normalizeOcrPages(ocrPages);
  const sourceHash = createHash("sha256").update(hashes.join(":"), "utf8").digest("hex");
  const { data: asset, error: assetError } = await db.from("content_assets").insert({ source_sha256: sourceHash, status: "PROCESSING", extraction_pipeline_version: env.EXTRACTION_PIPELINE_VERSION }).select("*").single();
  if (assetError || !asset) throw new Error("CACHE_ASSET_CREATE_FAILED");
  const extractionKey = `content-assets/${asset.id}/extraction/${env.EXTRACTION_PIPELINE_VERSION}/normalized.json.gz`;
  await storage.putObject({ key: extractionKey, body: normalized.artifact, contentType: "application/json", contentEncoding: "gzip" });
  const { data: updatedAsset, error: updateError } = await db.from("content_assets").update({ status: "TEXT_READY", normalized_content_sha256: normalized.normalizedContentHash, page_count: normalized.pageCount, pages_with_text: normalized.pagesWithText, total_characters: normalized.totalCharacters, total_words: normalized.totalWords, quality_score: normalized.qualityScore, normalized_storage_key: extractionKey, updated_at: new Date().toISOString() }).eq("id", asset.id).select("*").single();
  if (updateError || !updatedAsset) throw new Error("CACHE_ASSET_UPDATE_FAILED");
  await completeFromAsset(job, updatedAsset, firstFile, "MISS");
  const { data: extraction } = await db.from("document_extractions").select("id").eq("book_id", job.book_id).eq("user_id", job.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (extraction) await db.from("document_pages").insert(normalized.pages.map((page) => ({ extraction_id: extraction.id, book_id: job.book_id, page_number: page.pageNumber, character_start: page.characterStart, character_end: page.characterEnd, character_count: page.characterCount, word_count: page.wordCount, has_text: page.hasText })));
  await db.from("documents").update({ status: "READY" }).eq("id", documentId);
  await runAnalysis(job, updatedAsset, normalized.canonicalText, normalized.pageCount);
}

async function runOnce() {
  const candidate = await claimNextProcessingJob(db, "DOCUMENT_EXTRACTION");
  if (!candidate) return false;
  const { data: activeBook } = await db.from("books").select("id,deleted_at").eq("id", candidate.book_id).maybeSingle();
  if (!activeBook || activeBook.deleted_at) {
    await db.from("processing_jobs").update({ status: "FAILED", error_code: "USER_REMOVED", error_message: "The user removed this document before preparation completed.", lease_expires_at: null }).eq("id", candidate.id).eq("status", "RUNNING");
    return true;
  }
  const job = candidate;
  const tempDir = await mkdir(path.join(env.EXTRACTION_TEMP_DIR || os.tmpdir(), "playbook", job.id), { recursive: true }).then(() => path.join(env.EXTRACTION_TEMP_DIR || os.tmpdir(), "playbook", job.id));
  const sourcePath = path.join(tempDir, "source.pdf");
  try {
    const { data: multiDocument } = await db.from("documents").select("id").eq("book_id", job.book_id).eq("user_id", job.user_id).maybeSingle();
    if (multiDocument) { await db.from("books").update({ status: "EXTRACTING" }).eq("id", job.book_id).eq("user_id", job.user_id); await processMultiPageDocument(job, multiDocument.id, tempDir); return true; }
    const { data: uploadRecord } = await db.from("document_uploads").select("id,security_status,validation_status").or(`book_id.eq.${job.book_id},creator_submission_id.eq.${job.creator_submission_id ?? "00000000-0000-0000-0000-000000000000"}`).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!uploadRecord || uploadRecord.security_status !== "CLEAN" || uploadRecord.validation_status !== "VALID") throw new Error("UPLOAD_SECURITY_GATE_FAILED");
    await db.from("books").update({ status: "EXTRACTING" }).eq("id", job.book_id).eq("user_id", job.user_id);
    await db.from("processing_jobs").update({ progress_percent: 10 }).eq("id", job.id);
    const { data: file } = await db.from("book_files").select("id,storage_key,storage_bucket,mime_type,size_bytes,etag").eq("book_id", job.book_id).eq("user_id", job.user_id).eq("file_type", "SOURCE").single();
    if (!file) throw new Error("SOURCE_FILE_NOT_FOUND");
    await storage.downloadObject({ key: file.storage_key, destination: sourcePath });
    await db.from("processing_jobs").update({ progress_percent: 20 }).eq("id", job.id);
    const bytes = new Uint8Array(await readFile(sourcePath));
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    await db.from("book_files").update({ source_sha256: sourceHash }).eq("id", file.id).eq("user_id", job.user_id);
    await db.from("books").update({ source_sha256: sourceHash }).eq("id", job.book_id).eq("user_id", job.user_id).is("deleted_at", null);
    if (job.creator_submission_id) await db.from("creator_submissions").update({ source_sha256: sourceHash }).eq("id", job.creator_submission_id);
    const { data: sourceAsset } = await db.from("content_assets").select("*").eq("source_sha256", sourceHash).eq("extraction_pipeline_version", env.EXTRACTION_PIPELINE_VERSION).maybeSingle();
    if (sourceAsset?.status === "TEXT_READY" || sourceAsset?.status === "OCR_REQUIRED") {
      if (job.creator_submission_id) await reviewCreatorManuscriptDuplicates(job, sourceAsset);
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
        if (job.creator_submission_id) await reviewCreatorManuscriptDuplicates(job, racedAsset);
        await completeFromAsset(job, racedAsset, file, "HIT"); return true;
      }
    }
    let result: Awaited<ReturnType<typeof extractPdf>>;
    if (file.mime_type === "application/pdf") {
      result = await withTimeout(extractPdf(bytes, job.book_id), env.PARSER_TIMEOUT_MS, "PARSER_TIMEOUT");
      if (result.pageCount > env.MAX_PDF_PAGES) throw new Error("PROCESSING_LIMIT_EXCEEDED");
    } else {
      if (!ocrProvider) throw new Error("IMAGE_OCR_NOT_CONFIGURED");
      const ocrBytes = file.mime_type === "image/heic" || file.mime_type === "image/heif" ? new Uint8Array(await withTimeout(sharp(bytes).rotate().jpeg({ quality: 92 }).toBuffer(), env.IMAGE_PROCESSING_TIMEOUT_MS, "IMAGE_PROCESSING_TIMEOUT")) : bytes;
      const imageResult = normalizeOcrPages((await withTimeout(ocrProvider.processImage({ bytes: ocrBytes, mimeType: file.mime_type === "image/png" ? "image/png" : "image/jpeg" }), env.OCR_TIMEOUT_MS, "OCR_TIMEOUT")).pages);
      if (!imageResult.totalCharacters) throw new Error("NO_READABLE_CONTENT");
      result = { ...imageResult, sourceHash, requiresOcr: false };
    }
    const extractionStatus = result.requiresOcr ? "OCR_REQUIRED" : "TEXT_READY";
    const extractionKey = `content-assets/${asset.id}/extraction/${env.EXTRACTION_PIPELINE_VERSION}/normalized.json.gz`;
    if (!result.requiresOcr) await storage.putObject({ key: extractionKey, body: result.artifact, contentType: "application/json", contentEncoding: "gzip" });
    const { data: updatedAsset, error: assetError } = await db.from("content_assets").update({ status: extractionStatus, normalized_content_sha256: result.normalizedContentHash, page_count: result.pageCount, pages_with_text: result.pagesWithText, total_characters: result.totalCharacters, total_words: result.totalWords, quality_score: result.qualityScore, normalized_storage_key: result.requiresOcr ? null : extractionKey, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("status", "PROCESSING").select("*").single();
    if (assetError || !updatedAsset) throw new Error("CACHE_ASSET_UPDATE_FAILED");
    await completeFromAsset(job, updatedAsset, file, "MISS");
    let finalAsset = updatedAsset;
    let canonicalText = result.pages.map((page) => page.text).join("\n\n");
    if (result.requiresOcr && ocrProvider) {
      await db.from("books").update({ status: "OCR_PROCESSING" }).eq("id", job.book_id).eq("user_id", job.user_id);
      const ocrResult = await withTimeout(ocrProvider.processPdf({ bytes, mimeType: "application/pdf" }), env.OCR_TIMEOUT_MS, "OCR_TIMEOUT");
      const normalized = normalizeOcrPages(ocrResult.pages);
      const ocrKey = `content-assets/${asset.id}/ocr/${env.OCR_PIPELINE_VERSION}/normalized.json.gz`;
      await storage.putObject({ key: ocrKey, body: normalized.artifact, contentType: "application/json", contentEncoding: "gzip" });
      const { data: ocrAsset, error: ocrError } = await db.from("content_assets").update({ status: "TEXT_READY", ocr_pipeline_version: env.OCR_PIPELINE_VERSION, pages_ocrd: normalized.pageCount, empty_pages: normalized.pageCount - normalized.pagesWithText, low_confidence_pages: normalized.pages.filter((page) => (page.confidence ?? 1) < 0.5).length, average_ocr_confidence: ocrResult.averageConfidence ?? null, normalized_content_sha256: normalized.normalizedContentHash, normalized_storage_key: ocrKey, page_count: normalized.pageCount, pages_with_text: normalized.pagesWithText, total_characters: normalized.totalCharacters, total_words: normalized.totalWords, quality_score: normalized.qualityScore, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("status", "OCR_REQUIRED").select("*").single();
      if (ocrError || !ocrAsset) throw new Error("OCR_PROVIDER_ERROR");
      finalAsset = ocrAsset;
      canonicalText = normalized.canonicalText;
      await db.from("document_extractions").update({ status: "TEXT_READY", requires_ocr: false, normalized_storage_key: ocrKey, normalized_content_sha256: normalized.normalizedContentHash, page_count: normalized.pageCount, pages_with_text: normalized.pagesWithText, total_characters: normalized.totalCharacters, total_words: normalized.totalWords, quality_score: normalized.qualityScore, completed_at: new Date().toISOString() }).eq("book_id", job.book_id).eq("user_id", job.user_id);
      await db.from("books").update({ status: "TEXT_READY" }).eq("id", job.book_id).eq("user_id", job.user_id);
    }
    await runAnalysis(job, finalAsset, canonicalText, finalAsset.page_count ?? result.pageCount);
    const { data: extraction } = await db.from("document_extractions").select("id").eq("book_id", job.book_id).eq("user_id", job.user_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (extraction) await db.from("document_pages").insert(result.pages.map((page) => ({ extraction_id: extraction.id, book_id: job.book_id, page_number: page.pageNumber, character_start: page.characterStart, character_end: page.characterEnd, character_count: page.characterCount, word_count: page.wordCount, has_text: page.hasText })));
    console.info(JSON.stringify({ event: "extraction_completed", jobId: job.id, bookId: job.book_id, pages: result.pageCount, characters: result.totalCharacters, status: extractionStatus, cacheStatus: "MISS" }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_EXTRACTION_ERROR";
    const errorCode = message.startsWith("SOURCE_") ? message : message.includes("PASSWORD") ? "PASSWORD_PROTECTED_PDF" : message.includes("INVALID") ? "INVALID_PDF" : message.includes("NO_PAGES") ? "NO_PAGES" : "EXTRACTION_ERROR";
    if (job.attempt < env.MAX_PROCESSING_RETRIES && !message.includes("UPLOAD_SECURITY_GATE")) { await db.from("processing_jobs").update({ status: "QUEUED", error_code: errorCode, error_message: "Document preparation will be retried.", completed_at: null, lease_expires_at: null }).eq("id", job.id); console.warn(JSON.stringify({ event: "processing_retry_queued", jobId: job.id, attempt: job.attempt, errorCode })); return true; }
    await db.from("books").update({ status: "EXTRACTION_FAILED" }).eq("id", job.book_id).eq("user_id", job.user_id);
    if (job.creator_submission_id) await db.from("creator_submissions").update({ status: "PROCESSING_FAILED", processing_error_code: errorCode }).eq("id", job.creator_submission_id);
    await db.from("processing_jobs").update({ status: "FAILED", error_code: errorCode, error_message: errorCode === "EXTRACTION_ERROR" ? "Document extraction failed." : message, completed_at: new Date().toISOString(), lease_expires_at: null }).eq("id", job.id);
    console.error(JSON.stringify({ event: "extraction_failed", jobId: job.id, bookId: job.book_id, errorCode }));
  } finally { await rm(tempDir, { recursive: true, force: true }); }
  return true;
}

async function main() {
  console.info(JSON.stringify({ event: "extraction_worker_started" }));
  const shutdown = new AbortController();
  const requestShutdown = (signal: "SIGINT" | "SIGTERM") => {
    console.info(JSON.stringify({ event: "extraction_worker_shutdown_requested", signal }));
    shutdown.abort();
  };
  const onSigint = () => requestShutdown("SIGINT");
  const onSigterm = () => requestShutdown("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  try {
    await runWorkerLoop({
      runOnce,
      pollIntervalMs: env.EXTRACTION_POLL_INTERVAL_MS,
      signal: shutdown.signal,
      onError: (error) => console.error(JSON.stringify({ event: "extraction_worker_poll_failed", message: error instanceof Error ? error.message : "UNKNOWN_WORKER_ERROR" })),
    });
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    console.info(JSON.stringify({ event: "extraction_worker_stopped" }));
  }
}

void main().catch((error: unknown) => {
  console.error(JSON.stringify({ event: "extraction_worker_fatal", message: error instanceof Error ? error.message : "UNKNOWN_WORKER_ERROR" }));
  process.exitCode = 1;
});
