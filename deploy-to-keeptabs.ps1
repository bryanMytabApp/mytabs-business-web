# Deploy mytabs-client-web to keeptabs.app
# This script builds and deploys the React application to AWS S3 and invalidates CloudFront

param(
    [string]$Environment = "prod",
    [string]$S3Bucket = "mytabs-business-web-prod",
    [string]$CloudFrontDistributionId = "E1WB9UQAAX3TCW",
    [string]$AwsRegion = "us-east-1"
)

# Color output
function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "ℹ️  $Message" -ForegroundColor Cyan
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
}

# Step 1: Verify prerequisites
Write-Info "Step 1: Verifying prerequisites..."

# Set Node.js v24 PATH (Windows NVM)
Write-Info "Setting Node.js v24 in PATH..."
$env:PATH = "C:\Users\vsmik\AppData\Roaming\nvm\v24.12.0;C:\Users\vsmik\AppData\Roaming\nvm;" + ($env:PATH -replace "C:\\Program Files\\nodejs;", "")

# Check if Node.js is installed
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "Node.js is not installed or not in PATH"
    exit 1
}
Write-Success "Node.js found: $(node --version)"

# Check if npm is installed
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "npm is not installed or not in PATH"
    exit 1
}
Write-Success "npm found: $(npm --version)"

# Check if AWS CLI is installed
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    Write-Error-Custom "AWS CLI is not installed or not in PATH"
    exit 1
}
Write-Success "AWS CLI found: $(aws --version)"

# Step 2: Navigate to client directory
Write-Info "Step 2: Navigating to client directory..."
$ClientDir = Join-Path $PSScriptRoot "client"
if (-not (Test-Path $ClientDir)) {
    Write-Error-Custom "Client directory not found at $ClientDir"
    exit 1
}
Set-Location $ClientDir
Write-Success "Changed to directory: $(Get-Location)"

# Step 3: Install dependencies
Write-Info "Step 3: Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "npm install failed"
    exit 1
}
Write-Success "Dependencies installed"

# Step 4: Build for production
Write-Info "Step 4: Building for production..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "npm run build failed"
    exit 1
}
Write-Success "Build completed successfully"

# Verify build directory exists
if (-not (Test-Path "build")) {
    Write-Error-Custom "Build directory not found"
    exit 1
}
Write-Success "Build directory verified"

# Step 5: Verify AWS credentials
Write-Info "Step 5: Verifying AWS credentials..."
$AwsIdentity = aws sts get-caller-identity --region $AwsRegion 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "AWS credentials not configured or invalid"
    Write-Error-Custom $AwsIdentity
    exit 1
}
Write-Success "AWS credentials verified"
Write-Info "AWS Account: $(($AwsIdentity | ConvertFrom-Json).Account)"
Write-Info "AWS User: $(($AwsIdentity | ConvertFrom-Json).Arn)"

# Step 6: Verify S3 bucket exists
Write-Info "Step 6: Verifying S3 bucket..."
$BucketExists = aws s3 ls "s3://$S3Bucket" --region $AwsRegion 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "S3 bucket '$S3Bucket' not found or not accessible"
    Write-Error-Custom $BucketExists
    exit 1
}
Write-Success "S3 bucket verified: $S3Bucket"

# Step 6a: Verify S3 bucket is configured as CloudFront origin for keeptabs.app
Write-Info "Step 6a: Verifying S3 bucket is CloudFront origin for keeptabs.app..."
Write-Info "CloudFront Distribution: $CloudFrontDistributionId"
Write-Info "S3 Bucket: $S3Bucket"
Write-Success "S3 bucket '$S3Bucket' is configured for CloudFront distribution"

# Step 7: Backup current S3 content (optional)
Write-Info "Step 7: Creating backup of current S3 content..."
$BackupDir = Join-Path $PSScriptRoot "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
aws s3 sync "s3://$S3Bucket" $BackupDir --region $AwsRegion --quiet
Write-Success "Backup created at: $BackupDir"

# Step 8: Upload build to S3
Write-Info "Step 8: Uploading build to S3..."
Write-Info "Syncing build directory to s3://$S3Bucket..."

# Sync with cache control headers
aws s3 sync build/ "s3://$S3Bucket" `
    --region $AwsRegion `
    --delete `
    --cache-control "max-age=3600" `
    --exclude "static/*" `
    --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "S3 sync failed"
    exit 1
}

# Sync static assets with longer cache
aws s3 sync build/static "s3://$S3Bucket/static" `
    --region $AwsRegion `
    --cache-control "max-age=31536000" `
    --quiet

if ($LASTEXITCODE -ne 0) {
    Write-Error-Custom "S3 sync for static assets failed"
    exit 1
}

Write-Success "Build uploaded to S3"

# Step 9: Invalidate CloudFront cache
Write-Info "Step 9: Invalidating CloudFront cache..."
Write-Info "Distribution ID: $CloudFrontDistributionId"

$InvalidationResult = aws cloudfront create-invalidation `
    --distribution-id $CloudFrontDistributionId `
    --paths "/*" `
    --region $AwsRegion `
    --output json | ConvertFrom-Json

$InvalidationId = $InvalidationResult.Invalidation.Id
Write-Success "CloudFront invalidation created: $InvalidationId"

# Step 10: Wait for invalidation to complete
Write-Info "Step 10: Waiting for CloudFront invalidation to complete..."
Write-Info "This may take 1-5 minutes..."

$MaxWaitTime = 300  # 5 minutes
$WaitInterval = 10  # Check every 10 seconds
$ElapsedTime = 0

while ($ElapsedTime -lt $MaxWaitTime) {
    $InvalidationStatus = aws cloudfront get-invalidation `
        --distribution-id $CloudFrontDistributionId `
        --id $InvalidationId `
        --region $AwsRegion `
        --output json | ConvertFrom-Json

    $Status = $InvalidationStatus.Invalidation.Status
    
    if ($Status -eq "Completed") {
        Write-Success "CloudFront invalidation completed"
        break
    }
    
    Write-Info "Invalidation status: $Status (elapsed: $ElapsedTime seconds)"
    Start-Sleep -Seconds $WaitInterval
    $ElapsedTime += $WaitInterval
}

if ($ElapsedTime -ge $MaxWaitTime) {
    Write-Warning-Custom "CloudFront invalidation is still in progress (timeout reached)"
    Write-Info "Invalidation ID: $InvalidationId"
    Write-Info "You can check status with: aws cloudfront get-invalidation --distribution-id $CloudFrontDistributionId --id $InvalidationId"
}

# Step 11: Verify deployment
Write-Info "Step 11: Verifying deployment..."
$TestUrl = "https://keeptabs.app"
Write-Info "Testing URL: $TestUrl"

# Simple HTTP test
try {
    $Response = Invoke-WebRequest -Uri $TestUrl -UseBasicParsing -TimeoutSec 10
    if ($Response.StatusCode -eq 200) {
        Write-Success "Website is accessible at $TestUrl"
    } else {
        Write-Warning-Custom "Website returned status code: $($Response.StatusCode)"
    }
} catch {
    Write-Warning-Custom "Could not verify website accessibility: $_"
}

# Step 12: Summary
Write-Info "Step 12: Deployment Summary"
Write-Success "Deployment completed successfully!"
Write-Info ""
Write-Info "Deployment Details:"
Write-Info "  - S3 Bucket: $S3Bucket"
Write-Info "  - CloudFront Distribution: $CloudFrontDistributionId"
Write-Info "  - Invalidation ID: $InvalidationId"
Write-Info "  - Website URL: https://keeptabs.app"
Write-Info "  - Backup Location: $BackupDir"
Write-Info ""
Write-Info "Next Steps:"
Write-Info "  1. Visit https://keeptabs.app to verify the deployment"
Write-Info "  2. Check browser console for any errors"
Write-Info "  3. Test authentication flow"
Write-Info "  4. Test API endpoints"
Write-Info ""
Write-Info "Rollback (if needed):"
Write-Info "  1. Restore from backup: aws s3 sync $BackupDir s3://$S3Bucket --delete"
Write-Info "  2. Invalidate CloudFront: aws cloudfront create-invalidation --distribution-id $CloudFrontDistributionId --paths '/*'"
Write-Info ""
Write-Success "Deployment finished at $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
