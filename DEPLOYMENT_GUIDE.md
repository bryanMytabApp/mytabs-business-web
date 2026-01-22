# MyTabs Web Client Deployment Guide

## Overview

This guide covers deploying the MyTabs web client (`mytabs-client-web`) to keeptabs.app using AWS S3 and CloudFront.

## Prerequisites

- Node.js v24 (specified in `.nvmrc`)
- AWS CLI configured with appropriate credentials
- Access to AWS S3 bucket for keeptabs.app
- Access to CloudFront distribution for keeptabs.app
- Serverless Framework installed globally

## Deployment Steps

### 1. Prepare the Environment

```bash
# Navigate to the web client directory
cd mytabs-client-web/client

# Set Node.js version (Windows)
$env:PATH = "C:\Users\vsmik\AppData\Roaming\nvm\v24.12.0;C:\Users\vsmik\AppData\Roaming\nvm;" + ($env:PATH -replace "C:\\Program Files\\nodejs;", "")

# Verify Node.js version
node --version  # Should be v24.x.x
```

### 2. Install Dependencies

```bash
# Install npm dependencies
npm install
```

### 3. Build for Production

```bash
# Build the React application
npm run build

# This creates a `build/` directory with optimized production files
```

### 4. Deploy to AWS S3

#### Option A: Using Serverless Framework (Recommended)

```bash
# Deploy using serverless framework
npm run deploy

# This will:
# - Upload build files to S3 bucket
# - Update CloudFront distribution
# - Invalidate CloudFront cache
```

#### Option B: Using AWS CLI Directly

```bash
# Set AWS variables
$env:AWS_REGION = "us-east-1"
$env:S3_BUCKET = "keeptabs-app-web"  # Replace with actual bucket name

# Sync build directory to S3
aws s3 sync build/ s3://$env:S3_BUCKET --delete --region $env:AWS_REGION

# Invalidate CloudFront cache
aws cloudfront create-invalidation --distribution-id E3Q9MK1SBAIXD7 --paths "/*"
```

### 5. Verify Deployment

```bash
# Check if deployment was successful
# Visit https://keeptabs.app in your browser

# Verify in browser console:
# - No 404 errors for assets
# - No CORS errors
# - Application loads correctly
```

## Environment Configuration

### Production Environment Variables

Create or update `.env.production` in `mytabs-client-web/client/`:

```env
REACT_APP_API_URL=https://keeptabs.app/api
REACT_APP_AUTH_DOMAIN=your-cognito-domain.auth.us-east-1.amazoncognito.com
REACT_APP_CLIENT_ID=your-cognito-client-id
REACT_APP_REDIRECT_URI=https://keeptabs.app/callback
REACT_APP_LOGOUT_URI=https://keeptabs.app/login
```

### Build Configuration

The build process uses:
- **Build Tool**: Create React App
- **Output Directory**: `build/`
- **Target**: Production-optimized bundle
- **Source Maps**: Included for debugging

## Deployment Architecture

```
mytabs-client-web/client/
├── src/                    # React source code
├── public/                 # Static assets
├── build/                  # Production build (created by npm run build)
└── serverless.yml          # Serverless Framework config

                    ↓ npm run build

                    ↓ npm run deploy

S3 Bucket (keeptabs-app-web)
├── index.html
├── static/
│   ├── js/
│   ├── css/
│   └── media/
└── ...

                    ↓ CloudFront Distribution

https://keeptabs.app
```

## Rollback Procedure

If deployment causes issues:

### Option 1: Redeploy Previous Version

```bash
# Rebuild and redeploy
npm run build
npm run deploy
```

### Option 2: Restore from S3 Versioning

```bash
# List S3 object versions
aws s3api list-object-versions --bucket keeptabs-app-web

# Restore specific version
aws s3api get-object --bucket keeptabs-app-web --key index.html --version-id VERSION_ID index.html
```

### Option 3: Invalidate CloudFront Cache

```bash
# Force CloudFront to refresh from S3
aws cloudfront create-invalidation --distribution-id E3Q9MK1SBAIXD7 --paths "/*"
```

## Troubleshooting

### Issue: 404 Errors on Page Refresh

**Cause**: CloudFront/S3 not configured for SPA routing

**Solution**:
```bash
# Ensure index.html is set as error document
aws s3api put-bucket-website --bucket keeptabs-app-web --website-configuration '{
  "IndexDocument": {"Suffix": "index.html"},
  "ErrorDocument": {"Key": "index.html"}
}'
```

### Issue: Stale Content After Deployment

**Cause**: CloudFront cache not invalidated

**Solution**:
```bash
# Invalidate entire distribution
aws cloudfront create-invalidation --distribution-id E3Q9MK1SBAIXD7 --paths "/*"

# Wait for invalidation to complete (usually 1-5 minutes)
aws cloudfront list-invalidations --distribution-id E3Q9MK1SBAIXD7
```

### Issue: CORS Errors

**Cause**: API requests blocked by CORS policy

**Solution**: Verify API Gateway CORS configuration:
```bash
# Check API Gateway CORS settings
aws apigateway get-stage --rest-api-id 16psjhr9ni --stage-name prod
```

### Issue: Authentication Redirect Loop

**Cause**: Cognito redirect URI mismatch

**Solution**: Update Cognito app client settings:
1. Go to AWS Cognito console
2. Find the app client for keeptabs.app
3. Update "Allowed callback URLs" to include `https://keeptabs.app/callback`
4. Update "Allowed sign-out URLs" to include `https://keeptabs.app/login`

## Performance Optimization

### Enable Gzip Compression

```bash
# S3 doesn't compress by default, use CloudFront
# CloudFront automatically compresses:
# - text/html
# - text/css
# - application/javascript
# - application/json
```

### Cache Control Headers

```bash
# Set cache headers for static assets
aws s3 cp build/static s3://keeptabs-app-web/static --recursive --cache-control "max-age=31536000"

# Set short cache for index.html
aws s3 cp build/index.html s3://keeptabs-app-web/index.html --cache-control "max-age=3600"
```

## Monitoring

### CloudWatch Logs

```bash
# View CloudFront access logs
aws logs tail /aws/cloudfront/keeptabs-app-web --follow

# View S3 access logs
aws logs tail /aws/s3/keeptabs-app-web --follow
```

### CloudFront Metrics

```bash
# Get CloudFront distribution metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=E3Q9MK1SBAIXD7 \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-02T00:00:00Z \
  --period 3600 \
  --statistics Sum
```

## Security Considerations

### HTTPS Only

- CloudFront enforces HTTPS
- All traffic redirected from HTTP to HTTPS
- SSL/TLS certificate managed by AWS

### Content Security Policy

Add CSP headers in CloudFront:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

### CORS Configuration

Verify CORS headers from API Gateway:
```bash
# Test CORS headers
curl -i -X OPTIONS https://keeptabs.app/api/users \
  -H "Origin: https://keeptabs.app" \
  -H "Access-Control-Request-Method: GET"
```

## Deployment Checklist

- [ ] Node.js v24 installed and verified
- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables configured (`.env.production`)
- [ ] Build successful (`npm run build`)
- [ ] No build warnings or errors
- [ ] Tests passing (optional: `npm test`)
- [ ] Deployment executed (`npm run deploy`)
- [ ] CloudFront cache invalidated
- [ ] Website accessible at https://keeptabs.app
- [ ] No console errors in browser
- [ ] Authentication flow working
- [ ] API calls successful
- [ ] Performance acceptable (< 3s load time)

## Deployment Frequency

- **Development**: Deploy after each feature completion
- **Staging**: Deploy before QA testing
- **Production**: Deploy after QA approval

## Support

For deployment issues:
1. Check CloudFront distribution status
2. Verify S3 bucket permissions
3. Check CloudWatch logs for errors
4. Review API Gateway configuration
5. Verify Cognito settings

## Additional Resources

- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
- [Serverless Framework Guide](https://www.serverless.com/framework/docs)
- [Create React App Deployment](https://create-react-app.dev/deployment/)
