# API

The TypeScript Express API in `apps/api` now includes Phase 4 private PDF storage. Document extraction and AI routes are not part of this phase.

## Local start

From the repository root:

```bash
npm --prefix apps/api install
npm run api:dev
```

Create `apps/api/.env` from `apps/api/.env.example`. Required server-only values are `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; `PORT` defaults to `3000` and `HOST` defaults to `0.0.0.0`.

The mobile app uses `EXPO_PUBLIC_API_URL` only for the API base URL, for example `http://192.168.1.50:3000/api/v1` during iPhone development. Find the Windows address with `ipconfig` and use the active adapter's IPv4 Address. The phone and computer should be on the same network.

## Authentication

Authenticated mobile requests send `Authorization: Bearer <Supabase access token>`. The API passes that token to Supabase `auth.getUser`, which verifies the token and supplies the identity. The API never accepts a client-supplied user ID as authentication evidence.

## Endpoints

- `GET /api/v1/health` is public and returns `{ "data": { "status": "ok", "service": "playbook-api" } }`.
- `GET /api/v1/me` requires a valid Bearer token and returns the verified user ID, email, and that user's profile (if present).
- `PATCH /api/v1/me` requires a valid token and accepts only `{ "displayName": "..." }`.
- `POST /api/v1/books` validates an authenticated PDF upload and returns a short-lived S3 presigned PUT URL.
- `GET /api/v1/books` returns only the authenticated user's books.
- `GET /api/v1/books/:bookId` returns one owned book.
- `POST /api/v1/books/:bookId/upload-complete` verifies the expected S3 object and marks it `UPLOADED`.
- `DELETE /api/v1/books/:bookId` deletes the owned source object and database metadata.
- `GET /api/v1/books/:bookId/processing-status` returns safe status, stage, and progress for the owned book.

Success responses use `{ "data": ... }`. Errors use `{ "error": { "code": "...", "message": "..." } }`; internal stack traces are never returned.

The mobile helper is `src/services/api.ts`. `getCurrentUserFromApi()` is a development connectivity path for testing the authenticated mobile session without adding a production debug screen.

The API is versioned under `/api/v1` and uses `Authorization: Bearer <supabase-jwt>`. Book ownership always comes from the verified token; clients cannot submit `userId`, `bucket`, or `storageKey` as authority.

Initial contracts to document before implementation include upload URL creation, upload completion, book listing/detail/status/chapters, preview requests, audio metadata, progress read/write, bookmarks, memory items, and usage. Requests and responses will be validated with Zod. Long-running work returns a job identifier and is polled by the mobile app; HTTP requests do not wait for full-book generation.
