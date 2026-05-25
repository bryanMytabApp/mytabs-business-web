# MyTabs AWS Infrastructure - Current Physical Setup

## Overview

This document describes the current physical AWS infrastructure deployed for keeptabs.app and related services.

## AWS Account Details

- **Account ID**: 992382405895
- **Primary Region**: us-east-1
- **Secondary Region**: us-east-2 (legacy, being phased out)

## Domain Structure

```
keeptabs.app                    → Main web application (mytabs-client-web)
├── ticket.keeptabs.app        → Ticketing system (mytabs-ticket-web)
├── api.keeptabs.app           → API endpoints (Lambda/API Gateway)
└── admin.keeptabs.app         → Admin portal
```

## S3 Buckets

### 1. Main Web Application Bucket
- **Bucket Name**: `keeptabs-app-web` (or similar)
- **Region**: us-east-1
- **Purpose**: Hosts mytabs-client-web (React build)
- **Contents**:
  - `index.html` - SPA entry point
  - `static/js/` - JavaScript bundles
  - `static/css/` - Stylesheets
  - `static/media/` - Images and assets
- **Versioning**: Enabled
- **Public Access**: Blocked (accessed via CloudFront only)
- **Website Configuration**: 
  - Index Document: `index.html`
  - Error Document: `index.html` (for SPA routing)

### 2. Ticketing Website Bucket
- **Bucket Name**: `mytabs-ticketing-website`
- **Region**: us-east-1
- **Purpose**: Hosts mytabs-ticket-web (React build)
- **Contents**: Similar structure to main web app
- **Public Access**: Blocked (accessed via CloudFront only)

### 3. Other Buckets
- **Deployment Artifacts**: Various buckets for Lambda deployment packages
- **Backups**: S3 buckets for database backups
- **Logs**: CloudFront and API Gateway access logs

## CloudFront Distributions

### 1. Main Web Application Distribution
- **Distribution ID**: (To be confirmed - check AWS Console)
- **Domain**: keeptabs.app
- **Origin**: S3 bucket `keeptabs-app-web`
- **SSL Certificate**: AWS Certificate Manager (*.keeptabs.app)
- **Cache Behaviors**:
  - `/api/*` → API Gateway (no cache)
  - `/static/*` → S3 (cache: 1 year)
  - `/` → S3 (cache: 1 hour)
  - Default → S3 index.html (cache: 1 hour)
- **Compression**: Enabled (gzip)
- **HTTP/2**: Enabled
- **IPv6**: Enabled
- **Logging**: CloudFront access logs to S3

### 2. Ticketing Distribution
- **Distribution ID**: E3Q9MK1SBAIXD7
- **Domain**: ticket.keeptabs.app
- **Origin**: S3 bucket `mytabs-ticketing-website`
- **Cache Behaviors**:
  - `/payments/*` → API Gateway `16psjhr9ni` (no cache)
  - `/events/*` → API Gateway `16psjhr9ni` (no cache)
  - `/api/*` → API Gateway `16psjhr9ni` (no cache)
  - Default → S3 (cache: 1 hour)
- **Status**: ✅ Deployed and working

## API Gateway

### Primary API Gateway
- **API Gateway ID**: `16psjhr9ni`
- **Name**: `mytabs-core-api-prod`
- **Region**: us-east-1
- **Domain**: `16psjhr9ni.execute-api.us-east-1.amazonaws.com`
- **Stage**: `prod`
- **Endpoints**:

#### Payment Endpoints
- **Path**: `/payments/calculate-tax`
  - **Method**: POST
  - **Lambda**: `payments-calculateTax-prod`
  - **Authentication**: None
  - **Status**: ✅ Working

- **Path**: `/payments/createPaymentIntent`
  - **Method**: POST
  - **Lambda**: `payments-createPaymentIntent-prod`
  - **Authentication**: None
  - **Status**: ✅ Working

#### Event Endpoints
- **Path**: `/events/*`
  - **Lambda**: Various event management functions
  - **Authentication**: Cognito User Pool (optional)

#### User Endpoints
- **Path**: `/users/*`
  - **Lambda**: User management functions
  - **Authentication**: Cognito User Pool

### Legacy API Gateway (us-east-2)
- **Status**: ⚠️ Being phased out
- **Note**: All endpoints migrated to us-east-1

## Lambda Functions

### Payment Processing
- **Function**: `payments-calculateTax-prod`
  - **Region**: us-east-1
  - **Runtime**: Node.js 16.x
  - **Memory**: 256 MB
  - **Timeout**: 30 seconds
  - **Environment Variables**: Stripe API key, tax configuration
  - **Status**: ✅ Active

- **Function**: `payments-createPaymentIntent-prod`
  - **Region**: us-east-1
  - **Runtime**: Node.js 16.x
  - **Memory**: 256 MB
  - **Timeout**: 30 seconds
  - **Environment Variables**: Stripe API key, webhook secrets
  - **Status**: ✅ Active

### Event Management
- **Functions**: Various event CRUD operations
- **Region**: us-east-1
- **Runtime**: Node.js 16.x
- **Database**: DynamoDB

### User Management
- **Functions**: User profile, authentication, authorization
- **Region**: us-east-1
- **Runtime**: Node.js 16.x
- **Database**: DynamoDB

## DynamoDB Tables

### Core Tables
- **Users**: User profiles and authentication data
- **Events**: Event information and metadata
- **Businesses**: Business profiles and settings
- **Tickets**: Ticket inventory and sales
- **Orders**: Payment orders and transactions
- **Attendees**: Event attendance records

### Configuration
- **Billing Mode**: Pay-per-request (auto-scaling)
- **Region**: us-east-1
- **Backup**: Enabled (point-in-time recovery)
- **Encryption**: At-rest encryption enabled
- **TTL**: Configured for session data cleanup

## Cognito

### User Pool
- **Pool ID**: `us-east-1_MAXS6xo4n`
- **Region**: us-east-1
- **Name**: `mytabs-core-user-pool-prod`
- **Users**: Active user base
- **Test User**: `urbanhtx`
- **MFA**: Optional
- **Password Policy**: Strong (uppercase, lowercase, numbers, symbols)

### User Pool Client
- **Client ID**: (Check AWS Console)
- **Client Name**: `keeptabs-web-client`
- **Allowed Callback URLs**:
  - `https://keeptabs.app/callback`
  - `https://keeptabs.app/login`
  - `https://ticket.keeptabs.app/callback`
- **Allowed Sign-out URLs**:
  - `https://keeptabs.app/login`
  - `https://ticket.keeptabs.app/login`
- **Allowed OAuth Flows**: Authorization code flow
- **Allowed OAuth Scopes**: openid, profile, email

### Identity Pool
- **Pool ID**: (Check AWS Console)
- **Purpose**: Temporary AWS credentials for mobile/web clients
- **Providers**: Cognito User Pool

## Route 53 DNS

### DNS Records
- **keeptabs.app**: A record → CloudFront distribution
- **ticket.keeptabs.app**: A record → CloudFront distribution (E3Q9MK1SBAIXD7)
- **api.keeptabs.app**: A record → API Gateway (16psjhr9ni)
- **admin.keeptabs.app**: A record → CloudFront distribution (if separate)

### Health Checks
- CloudFront distributions monitored
- API Gateway endpoints monitored
- Failover configured (if applicable)

## SSL/TLS Certificates

### AWS Certificate Manager
- **Certificate**: `*.keeptabs.app`
- **Status**: ✅ Valid
- **Renewal**: Auto-renewal enabled
- **Validation**: DNS validation
- **Domains Covered**:
  - keeptabs.app
  - *.keeptabs.app (all subdomains)

## IAM Roles and Policies

### Lambda Execution Role
- **Role Name**: `lambda-execution-role-prod`
- **Permissions**:
  - DynamoDB read/write
  - S3 access (for uploads)
  - CloudWatch Logs
  - Secrets Manager (for API keys)
  - SES (for email)

### CloudFront Origin Access Identity
- **Purpose**: Secure S3 bucket access
- **Permissions**: S3 GetObject on specific buckets

### API Gateway Execution Role
- **Permissions**: CloudWatch Logs, Lambda invocation

## Secrets Manager

### Stored Secrets
- **Stripe API Keys**: Test and production keys
- **Database Credentials**: DynamoDB access
- **OAuth Secrets**: Cognito client secrets
- **Email Credentials**: SES SMTP credentials
- **JWT Signing Keys**: Token generation keys

## CloudWatch

### Log Groups
- `/aws/lambda/payments-calculateTax-prod`
- `/aws/lambda/payments-createPaymentIntent-prod`
- `/aws/lambda/events-*`
- `/aws/lambda/users-*`
- `/aws/apigateway/16psjhr9ni`
- `/aws/cloudfront/keeptabs-app`

### Metrics
- Lambda invocations and errors
- API Gateway requests and latency
- DynamoDB read/write capacity
- CloudFront requests and cache hit ratio

### Alarms
- Lambda error rate > 1%
- API Gateway 5xx errors > 10
- DynamoDB throttling
- CloudFront origin errors

## SES (Simple Email Service)

### Configuration
- **Region**: us-east-1
- **Verified Identities**: noreply@keeptabs.app, support@keeptabs.app
- **Sending Limit**: Depends on account status
- **DKIM**: Enabled
- **SPF**: Configured

### Use Cases
- Order confirmations
- Password reset emails
- Event notifications
- Support communications

## Stripe Integration

### Test Environment
- **API Key**: Configured in Lambda environment variables
- **Publishable Key**: Configured in environment
- **Webhooks**: Configured for payment events
- **Tax Calculation**: Enabled with Stripe Tax API

### Production Environment
- **Status**: Ready for activation
- **Keys**: Stored in Secrets Manager
- **Webhooks**: Configured

## Monitoring and Logging

### CloudWatch Dashboard
- Real-time metrics for all services
- Lambda performance
- API Gateway latency
- DynamoDB capacity
- CloudFront cache performance

### X-Ray Tracing
- Enabled for Lambda functions
- API Gateway request tracing
- Service map visualization

## Backup and Disaster Recovery

### DynamoDB Backups
- **Point-in-Time Recovery**: Enabled (35 days)
- **On-Demand Backups**: Manual backups available
- **Cross-Region Replication**: Not currently enabled

### S3 Versioning
- Enabled on all buckets
- Allows rollback to previous versions

### Database Snapshots
- Regular automated snapshots
- Stored in S3

## Security

### VPC Configuration
- Lambda functions run in VPC (if database access needed)
- Security groups configured for database access
- NAT Gateway for outbound internet access

### Encryption
- **At-Rest**: S3 SSE-S3, DynamoDB encryption
- **In-Transit**: HTTPS/TLS for all communications
- **Secrets**: Encrypted in Secrets Manager

### Access Control
- IAM roles with least privilege
- Resource-based policies on S3 buckets
- API Gateway authorization (Cognito)

## Cost Optimization

### Current Services
- **S3**: Pay-per-request (minimal storage)
- **CloudFront**: Pay-per-request (data transfer)
- **Lambda**: Pay-per-invocation (low volume)
- **DynamoDB**: Pay-per-request (auto-scaling)
- **Cognito**: Free tier (< 50k MAU)
- **API Gateway**: Pay-per-request

### Estimated Monthly Cost
- S3: $1-5
- CloudFront: $10-50
- Lambda: $5-20
- DynamoDB: $10-30
- Cognito: Free
- API Gateway: $5-15
- **Total**: ~$30-120/month

## Deployment Pipeline

### Current Process
1. Code committed to repository
2. CodeBuild triggered (if configured)
3. Build artifacts created
4. Deploy to S3 bucket
5. CloudFront cache invalidated
6. DNS resolves to new content

### CI/CD Tools
- AWS CodePipeline (if configured)
- GitHub Actions (if configured)
- Manual deployment scripts

## Next Steps / Improvements

- [ ] Enable cross-region replication for DynamoDB
- [ ] Configure CloudFront origin failover
- [ ] Implement WAF (Web Application Firewall)
- [ ] Enable VPC Flow Logs
- [ ] Set up automated security scanning
- [ ] Implement rate limiting on API Gateway
- [ ] Configure auto-scaling policies
- [ ] Set up cost anomaly detection

## References

- AWS Console: https://console.aws.amazon.com
- CloudFront Distribution: E3Q9MK1SBAIXD7
- API Gateway: 16psjhr9ni
- Cognito User Pool: us-east-1_MAXS6xo4n
- Primary Region: us-east-1
