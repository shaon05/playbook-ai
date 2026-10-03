# Upload security infrastructure template

The production quarantine bucket/prefix must have S3 Block Public Access enabled, ACLs disabled, no public bucket policy, and separate least-privilege IAM permissions for API presigning, scanner tagging, and workers. The application uses `QUARANTINE_BUCKET` when configured and otherwise the server S3 bucket.

Recommended lifecycle defaults for this project (configurable, not legal-retention advice):

- Abandoned uploads: delete after 2 days.
- Harmless rejected files: delete after 7 days.
- Confirmed malicious files: retain in restricted quarantine for 30 days for security review, then delete according to organizational policy.
- Clean promoted sources: retain under the normal private-source policy.
- Abort incomplete multipart uploads after 1 day.

AWS GuardDuty Malware Protection for S3 should tag scanned objects with `GuardDutyMalwareScanStatus`. The API accepts only `NO_THREATS_FOUND` as CLEAN; missing, unsupported, or failed tags remain unprocessable. Configure `MALWARE_SCANNER_PROVIDER=aws` and provide the required IAM/scanner setup before production.
