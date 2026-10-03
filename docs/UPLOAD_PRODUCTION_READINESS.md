# Upload production readiness

Status vocabulary: `IMPLEMENTED`, `DEPLOYED`, `LIVE VERIFIED`, `DEVICE VERIFIED`, `BLOCKED`.

Current status:

| Control | Status |
|---|---|
| Quarantine routing and security gate | IMPLEMENTED |
| Production scanner integration | IMPLEMENTED; DEPLOYED BLOCKED |
| S3 lifecycle automation | IMPLEMENTED; DEPLOYED BLOCKED |
| HEIC schema and normalization path | IMPLEMENTED IN CODE; LIVE VERIFIED BLOCKED |
| Multi-page mobile documents | BLOCKED — current API remains single-source |
| iPhone validation | DEVICE VERIFIED: NO |
| Android validation | DEVICE VERIFIED: NO |

PowerShell deployment:

```powershell
.\infra\deploy-upload-security.ps1 -Bucket playbook-quarantine
```

Live E2E requires a controlled authenticated test user and a running API:

```powershell
$env:ALLOW_SECURITY_E2E="true"
$env:SECURITY_E2E_ACCESS_TOKEN="<short-lived-test-user-token>"
npm run security:e2e -- --mode clean
npm run security:e2e -- --mode malware-test
```

The malware mode generates the standard EICAR test string at runtime; it is not stored in the repository. Results must be reported as `PASS`, `FAIL`, or `INCONCLUSIVE` based on the deployed scanner response.

- [ ] Configure `MALWARE_SCANNER_PROVIDER=aws` with AWS GuardDuty Malware Protection for S3, or install an approved scanner provider.
- [ ] Keep S3 Block Public Access enabled and disable public ACLs.
- [ ] Configure quarantine lifecycle rules and incomplete-upload cleanup.
- [ ] Verify least-privilege API, scanner, and worker IAM roles.
- [ ] Configure parser, OCR, image, retry, and pixel limits.
- [ ] Verify HEIC support on the deployed image-processing runtime before enabling it.
- [ ] Complete physical iPhone and Android tests.
- [ ] Run clean, malformed, type-spoofed, blank, large, and scanner-failure tests.
- [ ] Run a provider-supported safe antivirus fixture test in a non-production environment.
- [ ] Verify restriction and processing-gate behavior.
- [ ] Confirm logs contain no document text, private images, tokens, or secrets.
