# Phase 6 book analysis

Book analysis is isolated behind `AIProvider`. The OpenAI provider receives a compact structural representation rather than user profile data or unrelated books. Uploaded document text is treated as untrusted data and cannot override the analysis instructions.

Structured output is validated with Zod before any chapter rows are stored. Chapter indexes, page ranges, and normalized-text offsets must be ordered, non-overlapping, and within the source document bounds. Analysis cache identity is `normalized_content_sha256 + model + BOOK_ANALYSIS_PROMPT_VERSION + BOOK_ANALYSIS_PIPELINE_VERSION`.

OpenAI credentials are server-only. `content_analyses` stores metadata and `content_chapters` stores reusable structure; listening progress remains user-owned and is not stored on shared chapter rows.
