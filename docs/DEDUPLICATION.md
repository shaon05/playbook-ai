# Phase 5.5 content deduplication

PlayBook keeps each user's `books` row and private source PDF separate. Reuse is limited to internal processing results represented by `content_assets`.

## Cache identity

- `source_sha256`: SHA-256 of the complete downloaded source PDF bytes. This is calculated in the worker from the trusted S3 object, not from mobile metadata.
- `normalized_content_sha256`: SHA-256 of the canonical normalized page text joined with exactly two newline characters (`page 1 + "\n\n" + page 2 ...`). It excludes IDs, timestamps, filenames, and processing metadata.
- `extraction_pipeline_version`: currently `EXTRACTION_PIPELINE_VERSION=v1`.

The first cache level matches source bytes and extraction version, so normal extraction can be skipped. The normalized hash is the future compatibility key for AI/TTS results; Phase 5.5 does not run those providers.

## Race handling

`content_assets(source_sha256, extraction_pipeline_version)` has a unique index. The first worker that creates the processing asset owns extraction. A concurrent job sees `PROCESSING`, waits, then rechecks the canonical result. A unique-insert race rechecks the same asset. The temporary worker is single-process; a future queue can replace waiting with a durable claim/notification mechanism.

## Privacy and deletion

Source PDFs remain at each user's private key. Content assets contain only reusable processing metadata and canonical extraction artifacts. User A and User B retain separate book records and all future user-owned progress, notes, bookmarks, favorites, and metadata. Deleting one book deletes its source and user extraction metadata but leaves `content_assets` intact while any book references remain. Zero-reference cleanup is deliberately deferred to a retention job.

Creator manuscript review uses the trusted source hash first and the normalized-content hash after extraction. A same-creator match reuses compatible canonical processing. A cross-creator match creates `POTENTIAL_DUPLICATE_MANUSCRIPT` with `requires_review=true`; it never grants or implies an originality or copyright decision. A `NO_MATCH` is not `ORIGINAL_VERIFIED`. Technical cache reuse never transfers private uploader identity or user-specific metadata.

Future keys should include compatible model/prompt/pipeline versions for AI and voice settings for TTS. No public content, source sharing, OCR, AI, or audio is implemented here.
