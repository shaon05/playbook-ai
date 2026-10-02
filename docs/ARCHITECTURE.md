# Architecture

## Phase 3 API

The backend now lives in `apps/api` as a small Express TypeScript service. Its request path is:

`Expo mobile -> Bearer Supabase access token -> Express auth middleware -> Supabase auth.getUser -> protected route`

The API has centralized environment validation, a request-scoped Supabase client carrying the verified token for RLS-backed profile queries, structured request logs, Helmet, CORS, JSON limits, Zod validation, and centralized error responses. The service uses the publishable Supabase key; a service-role key is not needed for these user-scoped routes and must remain server-only if introduced later.

Start as a modular monolith in a monorepo:

```text
apps/mobile   Expo Router client
apps/api      authenticated REST API
apps/worker   BullMQ background jobs
packages/ui   shared visual primitives where useful
packages/contracts  validated API schemas
packages/config     environment and provider configuration
packages/utils      small domain utilities
docs/         product and technical decisions
```

The current repository is the mobile app. Backend folders are intentionally deferred until Phase 3 so the shell remains easy to run and review.

External services must be behind provider interfaces (`AIProvider`, `TTSProvider`, `OCRProvider`, `StorageProvider`, and later `SubscriptionProvider`). The API verifies Supabase JWTs and owns access checks; the worker handles long-running ingestion and audio work.

The mobile client now has one Supabase client in `src/lib/supabase.ts` and one `AuthProvider` in `src/providers/auth-provider.tsx`. Expo Router protected screens guard the existing tabs, book, player, processing, and profile-edit routes.

Phase 4 adds a storage provider boundary. `S3StorageProvider` owns AWS SDK calls; book routes receive a `StorageProvider` and never construct S3 commands directly. The mobile app picks PDFs, requests a presigned URL, uploads directly to S3, and calls the API to verify completion.

Phase 5 adds `apps/api/src/worker.ts` as a temporary single-process job runner over `processing_jobs`. It claims queued jobs before extraction, uses trusted `book_files` records, writes private normalized artifacts, and cleans temporary files. It deliberately does not add Redis or BullMQ yet.

Phase 5.5 separates user-owned `books` from internal reusable `content_assets`. Source objects remain user-scoped; only compatible processing results may be reused.
