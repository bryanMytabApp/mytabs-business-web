# Admin Portal Guide

## Overview
The Admin Portal provides a centralized interface for managing all business accounts and their subscription status.

## Features

### Business Management
- View all registered businesses
- Search businesses by name, city, or user ID
- Filter businesses by status (Active/Inactive)
- Toggle business subscription status

### Subscription Control
- Activate/deactivate business accounts
- View subscription status for each business
- Automatic status updates reflected in mobile app

## Access

The Admin Portal is accessible from the web dashboard:
1. Log in to the web client
2. Navigate to "Admin Portal" in the sidebar menu
3. The portal will load all businesses and their subscription status

## Usage

### Viewing Businesses
- All businesses are displayed in a table format
- Each row shows: Business Name, Location, User ID, Status, and Actions
- Use the search bar to find specific businesses
- Use filter buttons to show All, Active, or Inactive businesses

### Managing Subscriptions
- Click "Activate" to enable a business account (shows in mobile app)
- Click "Deactivate" to disable a business account (hides from mobile app)
- Changes take effect immediately
- A confirmation message appears after each action

### Refresh Data
- Click the "🔄 Refresh" button to reload all business data
- Useful after making changes or to see updates from other admins

## Backend Requirements

The Admin Portal requires the following backend endpoints:

1. **GET /business/all** - Fetch all businesses
2. **GET /subscription/{userId}** - Get subscription status
3. **POST /subscription/update** - Update subscription status

## Deployment

### Backend Service
Deploy the subscription service:
```bash
cd mytabs-backend/serverless/services/subscription
serverless deploy --stage dev
```

### Web Client
The Admin Portal is already integrated into the web client. Just deploy as usual:
```bash
cd mytabs-client-web/client
npm run build
# Deploy to your hosting service
```

## Technical Details

### API Integration
- Uses config.json for environment-specific API URLs
- Automatically switches between dev/prod environments
- Handles errors gracefully with fallback to default active status

### Data Flow
1. Portal fetches all businesses from backend
2. For each business, fetches subscription status
3. Displays combined data in table
4. On status toggle, updates subscription in database
5. Mobile app queries subscription status when loading businesses

### Security
- Requires authentication to access
- Only accessible from web dashboard (not mobile app)
- Uses existing Cognito authentication

## Troubleshooting

### Businesses not showing
- Check that backend subscription service is deployed
- Verify API URLs in config.json
- Check browser console for errors

### Status changes not reflecting
- Click refresh button to reload data
- Check that subscription endpoints are working
- Verify database permissions

### Mobile app not showing changes
- Businesses default to active if no subscription exists
- Ensure mobile app is using latest backend
- Check that getAllBusiness endpoint filters correctly
