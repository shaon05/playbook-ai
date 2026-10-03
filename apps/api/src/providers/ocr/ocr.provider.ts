export type OcrPage = { pageNumber: number; text: string; confidence?: number; language?: string };
export type OcrResult = { pages: OcrPage[]; averageConfidence?: number; detectedLanguage?: string };

export interface OCRProvider {
  processPdf(input: { bytes: Uint8Array; mimeType: "application/pdf" }): Promise<OcrResult>;
  processImage(input: { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" }): Promise<OcrResult>;
}
