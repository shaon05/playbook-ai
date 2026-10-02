# AI pipeline

Ingestion validates the file, extracts ordinary text, measures extraction quality, uses OCR only when needed, normalizes text, detects chapters, chunks text, and generates a short preview before full-book audio.

OpenAI handles structured content understanding and ElevenLabs handles TTS. Model names are environment-configured. Structured model output is schema-validated before persistence. Audio caching keys include text hash, voice, model, and settings. Jobs are idempotent and record progress, attempts, and safe user-facing error states.
