# Phase 6 OCR pipeline

Scanned PDFs are identified by the Phase 5 extraction quality rules and remain in `OCR_REQUIRED` until a worker has access to the Google Document AI OCR processor. The provider is isolated behind `OCRProvider`; the mobile app never calls Google Cloud.

The worker downloads the private S3 source, sends the bytes to the configured Document OCR processor, normalizes page text using the same page separator (`\\n\\n`) and Unicode/whitespace rules as normal extraction, then calculates `normalized_content_sha256`. OCR output remains a private canonical artifact. Credentials are server-only.

Required server values are `GOOGLE_CLOUD_PROJECT_ID`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`, and Application Default Credentials via `GOOGLE_APPLICATION_CREDENTIALS` or the host identity. OCR cache identity includes `source_sha256` and `OCR_PIPELINE_VERSION`.
