/* eslint-disable-next-line strict */
'use strict'; // kept for parity with the mirrored CJS copies (mobile & backend)
/* global globalThis */

/**
 * Shared, framework-agnostic client-side Telemetry SDK.
 *
 * Canonical source of truth for emitter instrumentation across every MyTabs
 * application — web (React, fetch) and the React Native mobile app share this
 * single module. It buffers events in memory and flushes ONE batched
 * `POST /telemetry` request on an interval / on max-buffer / on explicit flush,
 * which is the primary ingest cost lever (one request per batch, not per event).
 *
 * Design references (tabs-service-dashboard spec):
 *   - Event envelope + subtype schemas (Heartbeat_Event, Telemetry_Event with
 *     categories latency|crash|session|usage|error, Usage_Event subtypes
 *     screen_view|navigation|feature|session_lifecycle, Error_Event).
 *   - "Client-side event batching" cost optimization.
 *   - Emitter auth via `x-emitter-key-id` / `x-emitter-key-secret` headers.
 *
 * Requirements: 3.1, 3.2, 17.1, 17.2, 17.3, 17.4, 17.5, 17.8.
 *
 * ── Consuming this module ──────────────────────────────────────────────────
 *
 * CommonJS / Node / Jest:
 *   const { createTelemetrySdk } = require('.../shared/telemetry/telemetrySdk');
 *
 * ESM / bundled web (React) — bundlers resolve the CJS module via interop:
 *   import { createTelemetrySdk } from '.../shared/telemetry/telemetrySdk';
 *
 * React Native (Metro bundles CJS transparently):
 *   import { createTelemetrySdk } from '.../shared/telemetry/telemetrySdk';
 *
 * The module attaches its API to `module.exports` (CJS) and also mirrors the
 * named exports as properties so ESM named-import interop works after bundling.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Applications known to the ingest pipeline (see design REPO_BY_APP map). */
const KNOWN_APPS = Object.freeze([
  'keeptabs',
  'tickets',
  'engagements',
  'mobile',
  'auth',
  'events',
  'notifications',
  'agents',
]);

const VALID_CATEGORIES = Object.freeze([
  'latency',
  'crash',
  'session',
  'usage',
  'error',
]);

const VALID_USAGE_TYPES = Object.freeze([
  'screen_view',
  'navigation',
  'feature',
  'session_lifecycle',
]);

const VALID_SEVERITIES = Object.freeze(['crash', 'error', 'warning', 'info']);

const DEFAULT_FLUSH_INTERVAL_MS = 45000; // ~30–60s window; 45s midpoint
const DEFAULT_MAX_BATCH = 100; // ingest accepts 1–500; keep batches modest
const INGEST_MAX_BATCH_HARD_CAP = 500; // ingest API contract upper bound
const DEFAULT_MAX_QUEUE = 1000; // bounded re-queue: never grow without limit

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Generate an RFC-4122-ish v4 identifier without pulling in a dependency.
 * Uses crypto.getRandomValues when available (browser/RN/modern Node), and
 * falls back to Math.random. Used only for anonymous session/device ids —
 * this value carries NO PII.
 */
function generateId() {
  const bytes = new Uint8Array(16);
  const g =
    (typeof globalThis !== 'undefined' && globalThis.crypto) ||
    (typeof crypto !== 'undefined' ? crypto : undefined);
  if (g && typeof g.getRandomValues === 'function') {
    g.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  // Per RFC 4122 §4.4: set version (4) and variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [];
  for (let i = 0; i < 16; i += 1) {
    hex.push((bytes[i] + 0x100).toString(16).slice(1));
  }
  return (
    `${hex[0]}${hex[1]}${hex[2]}${hex[3]}-` +
    `${hex[4]}${hex[5]}-` +
    `${hex[6]}${hex[7]}-` +
    `${hex[8]}${hex[9]}-` +
    `${hex[10]}${hex[11]}${hex[12]}${hex[13]}${hex[14]}${hex[15]}`
  );
}

/** ISO-8601 timestamp for "now" (or a supplied Date). */
function isoNow(date) {
  return (date instanceof Date ? date : new Date()).toISOString();
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

/**
 * Default transport: a thin wrapper over the ambient `fetch`. Kept injectable
 * so the SDK runs unchanged in web, React Native, and unit tests (inject a stub).
 *
 * Contract: async ({ url, method, headers, body }) => { ok, status } (throws on
 * network failure). The SDK only relies on `ok`/throw semantics.
 */
function defaultTransport(request) {
  const f =
    (typeof globalThis !== 'undefined' && globalThis.fetch) ||
    (typeof fetch !== 'undefined' ? fetch : undefined);
  if (typeof f !== 'function') {
    return Promise.reject(
      new Error(
        'No fetch available; provide a `transport` in the telemetry SDK config'
      )
    );
  }
  return f(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });
}

// ── SDK factory ──────────────────────────────────────────────────────────────

/**
 * Create a configured telemetry SDK instance.
 *
 * @param {object} config
 * @param {string} config.app             One of KNOWN_APPS.
 * @param {string} config.version         Deployed app version (semver string).
 * @param {string} config.ingestUrl       POST /telemetry endpoint URL.
 * @param {string} config.emitterKeyId    Emitter credential id (x-emitter-key-id).
 * @param {string} config.emitterKeySecret Emitter credential secret.
 * @param {number} [config.flushIntervalMs=45000] Auto-flush cadence (~30–60s).
 * @param {number} [config.maxBatch=100]  Flush immediately when buffer hits this.
 * @param {number} [config.maxQueue=1000] Bounded cap for buffer + re-queued events.
 * @param {Function} [config.transport]   Injectable transport (defaults to fetch).
 * @param {string} [config.sessionId]     Override the generated anonymous id.
 * @param {Function} [config.onError]     Optional observer for internal failures.
 * @returns {object} SDK instance.
 */
function createTelemetrySdk(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createTelemetrySdk: config object is required');
  }
  const {
    app,
    version,
    ingestUrl,
    emitterKeyId,
    emitterKeySecret,
    flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
    maxBatch = DEFAULT_MAX_BATCH,
    maxQueue = DEFAULT_MAX_QUEUE,
    transport = defaultTransport,
    sessionId: sessionIdOverride,
    env: envOverride,
    onError,
  } = config;

  // Environment label so test/local traffic can be segmented from production.
  const env = isNonEmptyString(envOverride) ? envOverride : 'production';

  if (!isNonEmptyString(app)) {
    throw new Error('createTelemetrySdk: `app` is required');
  }
  if (!KNOWN_APPS.includes(app)) {
    throw new Error(
      `createTelemetrySdk: unknown app "${app}" (expected one of ${KNOWN_APPS.join(', ')})`
    );
  }
  if (!isNonEmptyString(version)) {
    throw new Error('createTelemetrySdk: `version` is required');
  }
  if (!isNonEmptyString(ingestUrl)) {
    throw new Error('createTelemetrySdk: `ingestUrl` is required');
  }

  const effectiveMaxBatch = Math.min(
    Math.max(1, maxBatch | 0),
    INGEST_MAX_BATCH_HARD_CAP
  );
  const effectiveMaxQueue = Math.max(effectiveMaxBatch, maxQueue | 0);

  // Anonymous, pseudonymous session/device id — the ONLY identifier emitted.
  const sessionId = isNonEmptyString(sessionIdOverride)
    ? sessionIdOverride
    : `anon-${generateId()}`;

  /** @type {object[]} in-memory buffer */
  let buffer = [];
  let timer = null;
  let started = false;
  let flushing = false;

  function reportError(err) {
    if (typeof onError === 'function') {
      try {
        onError(err);
      } catch (_ignored) {
        /* observer must never break the host app */
      }
    }
  }

  /** Push an event onto the buffer; drop-oldest if the bounded cap is hit. */
  function enqueue(event) {
    if (event && event.env === undefined) event.env = env;
    buffer.push(event);
    if (buffer.length > effectiveMaxQueue) {
      // Bounded: shed the oldest events so memory never grows without limit.
      buffer.splice(0, buffer.length - effectiveMaxQueue);
    }
    if (buffer.length >= effectiveMaxBatch) {
      // Fire-and-forget; flush() never throws into the host app.
      flush();
    }
  }

  function buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (isNonEmptyString(emitterKeyId)) {
      headers['x-emitter-key-id'] = emitterKeyId;
    }
    if (isNonEmptyString(emitterKeySecret)) {
      headers['x-emitter-key-secret'] = emitterKeySecret;
    }
    return headers;
  }

  /**
   * Serialize a batch to the ingest wire shape: a single event when there's
   * exactly one, otherwise `{ events: [...] }`.
   */
  function toRequestBody(events, creds) {
    // Normal path: a bare single event, else { events: [...] } (unchanged wire
    // shape). For beacon sends (no custom headers), wrap so emitter creds can
    // ride in the body — the ingest API accepts header OR body creds.
    if (creds && (creds.emitterKeyId || creds.emitterKeySecret)) {
      return {
        events: events.length === 1 ? [events[0]] : events,
        emitterKeyId: creds.emitterKeyId,
        emitterKeySecret: creds.emitterKeySecret,
      };
    }
    return events.length === 1 ? events[0] : { events };
  }

  /**
   * Flush buffered events as ONE batched POST. On failure, re-queue (bounded)
   * so the next flush retries. Never throws into the host app.
   *
   * @returns {Promise<{ flushed: number, ok: boolean }>}
   */
  async function flush() {
    if (flushing) {
      // Avoid overlapping flushes; the in-flight one drains the buffer.
      return { flushed: 0, ok: true };
    }
    if (buffer.length === 0) {
      return { flushed: 0, ok: true };
    }
    flushing = true;
    // Take up to a hard-cap batch; leftover stays buffered for the next flush.
    const batch = buffer.slice(0, INGEST_MAX_BATCH_HARD_CAP);
    buffer = buffer.slice(batch.length);

    try {
      const response = await transport({
        url: ingestUrl,
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(toRequestBody(batch)),
      });
      // A transport may return a fetch-like Response (with `ok`) or nothing.
      const ok = !response || response.ok !== false;
      if (!ok) {
        requeue(batch);
        const status = response && response.status;
        reportError(
          new Error(`Telemetry flush rejected with status ${status}`)
        );
        return { flushed: 0, ok: false };
      }
      return { flushed: batch.length, ok: true };
    } catch (err) {
      requeue(batch);
      reportError(err);
      return { flushed: 0, ok: false };
    } finally {
      flushing = false;
    }
  }

  /**
   * Best-effort flush via navigator.sendBeacon — the ONLY reliable way to send
   * buffered events during page unload / tab-hide, where a normal fetch is
   * aborted by the browser. Sends the current buffer as one batched POST body.
   * Credentials go in the body (sendBeacon cannot set custom headers), and the
   * ingest API also accepts emitter creds from the body for beacon sends.
   * Falls back to the async fetch flush when sendBeacon is unavailable.
   *
   * @returns {boolean} true if a beacon was queued by the browser.
   */
  function flushBeacon() {
    try {
      if (buffer.length === 0) return true;
      const nav = (typeof navigator !== 'undefined' && navigator) || null;
      if (!nav || typeof nav.sendBeacon !== 'function') {
        // No beacon support — fall back to the async flush (best effort).
        flush();
        return false;
      }
      const batch = buffer.slice(0, INGEST_MAX_BATCH_HARD_CAP);
      buffer = buffer.slice(batch.length);
      const body = JSON.stringify(
        toRequestBody(batch, { emitterKeyId, emitterKeySecret }),
      );
      const blob =
        typeof Blob !== 'undefined'
          ? new Blob([body], { type: 'application/json' })
          : body;
      const queued = nav.sendBeacon(ingestUrl, blob);
      if (!queued) requeue(batch);
      return queued;
    } catch (err) {
      reportError(err);
      return false;
    }
  }

  /** Re-queue a failed batch at the FRONT, honoring the bounded cap. */
  function requeue(batch) {
    buffer = batch.concat(buffer);
    if (buffer.length > effectiveMaxQueue) {
      // Drop the oldest (front) events beyond the cap.
      buffer = buffer.slice(buffer.length - effectiveMaxQueue);
    }
  }

  /** Start the periodic auto-flush timer (idempotent). */
  function start() {
    if (started) return instance;
    started = true;
    timer = setInterval(() => {
      flush();
    }, flushIntervalMs);
    // Don't keep a Node process alive just for telemetry.
    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    return instance;
  }

  /** Stop the timer and flush anything left. */
  async function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    started = false;
    return flush();
  }

  // ── Emit helpers ───────────────────────────────────────────────────────────

  /** Heartbeat: liveness with auto app id + version + ISO timestamp. */
  function heartbeat() {
    enqueue({
      eventType: 'heartbeat',
      app,
      version,
      timestamp: isoNow(),
    });
    return instance;
  }

  /**
   * Generic telemetry event. `category` must be a valid category; `payload`
   * is a subtype-specific object.
   */
  function telemetry(category, payload) {
    if (!VALID_CATEGORIES.includes(category)) {
      reportError(new Error(`telemetry: invalid category "${category}"`));
      return instance;
    }
    enqueue({
      eventType: 'telemetry',
      app,
      version,
      timestamp: isoNow(),
      category,
      payload: payload && typeof payload === 'object' ? payload : {},
    });
    return instance;
  }

  /** Build the common usage-event envelope (category: 'usage'). */
  function usage(usageType, payload) {
    if (!VALID_USAGE_TYPES.includes(usageType)) {
      reportError(new Error(`usage: invalid usageType "${usageType}"`));
      return instance;
    }
    enqueue({
      eventType: 'telemetry',
      category: 'usage',
      app,
      sessionId, // anonymized/pseudonymous only — no PII
      timestamp: isoNow(),
      usageType,
      payload: payload && typeof payload === 'object' ? payload : {},
    });
    return instance;
  }

  /** Usage: a screen/route view. */
  function screenView(screen) {
    return usage('screen_view', { screen });
  }

  /** Usage: a navigation transition. */
  function navigation(fromScreen, toScreen) {
    return usage('navigation', { fromScreen, toScreen });
  }

  /** Usage: a feature/interaction event. */
  function feature(featureId, action) {
    return usage('feature', { feature: featureId, action });
  }

  /** Usage: session lifecycle start. */
  function sessionStart() {
    return usage('session_lifecycle', { phase: 'start' });
  }

  /** Usage: session lifecycle end with computed duration (ms). */
  function sessionEnd(durationMs) {
    return usage('session_lifecycle', { phase: 'end', durationMs });
  }

  /**
   * Error event (category: 'error') — feeds GitHub issue routing downstream.
   * Requires severity/errorType/message/stackSignature per the Error_Event schema.
   */
  function error(details) {
    const d = details || {};
    const severity = VALID_SEVERITIES.includes(d.severity)
      ? d.severity
      : 'error';
    enqueue({
      eventType: 'telemetry',
      category: 'error',
      app,
      version,
      timestamp: isoNow(),
      severity,
      errorType: isNonEmptyString(d.errorType) ? d.errorType : 'Error',
      message: typeof d.message === 'string' ? d.message : '',
      stackSignature:
        typeof d.stackSignature === 'string' ? d.stackSignature : '',
    });
    return instance;
  }

  // ── Introspection helpers (used by tests / diagnostics) ─────────────────────

  function pendingCount() {
    return buffer.length;
  }

  function getSessionId() {
    return sessionId;
  }

  const instance = {
    // lifecycle
    start,
    stop,
    flush,
    flushBeacon,
    // emit helpers
    heartbeat,
    telemetry,
    usage,
    screenView,
    navigation,
    feature,
    sessionStart,
    sessionEnd,
    error,
    // introspection
    pendingCount,
    getSessionId,
    // static config surface
    app,
    version,
  };

  return instance;
}

// ── Exports (CJS + ESM-friendly mirrors) ─────────────────────────────────────

// ESM exports (web/bundler copy; mobile & backend use CJS copies).
export {
  createTelemetrySdk,
  generateId,
  isoNow,
  KNOWN_APPS,
  VALID_CATEGORIES,
  VALID_USAGE_TYPES,
  VALID_SEVERITIES,
  DEFAULT_FLUSH_INTERVAL_MS,
  DEFAULT_MAX_BATCH,
  INGEST_MAX_BATCH_HARD_CAP,
  DEFAULT_MAX_QUEUE,
};
const telemetrySdkDefault = { createTelemetrySdk };
export default telemetrySdkDefault;
