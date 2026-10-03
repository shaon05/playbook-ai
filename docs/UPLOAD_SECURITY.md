# Upload security

Every new private or creator document is owned by the authenticated user before a presigned URL is issued. Objects land in private quarantine prefixes and are represented by `document_uploads`. Processing requires both `security_status=CLEAN` and `validation_status=VALID`.

The gateway checks PDF/JPEG/PNG signatures, declared-type agreement, size, and safe image dimensions. The development scanner is explicitly named `development-safe-placeholder`; production must configure an actual malware scanner such as isolated ClamAV or an AWS-native service. Scanner failure never becomes CLEAN.

Ordinary invalid, blank, blurry, corrupted, or unsupported files create low-severity events and do not suspend users. Confirmed malicious or high-confidence suspicious activity can create `UPLOAD_BLOCKED` restrictions and a `PB-SEC-XXXXXX` reference. Security details and file contents are never shown to users.
