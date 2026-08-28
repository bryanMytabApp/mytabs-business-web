/**
 * Smoke tests for the KeepTabs web telemetry manager (telemetry.js).
 *
 * Verifies init + emit (heartbeat / screenView / apiLatency / session) flush as
 * ONE batched POST through an injected transport (no real network), and that the
 * disabled/no-op path is safe. Validates: 3.1, 3.2, 10.1, 17.x, 18.2.
 */

import * as telemetry from './telemetry';

function makeTransport() {
  const requests = [];
  const transport = (req) => { requests.push(req); return Promise.resolve({ ok: true, status: 200 }); };
  return { transport, requests };
}

const TEST_CONFIG = {
  app: 'keeptabs',
  version: '9.9.9',
  ingestUrl: 'https://example.test/telemetry',
  emitterKeyId: 'kid',
  emitterKeySecret: 'ksecret',
  enabled: true,
};

describe('keeptabs web telemetry manager (smoke)', () => {
  afterEach(async () => { await telemetry.destroyTelemetry(); });

  it('initializes with an injected transport and reports enabled', () => {
    const { transport } = makeTransport();
    const sdk = telemetry.initTelemetry({ config: TEST_CONFIG, transport, startHeartbeat: false, wireBrowser: false, force: true });
    expect(sdk).not.toBeNull();
    expect(telemetry.isEnabled()).toBe(true);
  });

  it('emits heartbeat + screen_view and flushes ONE batched POST with emitter headers', async () => {
    const { transport, requests } = makeTransport();
    telemetry.initTelemetry({ config: TEST_CONFIG, transport, startHeartbeat: false, wireBrowser: false, force: true });
    telemetry.heartbeat();
    telemetry.screenView('/dashboard');
    await telemetry.flush();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe(TEST_CONFIG.ingestUrl);
    expect(requests[0].headers['x-emitter-key-id']).toBe('kid');
    const body = JSON.parse(requests[0].body);
    const events = body.events || [body];
    const hb = events.find((e) => e.eventType === 'heartbeat');
    expect(hb.app).toBe('keeptabs');
    const sv = events.find((e) => e.category === 'usage' && e.usageType === 'screen_view');
    expect(sv.payload.screen).toBe('/dashboard');
    expect(sv.sessionId).toMatch(/^anon-/);
  });

  it('emits an API latency sample', async () => {
    const { transport, requests } = makeTransport();
    telemetry.initTelemetry({ config: TEST_CONFIG, transport, startHeartbeat: false, wireBrowser: false, force: true });
    telemetry.apiLatency({ method: 'GET', path: '/events/all', status: 200, durationMs: 87 });
    await telemetry.flush();
    const events = requests.flatMap((r) => { const b = JSON.parse(r.body); return b.events || [b]; });
    const lat = events.find((e) => e.category === 'latency');
    expect(lat.payload.path).toBe('/events/all');
    expect(lat.payload.durationMs).toBe(87);
  });

  it('is a safe no-op when disabled (no creds)', async () => {
    const sdk = telemetry.initTelemetry({ config: { ...TEST_CONFIG, enabled: false }, startHeartbeat: false, wireBrowser: false, force: true });
    expect(sdk).toBeNull();
    expect(() => { telemetry.heartbeat(); telemetry.screenView('/x'); telemetry.apiLatency({ durationMs: 1 }); telemetry.reportError(new Error('x')); }).not.toThrow();
    const r = await telemetry.flush();
    expect(r.ok).toBe(true);
  });
});
