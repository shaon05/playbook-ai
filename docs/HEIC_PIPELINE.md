# HEIC/HEIF pipeline

Private uploads accept `image/heic` and `image/heif`. The server does not trust the client MIME value: it uses `sharp` metadata and decoding, enforces image limits, applies orientation with `rotate()`, strips unnecessary metadata while producing a JPEG OCR input, and keeps the original in private quarantine storage.

HEIC availability depends on the deployed `sharp`/libvips build. Deployment verification must confirm HEIC decoding before enabling this path. A decoder failure is an infrastructure or invalid-image error, not an account security violation.

The API health response exposes `imageProcessing.heic`; operators should require it to be true before advertising HEIC support.
