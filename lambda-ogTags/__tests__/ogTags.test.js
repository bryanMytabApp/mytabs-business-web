/**
 * Unit tests for the Open Graph Lambda@Edge (VIEWER-REQUEST).
 *
 * WHY VIEWER-REQUEST (not origin-response):
 * keeptabs.app/e/<code> is served via CloudFront Custom Error Responses
 * (S3 404 -> /index.html, 200). Lambda@Edge origin-response does NOT run on
 * responses produced from a custom error page, so an origin-response function
 * never fires for these paths. A VIEWER-REQUEST function runs before the origin
 * is consulted and can return its OWN response (short-circuit). So for social
 * crawlers we generate and return a small HTML document with og:/twitter: tags;
 * every other request is returned unchanged and loads the normal SPA.
 *
 * Pure, dependency-injected core (no network / AWS in tests):
 *   - isCrawler(userAgent)
 *   - parseCodeFromUri(uri) -> { prefix, code } | null
 *   - buildOgTags({title,description,image,url}) -> string
 *   - buildCrawlerHtml({title,description,image,url}) -> full HTML document
 *   - handler(event, { fetchEventData }) -> a CloudFront response (crawler)
 *                                           OR the original request (everyone else)
 */

const {
  isCrawler,
  parseCodeFromUri,
  buildOgTags,
  buildCrawlerHtml,
  handler,
  EVENT_IMAGE_BASE,
  SHARE_ORIGIN,
} = require('../index');

const FB_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const HUMAN_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Builds a minimal CloudFront VIEWER-REQUEST event. */
const makeEvent = ({ uri = '/e/BIZ-ABCD-EVT-EFGH', userAgent = FB_UA } = {}) => ({
  Records: [
    {
      cf: {
        request: {
          uri,
          querystring: '',
          headers: {
            host: [{ key: 'Host', value: 'keeptabs.app' }],
            'user-agent': userAgent ? [{ key: 'User-Agent', value: userAgent }] : undefined,
          },
        },
      },
    },
  ],
});

const getRequest = (event) => event.Records[0].cf.request;

describe('isCrawler', () => {
  it.each([
    ['facebookexternalhit', FB_UA],
    ['Facebot', 'facebookcatalog/1.0'],
    ['Twitterbot', 'Twitterbot/1.0'],
    ['Slackbot', 'Slackbot-LinkExpanding 1.0'],
    ['LinkedInBot', 'LinkedInBot/1.0'],
    ['WhatsApp', 'WhatsApp/2.23'],
    ['Discordbot', 'Mozilla/5.0 (compatible; Discordbot/2.0)'],
    ['TelegramBot', 'TelegramBot (like TwitterBot)'],
  ])('detects %s as a crawler', (_label, ua) => {
    expect(isCrawler(ua)).toBe(true);
  });

  it('treats a normal mobile browser as NOT a crawler', () => {
    expect(isCrawler(HUMAN_UA)).toBe(false);
  });

  it('is case-insensitive and safe on empty input', () => {
    expect(isCrawler('FACEBOOKEXTERNALHIT/1.1')).toBe(true);
    expect(isCrawler('')).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
  });
});

describe('parseCodeFromUri', () => {
  it('parses /e/<code> and /o/<code>', () => {
    expect(parseCodeFromUri('/e/BIZ-ABCD-EVT-EFGH')).toEqual({ prefix: 'e', code: 'BIZ-ABCD-EVT-EFGH' });
    expect(parseCodeFromUri('/o/ORG-ABCD')).toEqual({ prefix: 'o', code: 'ORG-ABCD' });
  });

  it('handles trailing slash, query string, and url-encoding', () => {
    expect(parseCodeFromUri('/e/CODE/')).toEqual({ prefix: 'e', code: 'CODE' });
    expect(parseCodeFromUri('/e/CODE?x=1')).toEqual({ prefix: 'e', code: 'CODE' });
    expect(parseCodeFromUri('/e/A%20B')).toEqual({ prefix: 'e', code: 'A B' });
  });

  it.each([
    ['root', '/'],
    ['a static asset', '/static/js/main.abc.js'],
    ['a business path', '/b/BIZ-1'],
    ['e with no code', '/e/'],
  ])('returns null for %s', (_label, uri) => {
    expect(parseCodeFromUri(uri)).toBeNull();
  });
});

describe('buildOgTags', () => {
  const tags = buildOgTags({
    title: 'Rick Ross',
    description: 'Live in Houston',
    image: `${EVENT_IMAGE_BASE}evt-1`,
    url: `${SHARE_ORIGIN}/e/CODE`,
  });

  it('emits og + twitter tags', () => {
    expect(tags).toContain('<meta property="og:title" content="Rick Ross"');
    expect(tags).toContain('<meta property="og:description" content="Live in Houston"');
    expect(tags).toContain(`<meta property="og:image" content="${EVENT_IMAGE_BASE}evt-1"`);
    expect(tags).toContain(`<meta property="og:url" content="${SHARE_ORIGIN}/e/CODE"`);
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it('escapes HTML to prevent markup injection', () => {
    const t = buildOgTags({ title: 'A & "B" <c>', url: 'u' });
    expect(t).toContain('A &amp; &quot;B&quot; &lt;c&gt;');
    expect(t).not.toContain('<c>');
  });

  it('omits og:image when no image is provided', () => {
    expect(buildOgTags({ title: 'T', url: 'u' })).not.toContain('og:image');
  });
});

describe('buildCrawlerHtml', () => {
  const html = buildCrawlerHtml({
    title: 'Rick Ross',
    description: 'Live in Houston',
    image: `${EVENT_IMAGE_BASE}evt-1`,
    url: `${SHARE_ORIGIN}/e/CODE`,
  });

  it('is a complete HTML document with the og tags in <head>', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<head>');
    expect(html).toContain('</head>');
    expect(html.indexOf('og:title')).toBeGreaterThan(html.indexOf('<head>'));
    expect(html.indexOf('og:title')).toBeLessThan(html.indexOf('</head>'));
  });

  it('sets the <title> to the event title', () => {
    expect(html).toContain('<title>Rick Ross</title>');
  });

  it('includes a canonical link and a human redirect to the same url', () => {
    expect(html).toContain(`<link rel="canonical" href="${SHARE_ORIGIN}/e/CODE"`);
    // A human that somehow loads this page should still be sent to the real page.
    expect(html).toMatch(/http-equiv="refresh"|location\.replace/);
  });

  it('escapes the title in both the <title> and og tags', () => {
    const h = buildCrawlerHtml({ title: 'A & <b>B</b>', url: 'u' });
    expect(h).toContain('<title>A &amp; &lt;b&gt;B&lt;/b&gt;</title>');
    expect(h).not.toContain('<b>B</b>');
  });
});

describe('handler (viewer-request)', () => {
  const fetchEventData = jest.fn(async (prefix, code) => ({
    type: 'event',
    eventId: 'evt-1',
    title: 'Rick Ross',
    description: 'Live in Houston',
    image: `${EVENT_IMAGE_BASE}evt-1`,
    isActive: true,
  }));

  beforeEach(() => fetchEventData.mockClear());

  it('returns a generated OG response for a crawler on /e/<code>', async () => {
    const event = makeEvent({ uri: '/e/CODE1', userAgent: FB_UA });
    const result = await handler(event, { fetchEventData });

    expect(fetchEventData).toHaveBeenCalledWith('e', 'CODE1');
    // A CloudFront "generated response" has a status + body, not a .uri.
    expect(result.status).toBe('200');
    expect(result.uri).toBeUndefined();
    expect(result.body).toContain('<meta property="og:title" content="Rick Ross"');
    expect(result.body).toContain(`<meta property="og:image" content="${EVENT_IMAGE_BASE}evt-1"`);
    expect(result.body).toContain(`<meta property="og:url" content="${SHARE_ORIGIN}/e/CODE1"`);
  });

  it('sets a text/html content-type header on the generated response', async () => {
    const event = makeEvent({ uri: '/e/CODE1', userAgent: FB_UA });
    const result = await handler(event, { fetchEventData });
    const ct = result.headers['content-type'][0].value;
    expect(ct).toContain('text/html');
  });

  it('returns the request UNCHANGED for a human browser (no fetch)', async () => {
    const event = makeEvent({ uri: '/e/CODE1', userAgent: HUMAN_UA });
    const request = getRequest(event);
    const result = await handler(event, { fetchEventData });

    expect(fetchEventData).not.toHaveBeenCalled();
    expect(result).toBe(request); // pass through to the SPA
    expect(result.uri).toBe('/e/CODE1');
  });

  it('returns the request unchanged for a non-/e,/o path even for a crawler', async () => {
    const event = makeEvent({ uri: '/static/js/main.js', userAgent: FB_UA });
    const request = getRequest(event);
    const result = await handler(event, { fetchEventData });

    expect(fetchEventData).not.toHaveBeenCalled();
    expect(result).toBe(request);
  });

  it('passes the request through when the event cannot be resolved', async () => {
    const failing = jest.fn(async () => null);
    const event = makeEvent({ uri: '/e/GONE', userAgent: FB_UA });
    const request = getRequest(event);
    const result = await handler(event, { fetchEventData: failing });

    expect(failing).toHaveBeenCalled();
    expect(result).toBe(request);
  });

  it('never throws if fetchEventData rejects — returns the request', async () => {
    const throwing = jest.fn(async () => {
      throw new Error('network down');
    });
    const event = makeEvent({ uri: '/e/CODE1', userAgent: FB_UA });
    const request = getRequest(event);
    const result = await handler(event, { fetchEventData: throwing });

    expect(result).toBe(request);
  });

  it('builds og:url from the request host + path (honors the code)', async () => {
    const event = makeEvent({ uri: '/e/ABC-123', userAgent: FB_UA });
    const result = await handler(event, { fetchEventData });
    expect(result.body).toContain(`<meta property="og:url" content="${SHARE_ORIGIN}/e/ABC-123"`);
  });
});
