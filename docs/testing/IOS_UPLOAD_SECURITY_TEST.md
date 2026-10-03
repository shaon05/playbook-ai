# iOS upload security checklist

1. Start the API and Expo development build on the same network.
2. Sign in and open Upload Document.
3. Test one JPEG, PNG, HEIC, and PDF.
4. Choose Photos, select 3 pages, verify thumbnails and use Up/Down, Remove, and Add Page.
5. Take Photos, capture page 1, page 2, then Done; verify page order.
6. Test blank, blurry, oversized, corrupt, cancelled, permission-denied, interrupted-network, background/resume, retry, and restricted-account flows.
7. Confirm progress says `Uploading page N of M` and that OCR preserves page order.

Physical validation has not been performed by Codex. Record each result as PASS or FAIL and include the device/iOS version.
