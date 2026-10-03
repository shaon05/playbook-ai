import sharp from "sharp";

export type DetectedDocumentType = "application/pdf" | "image/jpeg" | "image/png" | "image/heic" | "image/heif" | "unsupported";
export type DocumentValidation = { valid: boolean; detectedMimeType: DetectedDocumentType; reasonCode?: string; summary?: string };

function pngDimensions(bytes: Uint8Array) { return bytes.length >= 24 ? { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) } : null; }
export function detectDocumentType(bytes: Uint8Array): DetectedDocumentType {
  if (bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return "unsupported";
}
export async function validateDocumentBytes(bytes: Uint8Array, declaredMimeType: string, maxImagePixels: number): Promise<DocumentValidation> {
  let detectedMimeType = detectDocumentType(bytes);
  if (detectedMimeType === "unsupported" && (declaredMimeType === "image/heic" || declaredMimeType === "image/heif")) {
    try {
      const metadata = await sharp(bytes).metadata();
      if (metadata.format === "heif") detectedMimeType = declaredMimeType;
    } catch {
      // Keep the unsupported result. The caller receives a safe validation error.
    }
  }
  if (detectedMimeType === "unsupported") return { valid: false, detectedMimeType, reasonCode: "UNSUPPORTED_FILE_TYPE", summary: "This file type is not supported." };
  if (detectedMimeType !== declaredMimeType) return { valid: false, detectedMimeType, reasonCode: "FILE_TYPE_MISMATCH", summary: "The file type did not match its declared type." };
  if (detectedMimeType === "image/png") { const dimensions = pngDimensions(bytes); if (!dimensions || dimensions.width * dimensions.height > maxImagePixels) return { valid: false, detectedMimeType, reasonCode: "PROCESSING_LIMIT_EXCEEDED", summary: "This image is too large to process safely." }; }
  if (["image/jpeg", "image/heic", "image/heif"].includes(detectedMimeType)) {
    try {
      const metadata = await sharp(bytes).metadata();
      if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxImagePixels) return { valid: false, detectedMimeType, reasonCode: "PROCESSING_LIMIT_EXCEEDED", summary: "This image is too large to process safely." };
    } catch {
      return { valid: false, detectedMimeType, reasonCode: "INVALID_IMAGE", summary: "This image could not be read safely." };
    }
  }
  return { valid: true, detectedMimeType };
}
