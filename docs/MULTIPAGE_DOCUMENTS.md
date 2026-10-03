# Multi-page documents

Private photo documents use `documents` and `document_input_pages`. Each page has its own `document_uploads` record and quarantine object. The server owns `page_index`; the mobile client submits an explicit ordered page ID list and the API rejects duplicates, foreign pages, missing pages, and non-contiguous ordering.

The processing worker checks every page for `CLEAN` and `VALID` before downloading any page for OCR. Pages are OCR'd in `page_index` order and combined through the existing normalization/content pipeline. A failed, malicious, or unreadable page blocks the whole document.

Creator manuscripts remain PDF-only by product policy.
