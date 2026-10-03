# Upload security AWS deployment

Run these commands from PowerShell after installing/configuring the AWS CLI and selecting the intended region.

```powershell
$env:AWS_REGION="us-east-1"
$bucket="playbook-quarantine-prod"
aws configure set region $env:AWS_REGION
npm run aws:deploy:upload-security -- -Bucket $bucket
npm run aws:verify:upload-security -- -Bucket $bucket
```

The bucket must be private, use S3 Block Public Access, and use BucketOwnerEnforced ownership. Configure GuardDuty Malware Protection for S3 for this bucket and confirm its result/tag/event mechanism before setting `MALWARE_SCANNER_PROVIDER=aws`.

Set server-only variables in `apps/api/.env` or the deployment secret manager:

```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=playbook-quarantine-prod
QUARANTINE_BUCKET=playbook-quarantine-prod
MALWARE_SCANNER_PROVIDER=aws
```

Restart the API and worker, then run:

```powershell
$env:ALLOW_SECURITY_E2E="true"
$env:SECURITY_E2E_ACCESS_TOKEN="<short-lived-test-user-token>"
npm run security:e2e -- --mode clean
npm run security:e2e -- --mode malware-test
```

Confirm that clean files pass the processing gate, the EICAR test remains quarantined and never reaches OCR, and the security event contains a `PB-SEC-*` reference. Do not use real malware.
