# Phase 5 document pipeline

PDF extraction runs server-side in the API worker. The iPhone only uploads the private source and polls processing status. The development worker uses `processing_jobs` and processes one queued job at a time; BullMQ/Redis can replace it later without changing the extraction contract.

## Lifecycle

`UPLOADED -> EXTRACTION_QUEUED -> EXTRACTING -> TEXT_READY`

Low-quality or scanned documents become `OCR_REQUIRED`; controlled parser failures become `EXTRACTION_FAILED`. Phase 5 does not perform OCR, AI analysis, chapter detection, or audio generation.

The worker retrieves the storage key from `book_files`, downloads the private S3 object into a random OS temp directory, validates `%PDF-`, extracts page-by-page with `pdfjs-dist`, and always removes the temp directory in `finally`.

## Canonical artifact

Successful normal extraction is gzip-compressed JSON at:

```text
users/{userId}/books/{bookId}/extracted/normalized.json.gz
```

```json
{
  "version": 1,
  "bookId": "...",
  "pageCount": 2,
  "totalCharacters": 1234,
  "totalWords": 220,
  "pages": [{
    "pageNumber": 1,
    "text": "...",
    "characterCount": 600,
    "wordCount": 108,
    "characterStart": 0,
    "characterEnd": 600,
    "hasText": true
  }]
}
```

Offsets are against the canonical page text sequence, with two newline separators between pages. Database `document_pages` stores page boundaries and metadata; book text is not placed in PostgreSQL or logs.

Quality uses centralized thresholds: a meaningful page has at least 80 characters; quality is 60% text-bearing-page ratio plus 40% average-character density capped at 1. OCR is recommended when quality is below 0.20 or at least 85% of pages have no meaningful text. A scanned PDF is not treated as a failure.

## Running

The worker requires `SUPABASE_SERVICE_ROLE_KEY` server-side because it processes jobs across users while still using trusted database ownership records:

```bash
npm run api:worker
```

Run the API separately with `npm run api:dev`, then start the worker. The mobile Processing screen polls `GET /api/v1/books/:bookId/processing-status` every three seconds and stops at `TEXT_READY`, `OCR_REQUIRED`, or `EXTRACTION_FAILED`.
