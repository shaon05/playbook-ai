# Architecture

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
