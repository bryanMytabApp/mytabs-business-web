/**
 * Lambda@Edge (VIEWER-REQUEST) — Open Graph responses for keeptabs.app.
 *
 * WHY THIS EXISTS
 * ───────────────
 * keeptabs.app/e/<code> (and /o/<code>) is a create-react-app SPA served via
 * CloudFront Custom Error Responses (S3 returns 404 for the non-existent key,
 * CloudFront rewrites that to /index.html with a 200). Social crawlers
 * (Facebook, Twitter/X, Slack, LinkedIn, WhatsApp, iMessage, …) don't run the
 * page's JavaScript, so a shared event link showed a bare URL with no title,
 * description, or image.
 *
 * WHY VIEWER-REQUEST (and not origin-response)
 * Lambda@Edge origin-response does NOT execute for responses generated from a
 * CloudFront custom error page — which is exactly how these paths are served —
 * so an origin-response function never fires here. A VIEWER-REQUEST function
 * runs before the origin is consulted and may return its OWN response
 * (short-circuit). So for crawler user-agents we generate a small HTML document
 * containing the og:/twitter: tags (and a redirect for any human that lands on
 * it); every other request is returned UNCHANGED and loads the normal SPA.
 *
 * Design notes:
 *  - Core logic is pure and dependency-injected (see exports) so it is unit
 *    tested without AWS or the network. `handler` accepts an optional
 *    { fetchEventData } override; in production it defaults to the live fetch.
 *  - Non-crawler requests do only a cheap UA + path check, then return the
 *    request untouched — negligible added latency for real users.
 *  - All event data is PUBLIC (same resolver + events API the clients call
 *    unauthenticated). No secrets are read or emitted.
 */

'use strict';

const https = require('https');

const SHARE_ORIGIN = 'https://keeptabs.app';
const EVENT_IMAGE_BASE = 'https://mytabs-core-prod.s3.amazonaws.com/events/';
const API_BASE = 'https://16psjhr9ni.execute-api.us-east-1.amazonaws.com/prod';

const HANDLED_PREFIXES = new Set(['e', 'o']);

const CRAWLER_SIGNATURES = [
  'facebookexternalhit',
  'facebookcatalog',
  'facebot',
  'twitterbot',
  'slackbot',
  'linkedinbot',
  'whatsapp',
  'discordbot',
  'telegrambot',
  'pinterest',
  'redditbot',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'vkshare',
  'w3c_validator',
  'skypeuripreview',
  'applebot',
];

/** @param {string} [userAgent] @returns {boolean} */
function isCrawler(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_SIGNATURES.some((sig) => ua.includes(sig));
}

/**
 * @param {string} uri e.g. "/e/BIZ-ABCD-EVT-EFGH?utm=fb"
 * @returns {{prefix: string, code: string} | null}
 */
function parseCodeFromUri(uri) {
  if (!uri || typeof uri !== 'string') return null;
  const path = uri.split('?')[0];
  const segments = path.split('/').filter((s) => s.length > 0);
  if (segments.length !== 2) return null;
  const [prefix, rawCode] = segments;
  if (!HANDLED_PREFIXES.has(prefix)) return null;
  let code;
  try {
    code = decodeURIComponent(rawCode);
  } catch (e) {
    code = rawCode;
  }
  if (!code) return null;
  return { prefix, code };
}

/** Escapes the five HTML-significant characters. */
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Open Graph + Twitter Card <meta> block. Empty fields are omitted.
 * @param {{title?,description?,image?,url?}} data
 * @returns {string}
 */
function buildOgTags({ title, description, image, url } = {}) {
  const tags = [];
  const t = title ? escapeHtml(title) : '';
  const d = description ? escapeHtml(description) : '';
  const img = image ? escapeHtml(image) : '';
  const u = url ? escapeHtml(url) : '';

  tags.push('<meta property="og:type" content="website"/>');
  tags.push('<meta property="og:site_name" content="Tabs"/>');
  if (t) tags.push(`<meta property="og:title" content="${t}"/>`);
  if (d) tags.push(`<meta property="og:description" content="${d}"/>`);
  if (img) tags.push(`<meta property="og:image" content="${img}"/>`);
  if (u) tags.push(`<meta property="og:url" content="${u}"/>`);

  tags.push('<meta name="twitter:card" content="summary_large_image"/>');
  if (t) tags.push(`<meta name="twitter:title" content="${t}"/>`);
  if (d) tags.push(`<meta name="twitter:description" content="${d}"/>`);
  if (img) tags.push(`<meta name="twitter:image" content="${img}"/>`);

  return tags.join('');
}

/**
 * A complete, tiny HTML document for crawlers. Contains the og/twitter tags,
 * a canonical link, and a redirect so that a human who happens to load it is
 * sent to the real page (which boots the SPA / JumpPage).
 * @param {{title?,description?,image?,url?}} data
 * @returns {string}
 */
function buildCrawlerHtml({ title, description, image, url } = {}) {
  const safeTitle = title ? escapeHtml(title) : 'Tabs';
  const safeUrl = url ? escapeHtml(url) : SHARE_ORIGIN;
  const ogTags = buildOgTags({ title, description, image, url });

  return (
    '<!doctype html><html lang="en"><head>' +
    '<meta charset="utf-8"/>' +
    '<meta name="viewport" content="width=device-width,initial-scale=1"/>' +
    ogTags +
    `<link rel="canonical" href="${safeUrl}"/>` +
    // Humans who open this URL directly get bounced to the same URL; the SPA/
    // JumpPage takes over from there. Crawlers ignore the redirect and read og.
    `<meta http-equiv="refresh" content="0;url=${safeUrl}"/>` +
    `<title>${safeTitle}</title>` +
    '</head><body>' +
    `<p>Redirecting to <a href="${safeUrl}">${safeTitle}</a>…</p>` +
    `<script>location.replace(${JSON.stringify(url || SHARE_ORIGIN)});</script>` +
    '</body></html>'
  );
}

function headerValue(headers, name) {
  if (!headers) return '';
  const entry = headers[name.toLowerCase()];
  if (Array.isArray(entry) && entry.length > 0) return entry[0].value || '';
  return '';
}

/** GET a URL and parse JSON. Resolves null on any non-2xx / parse error. */
function getJson(url) {
  return new Promise((resolve) => {
    const req = https.get(url, { timeout: 1500 }, (res) => {
      const { statusCode } = res;
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });
      res.on('end', () => {
        if (!statusCode || statusCode < 200 || statusCode >= 300) return resolve(null);
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function fallbackDescription(ev) {
  const place = [ev.city, ev.state].filter(Boolean).join(', ');
  const cats = Array.isArray(ev.categories)
    ? ev.categories.map((c) => (c && c.name ? c.name : null)).filter(Boolean).slice(0, 3).join(', ')
    : '';
  return [place, cats].filter(Boolean).join(' · ');
}

/**
 * Resolve the code, then read public event details.
 * @param {string} prefix 'e' | 'o'
 * @param {string} code
 * @returns {Promise<{type,eventId,title,description,image,isActive}|null>}
 */
async function fetchEventDataLive(prefix, code) {
  const resolved = await getJson(`${API_BASE}/api/resolve/${prefix}/${encodeURIComponent(code)}`);
  if (!resolved || resolved.error) return null;
  if (resolved.type !== 'event' || !resolved.eventId) return null;

  const eventId = resolved.eventId;
  const details = (await getJson(`${API_BASE}/events/${encodeURIComponent(eventId)}`)) || {};

  const title = details.name || resolved.eventName || '';
  const description = details.description || fallbackDescription(details) || '';

  return {
    type: 'event',
    eventId,
    title,
    description,
    image: `${EVENT_IMAGE_BASE}${eventId}`,
    isActive: resolved.isActive !== false,
  };
}

/** Wraps generated HTML in the CloudFront "generated response" shape. */
function htmlResponse(html) {
  return {
    status: '200',
    statusDescription: 'OK',
    headers: {
      'content-type': [{ key: 'Content-Type', value: 'text/html; charset=utf-8' }],
      // Short cache so an event edit propagates; crawlers refetch anyway.
      'cache-control': [{ key: 'Cache-Control', value: 'max-age=300' }],
    },
    body: html,
  };
}

/**
 * CloudFront VIEWER-REQUEST handler.
 * Returns a generated response (crawler on /e|/o) or the original request.
 * @param {object} event CloudFront Lambda@Edge event
 * @param {{fetchEventData?: Function}} [deps] injectable dependencies (tests)
 */
async function handler(event, deps = {}) {
  const fetchEventData = deps.fetchEventData || fetchEventDataLive;

  const cf = event && event.Records && event.Records[0] && event.Records[0].cf;
  if (!cf || !cf.request) return event; // Unexpected shape: do nothing.
  const request = cf.request;

  try {
    const ua = headerValue(request.headers, 'user-agent');
    if (!isCrawler(ua)) return request; // Humans → normal SPA.

    const parsed = parseCodeFromUri(request.uri);
    if (!parsed) return request; // Not an /e or /o link → normal SPA.

    const data = await fetchEventData(parsed.prefix, parsed.code);
    if (!data) return request; // Couldn't resolve → let the SPA handle it.

    const host = headerValue(request.headers, 'host') || 'keeptabs.app';
    const url = `https://${host}/${parsed.prefix}/${parsed.code}`;

    const html = buildCrawlerHtml({
      title: data.title,
      description: data.description,
      image: data.image,
      url,
    });

    return htmlResponse(html);
  } catch (err) {
    // Never break the request path — fall back to the normal SPA.
    return request;
  }
}

module.exports = {
  handler,
  isCrawler,
  parseCodeFromUri,
  buildOgTags,
  buildCrawlerHtml,
  fetchEventDataLive,
  EVENT_IMAGE_BASE,
  SHARE_ORIGIN,
  API_BASE,
};
