# Deploy MyTabs Web Client to AWS S3 and CloudFront
# This script syncs the build directory to S3 and invalidates CloudFront cache

$ErrorActionPreference = "Stop"

# Configuration
$S3_BUCKET = "mytabs-business-web-prod"
$CLOUDFRONT_DISTRIBUTION_ID = "E1WB9UQAAX3TCW"
$BUILD_DIR = "build"
$REGION = "us-east-1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MyTabs Web Client Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if build directory exists
if (-not (Test-Path $BUILD_DIR)) {
    Write-Host "ERROR: Build directory not found at $BUILD_DIR" -ForegroundColor Red
    Write-Host "Please run 'npm run build' first" -ForegroundColor Yellow
    exit 1
}

Write-Host "Step 1: Syncing files to S3 bucket: $S3_BUCKET" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray

# Sync build directory to S3 with proper content types
aws s3 sync $BUILD_DIR s3://$S3_BUCKET `
    --region $REGION `
    --delete `
    --cache-control "public, max-age=31536000" `
    --exclude "*.html" `
    --exclude "service-worker.js" `
    --exclude "manifest.json"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to sync static assets to S3" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Static assets synced successfully" -ForegroundColor Green
Write-Host ""

# Sync HTML files with no-cache to ensure updates are immediate
Write-Host "Step 2: Syncing HTML files (no-cache)" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray

aws s3 sync $BUILD_DIR s3://$S3_BUCKET `
    --region $REGION `
    --exclude "*" `
    --include "*.html" `
    --include "service-worker.js" `
    --include "manifest.json" `
    --cache-control "no-cache, no-store, must-revalidate" `
    --content-type "text/html"

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to sync HTML files to S3" -ForegroundColor Red
    exit 1
}

Write-Host "✓ HTML files synced successfully" -ForegroundColor Green
Write-Host ""

# Invalidate CloudFront cache
Write-Host "Step 3: Invalidating CloudFront cache" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host "Distribution ID: $CLOUDFRONT_DISTRIBUTION_ID" -ForegroundColor Gray

$invalidation = aws cloudfront create-invalidation `
    --distribution-id $CLOUDFRONT_DISTRIBUTION_ID `
    --paths "/*" `
    --output json

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to create CloudFront invalidation" -ForegroundColor Red
    exit 1
}

$invalidationId = ($invalidation | ConvertFrom-Json).Invalidation.Id
Write-Host "✓ CloudFront invalidation created: $invalidationId" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your changes are now live at:" -ForegroundColor White
Write-Host "  • https://www.keeptabs.app" -ForegroundColor Cyan
Write-Host "  • https://keeptabs.app" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: CloudFront cache invalidation may take 5-10 minutes to propagate globally." -ForegroundColor Yellow
Write-Host ""
