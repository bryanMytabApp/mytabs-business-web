# KeepTabs Business Portal - AWS Architecture

## Overview

The KeepTabs business portal (keeptabs.app) is a React-based web application for business account management, deployed on AWS using S3, CloudFront, and Cognito authentication.

## Production Architecture

### Primary Region: us-east-1

#### 1. API Gateway (Production)
- **API ID:** 16psjhr9ni
- **API Name:** mytabs-core-api-prod
- **Endpoint:** https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod
- **Region:** us-east-1
- **Purpose:** Main REST API for keeptabs.app
- **Key Endpoints:**
  - `/user/does-it-exists` - Check if user exists (email, username, phone)
  - `/user/*` - User management endpoints
  - `/business/*` - Business management endpoints
  - `/events/*` - Event management endpoints

#### 2. Lambda Functions (Production)
- **Function:** user-checkIfUserExists-prod
  - **Runtime:** nodejs16.x
  - **Handler:** checkIfUserExists/index.index
  - **Environment:** prod
  - **Purpose:** Validates if email/username/phone already exists
  - **CloudWatch Logs:** /aws/lambda/user-checkIfUserExists-prod

#### 3. DynamoDB Tables (us-east-1)
- **Users_prod**
  - **Purpose:** User account data
  - **Primary Key:** _id (String) - User UUID
  - **Indexes:**
    - email-index (GSI) - Query by email
    - username-index (GSI) - Query by username
    - phone-number-index (GSI) - Query by phone number
    - stripe-customer-id-index (GSI) - Query by Stripe customer ID
  - **Key Fields:**
    - _id: User UUID
    - email: User email (lowercase)
    - username: Unique username
    - phoneNumber: Phone with country code (+1)
    - firstName, lastName: User name
    - stripeCustomerId: Stripe customer reference
    - isAdmin: Admin flag
    - isActive: Account status
    - city, state, zipCode, address1: Location data
    - createdAt, updatedAt: Timestamps

- **Business_prod**
  - **Purpose:** Business account profiles
  - **Primary Key:** userId (String), _id (String)
  - **Key Fields:**
    - userId: References Users_prod._id
    - _id: Business UUID
    - name: Business name
    - email: Business contact email
    - stripeAccountId: Stripe Connect account ID
    - description, categories, type: Business details
    - city, state, zipCode, address1: Location
    - phoneNumber: Business phone
    - followersCount: Follower count

- **User_Premium_Subscriptions_prod**
  - **Purpose:** Premium subscription tracking
  - **Primary Key:** userId (String)

#### 4. Cognito User Pools (us-east-1)
- **mytabs-core-user-pool-prod** (us-east-1_MAXS6xo4n)
  - **Purpose:** Primary authentication for keeptabs.app business portal
  - **Used by:** Sign-up and authentication endpoints
  - **Region:** us-east-1
  - **User Storage:** Cognito stores authentication credentials
  - **Username Format:** UUID (e.g., 660aeabf-1ad0-490c-9e2b-5a930b752f2a)
  - **Attributes:** email, phone_number, preferred_username
  - **Verification:** Email and phone number auto-verified

- **Registration Flow:** 
  1. Frontend calls `/auth/sign-up` endpoint
  2. Lambda creates user in Cognito (mytabs-core-user-pool-prod)
  3. Lambda creates user record in DynamoDB Users_prod
  4. Lambda creates business record in DynamoDB Business_prod
  5. Lambda sends welcome email via SES
  6. Auto-login using Cognito credentials

- **Email Existence Check:**
  - Endpoint: `/user/does-it-exists?email={email}`
  - Checks: DynamoDB Users_prod table (email-index GSI)
  - Does NOT check Cognito directly

#### 5. S3 Bucket
- **Name:** mytabs-business-web-prod
- **Purpose:** Hosts the React application for keeptabs.app
- **Region:** us-east-1

#### 6. CloudFront Distribution
- **Purpose:** CDN for keeptabs.app
- **Aliases:** keeptabs.app, www.keeptabs.app

#### 7. Simple Email Service (SES)
- **Region:** us-east-1
- **Verified Identities:**
  - noreply@mytabs.app (verified sender)
  - tabsuserhelp@gmail.com (support email)
- **Purpose:** Transactional emails
- **Email Types:**
  - Welcome emails (new user registration)
  - RSVP confirmations
  - Ticket receipts
  - Contact support messages
  - Feedback notifications
- **Sending Account:** COGNITO_DEFAULT
- **Lambda Integration:** Uses nodemailer with SES transporter

### Secondary Region: us-east-2

#### API Gateway (Alternative/Mobile)
- **Root API:** https://cte36laj2i.execute-api.us-east-2.amazonaws.com/prod
- **WebSocket URL:** https://cte36laj2i.execute-api.us-east-2.amazonaws.com
- **Region:** us-east-2
- **Purpose:** Alternative API endpoint (possibly for mobile apps)

#### Cognito User Pools (us-east-2)
- **mytabs-core-v2-user-pool-prod** (us-east-2_M8q0qaBO2)
  - Purpose: Main web application user authentication
- **mytabs-core-v2-user-pool-mobile-app-prod** (us-east-2_QYS0eFj8c)
  - Purpose: Mobile application authentication
- **mytabs-mobile-users-prod** (us-east-2_Fgx6oLAh0)
  - Purpose: Legacy mobile user pool

#### DynamoDB Tables (us-east-2)
- **Users_{env}** - User accounts (dev, testing, uat, prod)
- **Business_{env}** - Business profiles
- **Events_{env}** - Event management
- **Tickets_{env}** - Ticket sales
- **Note:** These tables appear to be replicas or for different environments

## Related Applications

### Ticket Verification
- **URL:** ticket.keeptabs.app
- **Purpose:** Ticket scanning and verification
- **API:** https://ticket.keeptabs.app

### Ticket Acceptance
- **URL:** verify.keeptabs.app
- **Purpose:** Event check-in and validation

## Authentication Flow

1. **Registration (Sign-Up):**
   - User submits form at keeptabs.app/register
   - Frontend calls: `POST https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod/auth/sign-up`
   - Lambda: auth-signUp-prod
   - Process:
     a. Validate user data
     b. Create user in Cognito (mytabs-core-user-pool-prod, us-east-1_MAXS6xo4n)
     c. Cognito assigns UUID username (e.g., 660aeabf-1ad0-490c-9e2b-5a930b752f2a)
     d. Create user record in DynamoDB Users_prod (us-east-1)
     e. Create business record in DynamoDB Business_prod (us-east-1)
     f. Send welcome email via SES (noreply@mytabs.app)
     g. Auto-login user with Cognito credentials
   - Error: "UsernameExistsException" if email/phone already exists in Cognito
   - Note: Welcome email is non-blocking (registration succeeds even if email fails)

2. **Email Existence Check:**
   - Endpoint: `GET /user/does-it-exists?email={email}`
   - Lambda: user-checkIfUserExists-prod
   - Checks: DynamoDB Users_prod table using email-index GSI
   - Returns: `{"exists": true/false}`
   - Note: Does NOT check Cognito directly

3. **Login:**
   - User provides email/username and password
   - Lambda queries Cognito for authentication
   - Returns JWT tokens for session management

4. **Data Storage:**
   - Cognito: Authentication credentials, email, phone, username
   - DynamoDB Users_prod: User profile data, preferences, settings
   - DynamoDB Business_prod: Business account details

## Data Flow

```
keeptabs.app (CloudFront)
    ↓
S3: mytabs-business-web-prod
    ↓
API Gateway: 16psjhr9ni (us-east-1)
    ↓
Lambda: user-checkIfUserExists-prod
    ↓
DynamoDB: Users_prod (us-east-1)
    ↓
Response: { exists: true/false }
```

## Key Findings

1. **Primary Region:** us-east-1 (not us-east-2)
2. **Production API:** 16psjhr9ni.execute-api.us-east-1.amazonaws.com
3. **Production Database:** DynamoDB tables in us-east-1
4. **User Validation:** Direct DynamoDB queries (not Cognito-based for existence checks)
5. **Dual Region Setup:** us-east-1 (primary) and us-east-2 (secondary/mobile)

## Deployment

- **Build:** npm run build
- **Deploy:** deploy-to-keeptabs.ps1
- **Target:** S3 bucket mytabs-business-web-prod
- **CDN:** CloudFront distribution for keeptabs.app

## Account Deletion Process

### Complete Account Deletion

To delete a user account and all associated data:

**Script:** `mytabs-backend/scripts/execute-delete-{email}.ps1`

**What Gets Deleted:**

1. **Cognito User Pool (us-east-1)**
   - Pool: mytabs-core-user-pool-prod (us-east-1_MAXS6xo4n)
   - User record with UUID username
   - Authentication credentials

2. **DynamoDB Users_prod (us-east-1)**
   - User profile record
   - Key: _id (user UUID)

3. **DynamoDB Business_prod (us-east-1)**
   - All business accounts owned by user
   - Key: userId + _id (business UUID)

4. **DynamoDB FollowingBusiness_prod (us-east-1)**
   - User's following relationships
   - Followers of user's businesses

5. **DynamoDB Events_prod (us-east-1)**
   - Events created by user's businesses

6. **DynamoDB PlanToAssistEvents_prod (us-east-1)**
   - User's event attendance plans

7. **DynamoDB User_Premium_Subscriptions_prod (us-east-1)**
   - Premium subscription records

8. **DynamoDB Notifications_prod (us-east-1)**
   - User notifications

**Important Notes:**
- Must delete from BOTH Cognito AND DynamoDB
- Cognito deletion prevents "UsernameExistsException" on re-registration
- DynamoDB deletion prevents "exists: true" from API checks
- Deletion is permanent and cannot be undone

**Search Scripts:**
- `search-us-east-1-dynamodb.ps1` - Find user in DynamoDB
- `find-michaeltabs3-cognito.ps1` - Find and delete from Cognito
- `test-api-endpoint.ps1` - Verify deletion via API

## Troubleshooting

### "Email already exists" Error

**Symptom:** Registration fails with "An account with the same phone or email already exists."

**Root Cause:** User exists in Cognito (mytabs-core-user-pool-prod) but may not exist in DynamoDB

**Solution:**
1. Check Cognito: `./find-michaeltabs3-cognito.ps1`
2. Check DynamoDB: `./search-us-east-1-dynamodb.ps1`
3. Delete from both if found
4. Verify deletion: Test API endpoint returns `{"exists": false}`

**Why Both Checks Are Needed:**
- Sign-up checks Cognito first (throws UsernameExistsException)
- Email existence API checks DynamoDB only
- Must delete from BOTH to allow re-registration

### Finding User Accounts

```powershell
# Search by email in DynamoDB (us-east-1)
./search-us-east-1-dynamodb.ps1

# Search and delete from Cognito (all regions)
./find-michaeltabs3-cognito.ps1

# Test API endpoint
./test-api-endpoint.ps1

# Verify email doesn't exist
Invoke-RestMethod -Uri "https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod/user/does-it-exists?email=test%40example.com"
```

### Common Issues

1. **User in Cognito but not DynamoDB**
   - Registration started but failed after Cognito creation
   - Solution: Delete from Cognito

2. **User in DynamoDB but not Cognito**
   - Manual deletion or Cognito cleanup
   - Solution: Delete from DynamoDB

3. **Different User IDs**
   - Cognito uses UUID username (e.g., 660aeabf-1ad0-490c-9e2b-5a930b752f2a)
   - DynamoDB uses same UUID in _id field
   - Must match for proper account linking

---

**Last Updated:** March 4, 2026
**Architecture Version:** 3.0 (Updated with complete Cognito integration details)
**Key Discovery:** Registration uses Cognito (us-east-1_MAXS6xo4n) + DynamoDB (us-east-1)
