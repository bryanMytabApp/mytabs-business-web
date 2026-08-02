# AI Agent — Local Development Setup

This guide explains how to run the web client locally against the AI Agent API endpoints on the dev stage.

## Prerequisites

- Node.js 20.x (see `.nvmrc`)
- Valid Cognito user credentials (Business account with AI Agent subscription)
- API Gateway dev stage deployed (`16psjhr9ni` / `us-east-1`)

## Environment Configuration

A `.env.development.template` file is provided as a reference. Copy it and fill in your Cognito Client ID:

```bash
cp .env.development.template .env.development
# Edit .env.development and replace <your-cognito-app-client-id> with your app client ID
```

The `.env.development` file is automatically loaded by Create React App when you run `npm start`. It contains:

| Variable | Value | Purpose |
|----------|-------|---------|
| `REACT_APP_API_URL` | `https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/dev/` | Dev stage API base URL |
| `REACT_APP_COGNITO_USER_POOL_ID` | `us-east-1_MAXS6xo4n` | Cognito User Pool for auth |
| `REACT_APP_COGNITO_CLIENT_ID` | `6e2i01snasqfdamrne144ua0df` | Cognito App Client ID |
| `REACT_APP_REGION` | `us-east-1` | AWS region |

> **Note:** The production `config.json` uses the `/prod/` stage. The `.env.development` overrides this to point at `/dev/` during local development so you can test against dev-deployed Lambdas without affecting production data.

## Quick Start

```bash
cd mytabs-client-web/client
npm install --legacy-peer-deps
npm start
```

The app starts at `http://localhost:3000`. CRA's dev server is already an allowed CORS origin for the AI Agent API.

## API Base URL Pattern

All AI Agent endpoints share a common base:

```
https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/dev/
```

### Available AI Agent Endpoints

| Method | Path | Lambda | Description |
|--------|------|--------|-------------|
| POST | `/ai-agents` | aiAgentManagement | Create agent |
| GET | `/ai-agents` | aiAgentManagement | List agents |
| PUT | `/ai-agents` | aiAgentManagement | Update agent |
| DELETE | `/ai-agents` | aiAgentManagement | Delete agent |
| POST | `/ai-agents/{agentId}/sources` | aiAgentManagement | Add sources |
| GET | `/ai-agents/{agentId}/sources` | aiAgentManagement | List sources |
| DELETE | `/ai-agents/{agentId}/sources` | aiAgentManagement | Remove source |
| POST | `/ai-agents/{agentId}/sources/{sourceId}/approve` | aiAgentManagement | Approve source |
| GET | `/ai-agents/dashboard` | aiAgentDashboard | Dashboard metrics |
| GET | `/ai-agents/{agentId}/crawl-history` | aiAgentDashboard | Crawl history |
| GET | `/ai-agents/drafts` | aiAgentDrafts | List drafts |
| GET | `/ai-agents/drafts/{draftId}` | aiAgentDrafts | Get draft |
| PUT | `/ai-agents/drafts/{draftId}` | aiAgentDrafts | Update draft |
| POST | `/ai-agents/drafts/{draftId}/approve` | aiAgentDrafts | Approve draft |
| POST | `/ai-agents/drafts/{draftId}/reject` | aiAgentDrafts | Reject draft |
| GET | `/ai-agents/drafts/{draftId}/provenance` | aiAgentDrafts | Get provenance |
| GET | `/ai-agents/cost-summary` | aiAgentDashboard | Cost summary |
| GET | `/ai-agents/notifications/preferences` | aiAgentManagement | Get notification prefs |
| PUT | `/ai-agents/notifications/preferences` | aiAgentManagement | Update notification prefs |

### Admin Endpoints (IAM Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/ai-agents/cost-dashboard` | Platform cost dashboard |
| PUT | `/admin/ai-agents/tier-pricing` | Update tier pricing |
| PUT | `/admin/ai-agents/hard-ceiling/{accountId}` | Set hard ceiling |
| PUT | `/admin/ai-agents/circuit-breaker-threshold` | Set circuit breaker |
| GET | `/admin/ai-agents/accounts` | List all accounts |
| GET | `/admin/ai-agents/accounts/{accountId}` | Get account details |

## CORS Configuration

The API Gateway is configured to allow requests from local development servers:

- `http://localhost:3000` (CRA default)
- `http://localhost:8081` (alternate dev port)
- `https://*.mytabs.app` (production)

Allowed headers: `Authorization`, `Content-Type`, `X-Amz-Date`, `X-Api-Key`, `X-Amz-Security-Token`

Allowed methods: `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

## Using the API from Services

The existing `http` axios instance in `src/utils/axios/http.js` reads its base URL from `src/config.json`. For AI Agent endpoints during local development, you can either:

**Option A — Use `REACT_APP_API_URL` directly (recommended for AI Agent services):**

```js
import axios from 'axios';

const AI_AGENT_API = process.env.REACT_APP_API_URL || 'https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod/';

const aiAgentHttp = axios.create({
  baseURL: AI_AGENT_API,
  withCredentials: false,
});

// Add auth interceptor (same pattern as http.js)
aiAgentHttp.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('idToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default aiAgentHttp;
```

**Option B — Use the shared `http` instance (same base URL for all endpoints):**

Since the AI Agent routes are on the same API Gateway as the existing backend (`16psjhr9ni`), the shared `http` instance already points to the correct host. Just call the path directly:

```js
import http from '../utils/axios/http';

// Works because /ai-agents is on the same API Gateway
export const getAgents = () => http.get('ai-agents');
export const getDashboard = () => http.get('ai-agents/dashboard');
```

## Verifying CORS

To confirm endpoints respond with proper CORS headers from your local dev server:

```bash
curl -i -X OPTIONS \
  https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/dev/ai-agents \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization,Content-Type"
```

Expected response headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,PUT,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 401 Unauthorized | Log in again — your Cognito token may have expired |
| CORS error in browser | Ensure you're on `localhost:3000`; check OPTIONS preflight succeeds |
| 403 Forbidden | Verify your account has a Business subscription with AI Agent entitlement |
| Network error | Confirm the dev stage is deployed: `aws apigateway get-stage --rest-api-id 16psjhr9ni --stage-name dev` |
| Env vars not loading | Restart `npm start` after editing `.env.development` (CRA caches env at startup) |

## Stages

| Stage | Base URL | Purpose |
|-------|----------|---------|
| dev | `https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/dev/` | Local development & testing |
| prod | `https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod/` | Production |
