# Creator platform architecture

PlayBook has one Supabase authentication identity. A creator is an authenticated listener with one `creator_profiles` row; creator status is `PENDING`, `ACTIVE`, or `SUSPENDED`.

Only active creators may publish stories or view private Studio analytics. Public creator profiles expose only approved profile and published-story data. Analytics are aggregated and never expose listener identity, email, or private listening history.

Private PDF uploads are personal documents and never become catalog stories automatically. Creator submission is a separate future workflow requiring rights declaration, moderation, approval, and publication.

Creator manuscripts use private, server-derived S3 keys and the existing document-processing pipeline. The creator-facing state hides extraction/OCR internals and exposes processing, processing failure, and ready-for-review states.
