param([Parameter(Mandatory = $true)][string]$Bucket)
$ErrorActionPreference = 'Stop'
$public = aws s3api get-public-access-block --bucket $Bucket | ConvertFrom-Json
$ownership = aws s3api get-bucket-ownership-controls --bucket $Bucket | ConvertFrom-Json
$lifecycle = aws s3api get-bucket-lifecycle-configuration --bucket $Bucket | ConvertFrom-Json
if (-not $public.PublicAccessBlockConfiguration.BlockPublicAcls -or -not $public.PublicAccessBlockConfiguration.BlockPublicPolicy -or -not $public.PublicAccessBlockConfiguration.IgnorePublicAcls -or -not $public.PublicAccessBlockConfiguration.RestrictPublicBuckets) { throw 'S3 Block Public Access is not fully enabled.' }
if (-not ($ownership.Rules.ObjectOwnership -contains 'BucketOwnerEnforced')) { throw 'Bucket owner enforced ownership is not configured.' }
Write-Host "Upload security AWS configuration verified for $Bucket"
Write-Host ("Lifecycle rules: " + $lifecycle.Rules.Count)
Write-Host 'GuardDuty malware protection must still be verified in the GuardDuty console/API for this bucket.'
