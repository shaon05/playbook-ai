export type DuplicateBookStatus = string;

export function duplicateMessageForStatus(status: DuplicateBookStatus) {
  const preparing = new Set(["CREATED", "UPLOAD_PENDING", "UPLOADED", "EXTRACTION_QUEUED", "EXTRACTING", "OCR_REQUIRED", "OCR_PROCESSING", "ANALYSIS_QUEUED", "ANALYZING", "PROCESSING"]);
  return preparing.has(status)
    ? { title: "Already being prepared", message: "PlayBook is already preparing this document." }
    : { title: "Already in your Library", message: "This document is already in your Library." };
}

export function isActiveDuplicateConstraintError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" && error.message?.includes("books_active_user_source_unique") === true;
}
