# Worker isolation

The extraction worker is a separate process from the Express API and owns PDF parsing, image decoding, normalization, and OCR. It uses parser, image, OCR, and retry timeouts and removes temporary files in `finally` blocks. Production should run it as a separate least-privilege process/container with CPU, memory, and temporary-storage limits.

The worker requires access only to the processing S3 prefixes, the processing database records, and the configured OCR provider. It must not receive mobile credentials, payment secrets, or unrestricted account administration permissions.

Processing jobs are claimed through the shared Postgres `claim_next_processing_job` function using row locks and `SKIP LOCKED`. A lease allows a later worker to reclaim a job left in `RUNNING` after a crashed worker. The worker never treats process memory as job state; local files are temporary and removed in `finally` blocks.
