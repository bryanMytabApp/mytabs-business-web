/**
 * Telemetry configuration resolver for the KeepTabs web app (app='keeptabs').
 *
 * Sources the ingest URL + emitter credentials from the app's runtime config
 * WITHOUT hardcoding secret values:
 *   1. window.__TELEMETRY__ (optional runtime injection)
 *   2. config.json `telemetry` block (ingest URL is a non-secret public endpoint;
 *      emitter credentials are publishable client identifiers, left empty in the
 *      repo and provisioned at deploy time via env/runtime config).
 *
 * When creds are absent telemetry stays a safe no-op (never spams 401s).
 *
 * Requirements: 3.1, 3.2, 10.1, 17.5, 17.8.
 */

import config from '../config.json';

const APP_ID = 'keeptabs';

function runtimeTelemetry() {
  try {
    if (typeof window !== 'undefined' && window.__TELEMETRY__) {
      return window.__TELEMETRY__;
    }
  } catch (_) { /* no window */ }
  return {};
}

export function resolveVersion() {
  try {
    // CRA injects REACT_APP_* at build time; fall back to a checked-in version.
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_VERSION) {
      return process.env.REACT_APP_VERSION;
    }
  } catch (_) { /* ignore */ }
  return (config && config.appVersion) || 'unknown';
}


function resolveEnv() {
  try {
    // Build-time override (CRA inlines REACT_APP_*).
    if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_TELEMETRY_ENV) {
      return process.env.REACT_APP_TELEMETRY_ENV;
    }
  } catch (_) {}
  try {
    if (typeof window !== 'undefined' && window.location) {
      const h = window.location.hostname || '';
      if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.endsWith('.local')) return 'test';
    }
  } catch (_) {}
  return 'production';
}

export function resolveTelemetryConfig() {
  const base = (config && config.telemetry) || {};
  const rt = runtimeTelemetry();
  // Build-time env (CRA inlines REACT_APP_*) supplies the publishable emitter
  // credentials; window.__TELEMETRY__ then config.json are fallbacks.
  const ingestUrl = rt.ingestUrl || (typeof process !== 'undefined' && process.env ? process.env.REACT_APP_TELEMETRY_INGEST_URL : undefined) || base.ingestUrl || '';
  const emitterKeyId = rt.emitterKeyId || (typeof process !== 'undefined' && process.env ? process.env.REACT_APP_TELEMETRY_KEY_ID : undefined) || base.emitterKeyId || '';
  const emitterKeySecret = rt.emitterKeySecret || (typeof process !== 'undefined' && process.env ? process.env.REACT_APP_TELEMETRY_KEY_SECRET : undefined) || base.emitterKeySecret || '';
  return {
    app: APP_ID,
    version: resolveVersion(),
    env: resolveEnv(),
    ingestUrl,
    emitterKeyId,
    emitterKeySecret,
    enabled: Boolean(ingestUrl && emitterKeyId && emitterKeySecret),
  };
}
