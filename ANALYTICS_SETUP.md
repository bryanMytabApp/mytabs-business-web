# Analytics Setup Guide

## Overview
The Analytics page provides business owners with insights into their performance, including:
- Total followers count
- Total events created
- Total PTA (Planning to Attend) across all events
- Active upcoming events
- Detailed event breakdown with individual PTA counts

## Backend Setup

### 1. Deploy Business Analytics Endpoint

Navigate to the business service and deploy:

```bash
cd mytabs-backend/serverless/services/business
serverless deploy --stage dev
```

This deploys the new endpoint:
- `GET /business/{userId}/analytics` - Returns followers count and follower details

### 2. Deploy Event PTA Endpoint

Navigate to the events service and deploy:

```bash
cd mytabs-backend/serverless/services/events
serverless deploy --stage dev
```

This deploys the new endpoint:
- `GET /event/{eventId}/pta` - Returns PTA count and attendee details for a specific event

## Frontend Setup

The Analytics view has been updated with:

### New Files Created
1. `client/src/services/analyticsService.js` - Service layer for analytics API calls
2. `client/src/views/Analytics/AnalyticsView.css` - Styling for the analytics dashboard
3. `client/src/views/Analytics/AnalyticsView.jsx` - Updated analytics component

### Features Implemented

#### Analytics Cards
- **Total Followers**: Shows how many users are following the business
- **Total Events**: Count of all events created by the business
- **Total PTA**: Sum of all users planning to attend across all events
- **Active Events**: Count of upcoming events (future dates)

#### Events Breakdown Table
- Lists all events with:
  - Event name
  - Event date
  - Status (Active/Past)
  - Individual PTA count per event

#### UI Features
- Gradient icon backgrounds for visual appeal
- Hover effects on cards
- Loading states with spinner
- Error handling with user-friendly messages
- Empty state when no events exist
- Refresh button to reload data

## API Endpoints Used

### Business Analytics
```
GET /business/{userId}/analytics
Authorization: Cognito User Pool

Response:
{
  "followersCount": 42,
  "followers": [
    {
      "businessId": "...",
      "followerUserId": "...",
      "businessCreatorUserId": "...",
      "token": "..."
    }
  ]
}
```

### Event PTA
```
GET /event/{eventId}/pta
Authorization: Cognito User Pool

Response:
{
  "count": 15,
  "attendees": [
    {
      "event_id": "...",
      "attendantUserId": "...",
      "date": "...",
      "name": "...",
      "data": {...}
    }
  ]
}
```

### Events by User
```
GET /event/{userId}/all

Response: [
  {
    "_id": "...",
    "name": "Event Name",
    "date": "2024-12-25",
    ...
  }
]
```

## Testing

### 1. Test Backend Endpoints

Test the analytics endpoint:
```bash
curl -X GET \
  https://your-api-url.com/dev/business/{userId}/analytics \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Test the PTA endpoint:
```bash
curl -X GET \
  https://your-api-url.com/dev/event/{eventId}/pta \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Test Frontend

1. Log in to the web dashboard
2. Navigate to "Analytics" in the sidebar
3. Verify the following:
   - Analytics cards display correct counts
   - Events table shows all events
   - PTA counts are accurate
   - Refresh button reloads data
   - Loading states appear during data fetch
   - Error messages display if API fails

## Troubleshooting

### Followers Count Shows 0
- Verify the business analytics endpoint is deployed
- Check that users have followed the business
- Verify the `FollowingBusiness` DynamoDB table has data
- Check browser console for API errors

### PTA Counts Show 0
- Verify the event PTA endpoint is deployed
- Check that users have marked events as "Planning to Attend"
- Verify the `PlanToAssistEvents` DynamoDB table has data
- Check browser console for API errors

### Events Not Loading
- Verify the events endpoint is working
- Check that the business has created events
- Verify the `Events` DynamoDB table has data
- Check authentication token is valid

### API Errors
- Check that all endpoints are deployed to the correct stage
- Verify API Gateway URLs in `config.json`
- Check Cognito authentication is working
- Review CloudWatch logs for Lambda errors

## Database Tables Used

### FollowingBusiness
- Stores business follower relationships
- Key: `businessId` (partition), `followerUserId` (sort)
- Attributes: `businessCreatorUserId`, `token`

### PlanToAssistEvents
- Stores event attendance plans
- Key: `event_id` (partition), `attendantUserId` (sort)
- Attributes: `date`, `name`, `data`, `token`

### Events
- Stores event details
- Key: `userId` (partition), `_id` (sort)
- Attributes: `name`, `date`, and other event details

## Future Enhancements

Potential additions to the analytics dashboard:
- Event engagement rate (PTA / followers ratio)
- Follower growth over time (chart)
- Most popular events
- Event category breakdown
- Geographic distribution of followers
- Time-based analytics (weekly/monthly trends)
- Export analytics to CSV/PDF
- Comparison with previous periods
- Real-time updates with WebSocket

## Notes

- The analytics page requires authentication
- Data is fetched on page load and when refresh is clicked
- PTA counts are fetched individually for each event (may be slow with many events)
- Consider implementing caching for better performance with large datasets
- The backend endpoints use Cognito authorization for security
