import { v1 as documentAi } from "@google-cloud/documentai";
import type { ApiEnv } from "../../config/env";
import type { OCRProvider, OcrResult } from "./ocr.provider";

function textFromAnchor(text: string, anchor: { textSegments?: Array<{ startIndex?: number|string|{ toString(): string }|null; endIndex?: number|string|{ toString(): string }|null }> | null } | null | undefined) {
  return (anchor?.textSegments ?? []).map((segment) => text.slice(Number(segment.startIndex ?? 0), Number(segment.endIndex ?? 0))).join("");
}

export class GoogleDocumentAiProvider implements OCRProvider {
  private readonly client: documentAi.DocumentProcessorServiceClient;
  constructor(private readonly env: ApiEnv) {
    this.client = new documentAi.DocumentProcessorServiceClient({ apiEndpoint: `${env.GOOGLE_CLOUD_LOCATION}-documentai.googleapis.com` });
  }

  async processPdf(input: { bytes: Uint8Array; mimeType: "application/pdf" }): Promise<OcrResult> {
    if (!this.env.GOOGLE_CLOUD_PROJECT_ID || !this.env.GOOGLE_CLOUD_LOCATION || !this.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID) throw new Error("OCR_NOT_CONFIGURED");
    const name = `projects/${this.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${this.env.GOOGLE_CLOUD_LOCATION}/processors/${this.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
    try {
      const [response] = await this.client.processDocument({ name, rawDocument: { content: Buffer.from(input.bytes).toString("base64"), mimeType: input.mimeType }, processOptions: { ocrConfig: { enableImageQualityScores: true } } });
      const document = response.document;
      const fullText = document?.text ?? "";
      const pages = (document?.pages ?? []).map((page, index) => {
        const text = (page.paragraphs ?? []).map((paragraph) => textFromAnchor(fullText, paragraph.layout?.textAnchor)).join("\n").trim();
        return { pageNumber: index + 1, text, confidence: page.imageQualityScores?.qualityScore ?? undefined };
      });
      const confidences = pages.flatMap((page) => page.confidence === undefined ? [] : [page.confidence]);
      return { pages, averageConfidence: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : undefined };
    } catch {
      throw new Error("OCR_PROVIDER_ERROR");
    }
  }

  async processImage(input: { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" }): Promise<OcrResult> {
    if (!this.env.GOOGLE_CLOUD_PROJECT_ID || !this.env.GOOGLE_CLOUD_LOCATION || !this.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID) throw new Error("OCR_NOT_CONFIGURED");
    const name = `projects/${this.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${this.env.GOOGLE_CLOUD_LOCATION}/processors/${this.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
    try {
      const [response] = await this.client.processDocument({ name, rawDocument: { content: Buffer.from(input.bytes).toString("base64"), mimeType: input.mimeType }, processOptions: { ocrConfig: { enableImageQualityScores: true } } });
      const document = response.document; const text = document?.text ?? "";
      const pages = [{ pageNumber: 1, text: text.trim(), confidence: document?.pages?.[0]?.imageQualityScores?.qualityScore ?? undefined }];
      return { pages, averageConfidence: pages[0].confidence };
    } catch { throw new Error("OCR_PROVIDER_ERROR"); }
  }
}
