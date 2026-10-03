# Audio delivery architecture

Phase 6.5 records `catalog_content.audio_status` as `NOT_GENERATED`, `QUEUED`, `GENERATING`, `READY`, or `FAILED`. No audio is generated in this phase. Future audio workers must consume only published/creator-confirmed content, keep provider credentials server-side, and expose signed delivery URLs rather than public storage keys.
