# Document inputs

The current supported inputs are PDF, JPEG, and PNG. HEIC/HEIF, GIF, video, archives, and multi-image manifests are not claimed as supported yet. The mobile file picker uses Expo DocumentPicker for one document at a time; camera capture and ordered multi-page photo documents remain future work.

PDFs continue through the existing extraction/OCR pipeline. Images use the existing OCR provider interface and normalized page-text architecture. Originals remain private and are never made public through catalog routes.
