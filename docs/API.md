# API

The API is versioned under `/api/v1` and uses `Authorization: Bearer <supabase-jwt>`.

Initial contracts to document before implementation include upload URL creation, upload completion, book listing/detail/status/chapters, preview requests, audio metadata, progress read/write, bookmarks, memory items, and usage. Requests and responses will be validated with Zod. Long-running work returns a job identifier and is polled by the mobile app; HTTP requests do not wait for full-book generation.
