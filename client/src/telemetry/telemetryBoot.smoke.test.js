/**
 * Boot-path smoke test for the KeepTabs web telemetry (app='keeptabs').
 *
 * Unlike telemetry.test.js (which injects a fake config + sdk), this test drives
 * the REAL boot path the deployed app runs:
 *   initTelemetry() -> resolveTelemetryConfig() -> createTelemetrySdk(real) -> POST
 *
 * It only injects a `transport` (to capture the batched POST instead of hitting
 * the network) and asserts that, given resolved emitter credentials, the app
 * actually emits a heartbeat AND a route-driven screen_view carrying the app's
 * own version. This reproduces the production symptom where keeptabs sends no
 * real usage events: if credentials don't resolve, the SDK is a silent no-op and
 * these assertions fail — surfacing the misconfiguration instead of hiding it.
 *
 * Validates: 3.1, 3.2, 10.1, 17.1, 17.5.
 */

import React from 'react';
import { render, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';

import * as telemetry from './telemetry';
import PageTracker from './PageTracker';
import { resolveTelemetryConfig } from './telemetryConfig';

/** Capture every batched POST the SDK's transport is asked to send. */
function makeCapturingTransport() {
  const requests = [];
  const transport = async ({ url, method, headers, body }) => {
    requests.push({ url, method, headers, body });
    return { ok: true, status: 202 };
  };
  return { transport, requests };
}

/** Flatten captured request bodies into a single list of telemetry events. */
function eventsFrom(requests) {
  return requests.flatMap((r) => {
    const parsed = JSON.parse(r.body);
    return Array.isArray(parsed.events) ? parsed.events : [parsed];
  });
}

function Nav() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/admin/my-events')}>
      go
    </button>
  );
}

describe('keeptabs web telemetry BOOT path (smoke)', () => {
  afterEach(async () => {
    await telemetry.destroyTelemetry();
  });

  it('resolves emitter credentials so telemetry is enabled (not a silent no-op)', () => {
    const cfg = resolveTelemetryConfig();
    // The deployed app MUST resolve a non-empty ingest URL and BOTH emitter
    // credentials, or initTelemetry() disables itself and nothing is ever sent
    // — which is exactly the production symptom (heartbeats/usage never arrive).
    expect(cfg.app).toBe('keeptabs');
    expect(cfg.ingestUrl).toBeTruthy();
    expect(cfg.emitterKeyId).toBeTruthy();
    expect(cfg.emitterKeySecret).toBeTruthy();
    expect(cfg.enabled).toBe(true);
  });

  it('emits a heartbeat with the app version through the real boot path', async () => {
    const { transport, requests } = makeCapturingTransport();
    const sdk = telemetry.initTelemetry({
      transport,
      startHeartbeat: true,
      wireBrowser: false,
      force: true,
    });
    // initTelemetry returns null and stays a no-op when creds are missing.
    expect(sdk).not.toBeNull();
    expect(telemetry.isEnabled()).toBe(true);

    await telemetry.flush();
    const events = eventsFrom(requests);
    const hb = events.find((e) => e.eventType === 'heartbeat');
    expect(hb).toBeDefined();
    expect(hb.app).toBe('keeptabs');
    expect(hb.version).toBeTruthy();
  });

  it('emits a screen_view on route change through PageTracker + real SDK', async () => {
    const { transport, requests } = makeCapturingTransport();
    telemetry.initTelemetry({
      transport,
      startHeartbeat: false,
      wireBrowser: false,
      force: true,
    });

    const { getByText } = render(
      <MemoryRouter initialEntries={['/admin/home']}>
        <PageTracker />
        <Routes>
          <Route path="/admin/home" element={<Nav />} />
          <Route path="/admin/my-events" element={<div>events</div>} />
        </Routes>
      </MemoryRouter>
    );

    act(() => {
      getByText('go').click();
    });

    await telemetry.flush();
    const usage = eventsFrom(requests).filter(
      (e) => e.category === 'usage' && e.usageType === 'screen_view'
    );
    const screens = usage.map((e) => e.payload && e.payload.screen);
    expect(screens).toContain('/admin/home');
    expect(screens).toContain('/admin/my-events');
  });
});
