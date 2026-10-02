# Database

The planned Supabase PostgreSQL schema contains `profiles`, `books`, `book_files`, `chapters`, `text_chunks`, `audio_chunks`, `audio_segments`, `listening_progress`, `bookmarks`, `notes`, `memory_items`, `processing_jobs`, `usage_ledger`, and `subscriptions`.

Phase 2 adds the reproducible migration at `supabase/migrations/20261002000000_create_profiles.sql`. It creates a profile row from `auth.users`, enables RLS, and permits only the matching authenticated user to read or update that profile.

Phase 4 adds `supabase/migrations/20261003000000_create_books.sql`. It creates `books` and `book_files`, stores only PDF metadata and private S3 object keys, enables RLS, and limits every operation to `auth.uid() = user_id`. The API applies the same ownership predicate.

Every user-owned table includes an ownership path back to the authenticated user. Row-level security is required. PDFs and audio remain in private S3 objects; PostgreSQL stores metadata and object keys. Schema changes must be additive migrations with reviewed rollback considerations.
