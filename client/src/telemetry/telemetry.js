/**
 * KeepTabs web telemetry manager (app='keeptabs').
 *
 * App-level wrapper around the vendored, framework-agnostic telemetry SDK.
 * Configures ONE batched emitter at app boot and exposes the emit helpers the
 * app wires in: heartbeat, session lifecycle, API latency, screen/navigation/
 * feature usage events, and error/crash reporting. Everything routes through the
 * SDK's single batched POST /telemetry. Pure JS — no new deps.
 *
 * Requirements: 3.1, 3.2, 10.1, 17.1, 17.2, 17.3, 17.4, 17.5, 17.8, 18.2.
 */

import { createTelemetrySdk } from './telemetrySdk';
import { resolveTelemetryConfig } from './telemetryConfig';
import { trace, makeOnError } from './telemetryDiagnostics';

let _sdk = null;
let _enabled = false;
let _heartbeatTimer = null;
let _sessionStartedAt = null;
let _wired = false;
let _flushSoonTimer = null;

const DEFAULT_HEARTBEAT_INTERVAL_MS = 60000;

export function initTelemetry(options = {}) {
  if (_sdk && !options.force) return _sdk;
  const cfg = options.config || resolveTelemetryConfig();
  trace('init.config', { app: cfg.app, version: cfg.version, hasIngestUrl: Boolean(cfg.ingestUrl), hasKeyId: Boolean(cfg.emitterKeyId), hasKeySecret: Boolean(cfg.emitterKeySecret), enabled: cfg.enabled });
  if (!options.sdk && !cfg.enabled) { _enabled = false; _sdk = null; trace('init.disabled', 'creds/ingest URL missing → no-op'); return null; }
  try {
    _sdk = options.sdk || createTelemetrySdk({
      app: cfg.app,
      version: cfg.version,
      env: cfg.env,
      ingestUrl: cfg.ingestUrl,
      emitterKeyId: cfg.emitterKeyId,
      emitterKeySecret: cfg.emitterKeySecret,
      transport: options.transport,
      // SPAs rarely stay on one page 45s and don't fire pagehide on client-side
      // route changes, so flush eagerly (~8s) to get data out during a session.
      flushIntervalMs: options.flushIntervalMs || 8000,
      onError: makeOnError(() => _sdk),
    });
    _enabled = true;
    _sdk.start();
    if (options.startHeartbeat !== false) startHeartbeat(options.heartbeatIntervalMs);
    if (options.wireBrowser !== false) wireBrowserLifecycle();
    sessionStart();
    return _sdk;
  } catch (_err) {
    _enabled = false; _sdk = null; return null;
  }
}

/** Wire browser lifecycle: flush on hide/unload, pause/resume on visibility. */
function wireBrowserLifecycle() {
  if (_wired || typeof window === 'undefined') return;
  _wired = true;
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        stopHeartbeat(); flushBeacon();
      } else if (document.visibilityState === 'visible') {
        startHeartbeat(); heartbeat();
      }
    });
    window.addEventListener('beforeunload', () => { sessionEnd(); flushBeacon(); });
    window.addEventListener('pagehide', () => { sessionEnd(); flushBeacon(); });
    // Global error + unhandled rejection → error telemetry.
    window.addEventListener('error', (e) => {
      reportError(e && e.error ? e.error : new Error(e && e.message ? e.message : 'window error'));
    });
    window.addEventListener('unhandledrejection', (e) => {
      const reason = e && e.reason;
      reportError(reason instanceof Error ? reason : new Error(String(reason)));
    });
  } catch (_) { /* SSR / no DOM */ }
}

export function startHeartbeat(intervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS) {
  if (!_sdk || !_enabled) return;
  stopHeartbeat();
  _sdk.heartbeat();
  _heartbeatTimer = setInterval(() => { if (_sdk) _sdk.heartbeat(); }, intervalMs);
}

export function stopHeartbeat() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
}

export function heartbeat() { if (_sdk && _enabled) _sdk.heartbeat(); }

export function sessionStart() { _sessionStartedAt = Date.now(); if (_sdk && _enabled) _sdk.sessionStart(); }

export function sessionEnd() {
  if (_sdk && _enabled) {
    const durationMs = _sessionStartedAt != null ? Date.now() - _sessionStartedAt : 0;
    _sdk.sessionEnd(durationMs);
  }
  _sessionStartedAt = null;
}

export function apiLatency(sample = {}) {
  if (!_sdk || !_enabled) return;
  _sdk.telemetry('latency', {
    method: sample.method || 'GET',
    path: typeof sample.path === 'string' ? sample.path : '',
    status: sample.status,
    durationMs: Number(sample.durationMs) || 0,
  });
}

export function reportError(error, meta = {}) {
  if (!_sdk || !_enabled) return;
  const err = error instanceof Error ? error : new Error(String(error));
  const isFatal = meta.isFatal === true;
  const stack = (err.stack || '').split('\n').slice(0, 5).join('\n');
  _sdk.telemetry(isFatal ? 'crash' : 'error', {
    severity: isFatal ? 'crash' : 'error',
    errorType: err.name || 'Error',
    message: err.message || '',
    stackSignature: stack,
    screen: meta.screen || (typeof window !== 'undefined' ? window.location?.pathname : 'unknown'),
    action: meta.action || 'unknown',
  });
}
export function reportCrash(error, meta = {}) { reportError(error, { ...meta, isFatal: true }); }

/** Debounced flush ~2s after a burst of usage events, so screen views land
 * within seconds without a POST per event. */
function flushSoon(delayMs = 2000) {
  if (!_sdk || !_enabled) return;
  if (_flushSoonTimer) return; // already scheduled
  _flushSoonTimer = setTimeout(() => { _flushSoonTimer = null; flush(); }, delayMs);
}

export function screenView(screen) { if (_sdk && _enabled) { _sdk.screenView(screen); flushSoon(); } }
export function navigation(fromScreen, toScreen) { if (_sdk && _enabled) { _sdk.navigation(fromScreen, toScreen); flushSoon(); } }
export function feature(featureId, action) { if (_sdk && _enabled) { _sdk.feature(featureId, action); flushSoon(); } }

export function flush() { return _sdk && _enabled ? _sdk.flush() : Promise.resolve({ flushed: 0, ok: true }); }
export function flushBeacon() { if (_sdk && _enabled && typeof _sdk.flushBeacon === 'function') return _sdk.flushBeacon(); return false; }
export function isEnabled() { return _enabled && Boolean(_sdk); }
export function getSdk() { return _sdk; }
export function destroyTelemetry() {
  stopHeartbeat();
  const s = _sdk; _sdk = null; _enabled = false; _sessionStartedAt = null;
  return s && typeof s.stop === 'function' ? s.stop() : Promise.resolve();
}
