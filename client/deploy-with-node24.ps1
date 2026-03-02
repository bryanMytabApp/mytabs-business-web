# Deploy Web Client with Node 24
# This script sets the correct Node version and deploys the web client

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deploy Web Client" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set Node 24 in PATH
Write-Host "Setting Node v24 in PATH..." -ForegroundColor Yellow
$env:PATH = "C:\Users\vsmik\AppData\Roaming\nvm\v24.12.0;C:\Users\vsmik\AppData\Roaming\nvm;" + ($env:PATH -replace "C:\\Program Files\\nodejs;", "")

# Verify Node version
Write-Host "Verifying Node version..." -ForegroundColor Cyan
node --version
npm --version
Write-Host ""

# Check if build directory exists
if (!(Test-Path "build")) {
    Write-Host "❌ Build directory not found!" -ForegroundColor Red
    Write-Host "Please run 'npm run build' first" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Build directory found" -ForegroundColor Green
Write-Host ""

# Deploy using Serverless
Write-Host "🚀 Deploying to AWS..." -ForegroundColor Cyan
serverless deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ Deployment Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The web client has been deployed to S3" -ForegroundColor Cyan
    Write-Host "CloudFront cache will be invalidated automatically" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Changes are now live at:" -ForegroundColor Yellow
    Write-Host "  https://www.keeptabs.app" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ Deployment Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please check the error messages above" -ForegroundColor Yellow
    exit 1
}
