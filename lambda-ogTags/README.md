# Open Graph Lambda@Edge for keeptabs.app

Injects Open Graph / Twitter Card meta tags into `keeptabs.app/e/*` and
`keeptabs.app/o/*` HTML **for social crawlers only**, so shared event links
render a rich preview card (image + title + description) on Facebook, iMessage,
Slack, Twitter/X, WhatsApp, LinkedIn, etc.

## The problem it solves

`keeptabs.app/e/<code>` is a create-react-app SPA. The origin serves a static
HTML shell whose only `<meta name="description">` says *"Web site created using
create-react-app"*. Social crawlers don't run JavaScript, so a shared event link
showed a bare URL with no image or details. (The `JumpPage` that resolves the
event and deep-links into the app runs client-side, which crawlers never see.)

## How it works

- Runs on CloudFront **viewer-request** for the `/e/*` and `/o/*` behaviors.
  (origin-response does NOT work here — these paths are served via CloudFront
  Custom Error Responses, and origin-response Lambda@Edge never fires on a
  custom-error-page response.)
- If the request User-Agent is a known crawler:
  1. resolve the code → `GET /api/resolve/{e|o}/<code>` (public),
  2. read event details → `GET /events/<eventId>` (public),
  3. **return** a small generated HTML document with `og:*` + `twitter:*` tags
     (title, description, and the event image at
     `https://mytabs-core-prod.s3.amazonaws.com/events/<eventId>`), plus a
     redirect so a human who opens it lands on the real page.
- Everything else — humans, unresolved codes, any error — returns the request
  **unchanged**, so the normal SPA / JumpPage / deep-link flow is untouched.

All data used is public (the same endpoints the web/mobile clients call
unauthenticated). No secrets, no env vars (Lambda@Edge forbids them).

## Test

```bash
cd lambda-ogTags
npm install
npm test
```

## Deploy

Two decoupled steps so the code deploy and the CloudFront change are reviewed
separately.

```bash
# 1. Create/update the function in us-east-1 and publish a numbered version.
./deploy.sh                     # prints the versioned ARN + the associate command

# 2. Make it live on CloudFront distribution E1WB9UQAAX3TCW (viewer-request
#    on /e/* and /o/*). CloudFront takes ~5-15 min to redeploy.
./associate-cloudfront.sh <version>

# Roll back: remove the /e/* and /o/* behaviors (returns them to the default).
./deploy.sh --rollback
```

### Verify after the association deploys

```bash
# Crawler sees rich tags:
curl -A 'facebookexternalhit/1.1' https://keeptabs.app/e/<code> | grep -o 'og:[a-z]*'

# Human still gets the untouched SPA shell (no og: tags):
curl -A 'Mozilla/5.0 (iPhone)' https://keeptabs.app/e/<code> | grep -c og: || echo 0
```

Then paste the URL into the
[Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and
click **Scrape Again** to refresh Facebook's cache.

## Notes / limits

- Lambda@Edge must live in **us-east-1** and be associated by **numbered
  version** (never `$LATEST`).
- `/o/*` (org) currently degrades to no injection (resolver returns no event);
  extend `fetchEventDataLive` when org cards are wanted.
- The `/e/*` and `/o/*` cache behaviors must already exist on the distribution
  (per `CLOUDFRONT_CONFIG.md`). If a behavior is missing, `--associate` warns
  and skips it.
