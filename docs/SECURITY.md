# Security

## Phase 3 backend

The API accepts a Supabase access token only in the `Authorization: Bearer ...` header. It verifies the token through Supabase `auth.getUser`; it does not decode an unverified JWT and does not trust `userId` in request bodies, query strings, or paths. After verification, only a normalized `{ id, email }` context is attached to the request.

`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and any future service-role key are backend environment variables. They are not `EXPO_PUBLIC_*` values. Tokens, passwords, keys, and authorization headers are excluded from logs. Production errors do not include stack traces.

The API binds to `0.0.0.0` in development so a phone can reach it over the LAN. Configure `CORS_ORIGIN` for browser clients; native React Native requests are not governed by browser CORS. Per-user and per-IP rate limiting remains required before public launch, especially for future AI-generation endpoints.

The mobile bundle may contain only public Expo/Supabase configuration. OpenAI, ElevenLabs, AWS secret credentials, Supabase service-role keys, and Google private credentials remain server/worker-only.

Uploads are private by default and use presigned access. Every book query checks authenticated ownership server-side. User-facing errors are safe and actionable; provider details and stack traces stay in server logs. Deletion must remove source assets, generated audio, and associated metadata where appropriate.

Phase 4 signs only the server-generated `users/{userId}/books/{bookId}/source/original.pdf` key for 10 minutes by default. The API verifies S3 object metadata before marking a book uploaded, and rejects unsupported MIME types and files above the configured maximum. AWS credentials remain server-only; the mobile app sees only the temporary upload URL and required upload headers.

Phase 5 keeps extraction server-side. The worker never accepts a storage key, bucket, or user ID from mobile; it reads the source key from an owned database row. Temporary source files are job-scoped and deleted in cleanup blocks. Extracted text remains private in S3, is not logged, sent to AI providers, or exposed through ordinary book endpoints.

Phase 5.5 does not share original PDFs or user-owned records. Mobile cannot submit source hashes, normalized hashes, content asset IDs, cache status, or pipeline versions as trusted values. Internal content assets are not directly readable by the authenticated mobile role.

Creator manuscript upload uses the private `creators/{creatorId}/submissions/{submissionId}/source/original.pdf` prefix. The API validates ownership, PDF type, size, expected server-derived key, and S3 object metadata before persisting the source. Creator approval creates the internal processing link; clients cannot supply `creatorId`, `storageKey`, `contentAssetId`, processing status, catalog status, or analytics totals. Hash reuse is strictly a technical optimization and never substitutes for rights declaration or moderation.

Phase 6.5E adds quarantine upload records, server-side magic-byte checks, explicit malware-scanner abstraction, security events, typed account restrictions, and a centralized worker gate requiring CLEAN plus VALID before extraction, OCR, analysis, or creator processing.

## Phase 2 authentication

The mobile client uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Sessions persist through SecureStore on native and AsyncStorage on web, with automatic token refresh while the app is active. The Supabase service-role key is never read by the mobile client.

The `profiles` table is protected by RLS. Profile reads and updates are constrained by `auth.uid() = id`; the database trigger creates the profile from signup metadata so mobile completion is not required for account setup.

The existing `playbookai://auth/callback` scheme is used for password-reset callbacks. Google and Apple remain disabled until their provider credentials and redirect settings are configured in Supabase and the respective provider consoles.
