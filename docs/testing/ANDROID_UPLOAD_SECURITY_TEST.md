# Android upload security checklist

1. Start the API and Expo development build on the same network.
2. Sign in and test PDF plus JPEG/PNG/HEIC images.
3. Select multiple images from the system picker, Google Photos, and a `content://` provider URI.
4. Verify thumbnails, Up/Down ordering, Remove, Add Page, and Continue.
5. Capture multiple pages with the camera and verify the camera result URI uploads correctly.
6. Test permission denial, cancellation, blank/blurry/oversized/corrupt images, network interruption, retry, background/resume, and restricted-account flows.
7. Confirm temporary cache files are cleaned and OCR preserves page order.

Physical validation has not been performed by Codex. Record each result as PASS or FAIL and include the device/Android version.
