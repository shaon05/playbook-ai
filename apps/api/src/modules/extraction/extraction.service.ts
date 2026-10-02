import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { ApiError } from "../../errors/api-error";

export const extractionQualityConfig = { minMeaningfulCharsPerPage: 80, ocrQualityThreshold: 0.2, ocrEmptyPageRatio: 0.85, maxSuspiciousRatio: 0.35 } as const;
export type ExtractedPage = { pageNumber: number; text: string; characterCount: number; wordCount: number; characterStart: number; characterEnd: number; hasText: boolean };
export type ExtractionResult = { pageCount: number; pagesWithText: number; totalCharacters: number; totalWords: number; qualityScore: number; requiresOcr: boolean; pages: ExtractedPage[]; sourceHash: string; normalizedContentHash: string; artifact: Uint8Array };

function normalizeText(value: string) {
  return value.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").split("\n").map((line) => line.replace(/\s+$/g, "").trimStart()).join("\n").trim();
}

function wordCount(text: string) { return text ? text.split(/\s+/).filter(Boolean).length : 0; }

export async function extractPdf(bytes: Uint8Array, bookId: string): Promise<ExtractionResult> {
  if (bytes.length < 5 || new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new ApiError(422, "INVALID_PDF", "The uploaded file doesn't appear to be a valid PDF.");
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: bytes, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    if (!pdf.numPages) throw new ApiError(422, "NO_PAGES", "This PDF does not contain any pages.");
    const pages: ExtractedPage[] = [];
    let offset = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const raw = content.items.map((item: { str?: string }) => item.str ?? "").join(" ");
      const text = normalizeText(raw);
      const characterStart = offset;
      const characterEnd = characterStart + text.length;
      offset = characterEnd + 2;
      pages.push({ pageNumber, text, characterCount: text.length, wordCount: wordCount(text), characterStart, characterEnd, hasText: text.length >= extractionQualityConfig.minMeaningfulCharsPerPage });
      page.cleanup();
    }
    const totalCharacters = pages.reduce((sum, page) => sum + page.characterCount, 0);
    const totalWords = pages.reduce((sum, page) => sum + page.wordCount, 0);
    const pagesWithText = pages.filter((page) => page.hasText).length;
    const emptyRatio = (pages.length - pagesWithText) / pages.length;
    const average = totalCharacters / pages.length;
    const qualityScore = Math.max(0, Math.min(1, (pagesWithText / pages.length) * 0.6 + Math.min(1, average / 1200) * 0.4));
    const requiresOcr = qualityScore < extractionQualityConfig.ocrQualityThreshold || emptyRatio >= extractionQualityConfig.ocrEmptyPageRatio;
    const canonicalText = pages.map((page) => page.text).join("\n\n");
    const normalizedContentHash = createHash("sha256").update(canonicalText, "utf8").digest("hex");
    const artifact = gzipSync(Buffer.from(JSON.stringify({ version: 1, pageCount: pages.length, totalCharacters, totalWords, pages: pages.map(({ pageNumber: number, text, characterCount, wordCount: words, characterStart, characterEnd, hasText }) => ({ pageNumber: number, text, characterCount, wordCount: words, characterStart, characterEnd, hasText })) })));
    return { pageCount: pages.length, pagesWithText, totalCharacters, totalWords, qualityScore, requiresOcr, pages, sourceHash, normalizedContentHash, artifact };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
    if (name === "PasswordException") throw new ApiError(422, "PASSWORD_PROTECTED_PDF", "This PDF is password protected. Please upload an unlocked copy.");
    throw new ApiError(422, "CORRUPT_PDF", "We couldn't read this PDF. Try exporting or downloading the file again.");
  }
}
