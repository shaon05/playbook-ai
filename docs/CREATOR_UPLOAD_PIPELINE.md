# Creator manuscript upload pipeline

Creators select PDF files with Expo DocumentPicker. The API creates a server-derived private key:

`creators/{creatorId}/submissions/{submissionId}/source/original.pdf`

The mobile app receives only a short-lived presigned PUT URL and uploads directly to S3. Upload completion performs a server-side `HeadObject` check for the expected key, non-zero size, configured maximum size, and PDF content type. The client cannot choose a bucket, creator ID, submission ID, or storage key.

After moderation approval, the API creates an internal processing book/file record and queues the existing `DOCUMENT_EXTRACTION` job with `creator_submission_id`. The existing worker performs SHA-256 hashing, content-asset cache lookup, PDF extraction, OCR when required, normalization, analysis, and chapter detection. When analysis reaches `CHAPTERS_READY`, the submission becomes `READY_FOR_CREATOR_REVIEW` and links to private canonical content metadata.

Hash reuse may reuse compatible extraction or analysis results, but never replaces the rights declaration or moderation decision. Source replacement is allowed only in `DRAFT` and `CHANGES_REQUESTED`; it clears stale hash/processing references. Processing failures map to `PROCESSING_FAILED` with a safe internal code. Queue creation and approval are idempotent through the active-job index and submission-linked references.

Guest analytics remain intentionally deferred; PlayBook does not use device fingerprinting or persistent hardware identifiers.
