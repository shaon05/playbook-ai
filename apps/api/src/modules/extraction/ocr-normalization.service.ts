import { createNormalizedExtraction } from "./extraction.service";
import type { OcrPage } from "../../providers/ocr/ocr.provider";

export function normalizeOcrPages(pages: OcrPage[]) {
  return createNormalizedExtraction(pages);
}
