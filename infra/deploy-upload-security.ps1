param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [int]$AbandonedDays = 2,
  [int]$RejectedDays = 7,
  [int]$MaliciousDays = 30,
  [int]$ScanFailedDays = 2,
  [int]$NormalizedTempDays = 1
)

$ErrorActionPreference = 'Stop'
$config = @{
  Rules = @(
    @{ ID = 'abort-incomplete-multipart'; Status = 'Enabled'; AbortIncompleteMultipartUpload = @{ DaysAfterInitiation = 1 } },
    @{ ID = 'abandoned-quarantine'; Status = 'Enabled'; Filter = @{ Prefix = 'quarantine/' }; Expiration = @{ Days = $AbandonedDays } },
    @{ ID = 'rejected-quarantine'; Status = 'Enabled'; Filter = @{ Tag = @{ Key = 'security-status'; Value = 'REJECTED' } }; Expiration = @{ Days = $RejectedDays } },
    @{ ID = 'malicious-quarantine'; Status = 'Enabled'; Filter = @{ Tag = @{ Key = 'security-status'; Value = 'MALICIOUS' } }; Expiration = @{ Days = $MaliciousDays } },
    @{ ID = 'scan-failed-quarantine'; Status = 'Enabled'; Filter = @{ Tag = @{ Key = 'security-status'; Value = 'SCAN_FAILED' } }; Expiration = @{ Days = $ScanFailedDays } },
    @{ ID = 'temporary-normalized-images'; Status = 'Enabled'; Filter = @{ Prefix = 'processing/' }; Expiration = @{ Days = $NormalizedTempDays } }
  )
} | ConvertTo-Json -Depth 10
$file = Join-Path $env:TEMP 'playbook-upload-security-lifecycle.json'
[IO.File]::WriteAllText($file, $config)
aws s3api put-public-access-block --bucket $Bucket --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-ownership-controls --bucket $Bucket --ownership-controls Rules=[{ObjectOwnership=BucketOwnerEnforced}]
aws s3api put-bucket-lifecycle-configuration --bucket $Bucket --lifecycle-configuration "file://$file"
Remove-Item $file -Force
Write-Host "Upload security lifecycle deployed to $Bucket"
