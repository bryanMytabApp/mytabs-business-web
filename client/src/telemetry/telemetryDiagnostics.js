/**
 * Telemetry diagnostics (web) — CONSOLE-ONLY.
 *
 * Telemetry is strictly fire-and-forget and must never add pipeline work on
 * failure. onError therefore ONLY logs (debug-gated) — it never re-emits into
 * the pipeline (which could loop on a flaky/blocked connection). Silent by
 * default so it never spams the console or affects the UI.
 */
const TAG = '[telemetry]';

function debugOn() {
  try {
    return typeof window !== 'undefined' && window.__TELEMETRY_DEBUG__ === true;
  } catch (_) { return false; }
}

export function trace(event, detail) {
  if (!debugOn()) return;
  try { console.log(`${TAG} ${event}`, detail != null ? detail : ''); } catch (_) {}
}

export function makeOnError(_getSdk) {
  return function onError(err) {
    if (!debugOn()) return;
    const message = err && err.message ? err.message : String(err);
    try { console.warn(`${TAG} internal error:`, message); } catch (_) {}
  };
}
