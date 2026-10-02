# Private document storage

Phase 4 stores uploaded PDFs in a private S3 bucket. The mobile app never receives AWS credentials and the PDF never passes through the Node API.

## Upload lifecycle

1. The authenticated app sends PDF metadata to `POST /api/v1/books`.
2. The API verifies identity, validates type/size, creates ownership-scoped metadata, and returns a short-lived presigned PUT URL.
3. The app uploads the local file directly to S3 and reports completion.
4. The API performs `HeadObject` verification for the expected key, content type, and exact size, then marks the book `UPLOADED`.

The key is always server-generated: `users/{authenticatedUserId}/books/{bookId}/source/original.pdf`.

## Environment and AWS setup

Backend-only values are `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `MAX_UPLOAD_SIZE_MB`, and `S3_PRESIGNED_URL_EXPIRES_SECONDS`. No real credentials belong in documentation or source control. Production should use an IAM role or workload identity instead of long-lived keys where supported.

In the AWS Console: create a dedicated bucket near initial users; keep **Block all public access** enabled; use **Bucket owner enforced** Object Ownership; do not enable static website hosting or public policies; keep default SSE-S3 encryption for development and consider SSE-KMS for production. Versioning is optional for development and recommended for production recovery.

For local development, use a dedicated IAM identity with object permissions limited to this bucket. Required permissions are `s3:PutObject`, `s3:GetObject` (which covers `HeadObject`), and `s3:DeleteObject` on `arn:aws:s3:::YOUR_BUCKET_NAME/users/*`. No AdministratorAccess or bucket-wide listing permission is required.

Native iPhone uploads through Expo FileSystem do not require S3 CORS. Configure CORS only for future browser clients, restricted to the real web origin and `PUT` with `Content-Type`/`Content-Length` headers.

## State machine

`CREATED -> UPLOAD_PENDING -> UPLOADED`

Signing or storage failures use `UPLOAD_FAILED`. `PROCESSING`, `READY`, and `FAILED` are reserved for future ingestion. Source PDFs do not expire automatically; incomplete multipart-upload cleanup can be added later.

Phase 5 stores the normalized gzip artifact beside the source under `extracted/normalized.json.gz`. The worker uses authenticated server AWS access, never a public URL, and deletes that artifact when the owning book is deleted.

New Phase 5.5 canonical artifacts use `content-assets/{contentAssetId}/extraction/{pipelineVersion}/normalized.json.gz`. Existing Phase 5 user-scoped artifacts are not migrated automatically. Source PDFs remain under each user's own `users/{userId}/books/{bookId}/source/original.pdf` path.
