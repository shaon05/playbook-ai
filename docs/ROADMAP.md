# Roadmap

## Phase 3 — backend foundation

Implemented: `apps/api` Express TypeScript service, validated server environment, verified Supabase Bearer authentication, public health route, protected `/me` route, safe profile update, consistent errors, security middleware, request logging, mobile API client, and LAN/iPhone documentation.

Next Phase 4 should design user-scoped document storage and upload authorization. Do not add those capabilities to the Phase 3 service implicitly.

## Phase 4 — private PDF storage

Implemented: private S3 presigned uploads, PDF-only picker flow, upload progress, upload verification, real uploaded-book library/detail views, ownership checks, deletion, and RLS-backed metadata. PDF extraction and processing remain Phase 5.

0. Architecture, docs, design system, and mobile shell — implemented.
1. Mobile shell and mock library — implemented with local mock interactions.
2. Supabase authentication — email/password foundation implemented; Google/Apple provider setup remains external.
3. Backend API and JWT verification.
4. Secure S3 PDF upload.
5. Text extraction and chapter analysis.
6. ElevenLabs preview audio.
7. Real player and progress persistence.
8. BullMQ jobs, usage ledger, Remember, subscriptions, and later Story Mode.

The next development phase is Phase 2: authentication with Supabase, beginning with session handling and protected routes while keeping provider secrets out of the client.
