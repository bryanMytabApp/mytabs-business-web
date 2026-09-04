import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { isSuperAdmin } from '../../utils/authUtils';
import { PLAN_LEVELS, PRODUCT_NAMES } from '../../config/pricingVersions';
import config from '../../config.json';

// ---------------------------------------------------------------------------
// Pricing-admin API base.
//
// System-wide pricing controls hit the SAME us-east-1 REST API (`16psjhr9ni`,
// stage `prod`) as the per-business Pricing Console. We source the base from the
// web client's central config (`config.json` -> backendUrl), which is already
// the us-east-1 `16psjhr9ni/prod` base, rather than hardcoding it. This mirrors
// PricingConsole exactly — no us-east-2 usage.
// ---------------------------------------------------------------------------
const PRICING_ADMIN_API = (config.backendUrl || '').replace(/\/?$/, '/');

// Whole-dollar formatter for plan prices (e.g. $187, $1,221).
const centsToDollars = (cents) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '—';

// Exact 2-decimal formatter for sub-dollar / per-ticket amounts (e.g. $0.89).
const centsToDollars2 = (cents) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

const MODES = [
  { value: 'test', label: 'Test' },
  { value: 'live', label: 'Live' },
];

// Read the monthly plan price from the status payload. Prefer the real endpoint
// shape (activeVersion.plans[LEVEL].monthlyCents), fall back to the legacy flat
// map (planMonthlyCents[LEVEL]).
const planMonthly = (activeVersion, level) => {
  if (!activeVersion) return undefined;
  const fromPlans = activeVersion.plans?.[level]?.monthlyCents;
  if (typeof fromPlans === 'number') return fromPlans;
  return activeVersion.planMonthlyCents?.[level];
};

/**
 * Pricing System (Admin, system-wide) — extracted from PricingConsole's former
 * "Pricing System (Advanced)" accordion into its own top-level Admin tab.
 *
 * These controls are SYSTEM-wide (not per-business):
 *   - Active pricing version status (GET /admin/pricing/status)
 *   - Author prices to Stripe TEST     (PUT  /admin/pricing/version/{date} { mode: 'test' })
 *   - Promote TEST → LIVE              (POST /admin/pricing/version/{date}/promote)
 *   - Set cutover (new signups only)   (PUT  /admin/pricing/cutover { mode, cutoverAt })
 *
 * Endpoints/logic are IDENTICAL to the previous accordion — only relocated.
 * Super-admin gate, us-east-1 base + bearer token, and the live-mode
 * confirmation dialogs (promote / live cutover) are all preserved.
 */
const PricingSystem = () => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Global/system controls.
  const [authorDate, setAuthorDate] = useState('');
  const [cutoverMode, setCutoverMode] = useState('test');
  const [cutoverAt, setCutoverAt] = useState('');

  // Confirmation dialog for live-mode actions (Req 12.10). { title, message, onConfirm }
  const [confirm, setConfirm] = useState(null);

  const authHeaders = useCallback((withJson = false) => {
    const idToken = localStorage.getItem('idToken');
    const headers = { Authorization: `Bearer ${idToken}` };
    if (withJson) headers['Content-Type'] = 'application/json';
    return headers;
  }, []);

  const call = useCallback(
    async (path, { method = 'GET', body } = {}) => {
      const res = await fetch(`${PRICING_ADMIN_API}${path}`, {
        method,
        headers: authHeaders(!!body),
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    },
    [authHeaders]
  );

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await call('admin/pricing/status');
      setStatus(data);
    } catch (err) {
      setError(err.message || 'Failed to load pricing status');
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    // Only super-admins load pricing status (UI gate mirrors the server-side
    // Super_Admin authorization). Non-super-admins render nothing and make no call.
    if (isSuperAdmin()) {
      loadStatus();
    }
  }, [loadStatus]);

  const run = useCallback(
    async (label, fn) => {
      setBusy(true);
      setNotice(null);
      setError(null);
      try {
        await fn();
        setNotice(`${label} succeeded.`);
        await loadStatus();
      } catch (err) {
        setError(`${label} failed: ${err.message || 'unknown error'}`);
      } finally {
        setBusy(false);
        setConfirm(null);
      }
    },
    [loadStatus]
  );

  const requireConfirm = (title, message, onConfirm) =>
    setConfirm({ title, message, onConfirm });

  // ---- System actions ----------------------------------------------------

  const authorPrices = () => {
    if (!authorDate) {
      setError('Enter an effective date (YYYY-MM-DD) to author test prices.');
      return;
    }
    requireConfirm(
      'Author test prices',
      `Author + provision prices for version ${authorDate} to Stripe TEST mode?`,
      () =>
        run('Author test prices', () =>
          call(`admin/pricing/version/${encodeURIComponent(authorDate)}`, {
            method: 'PUT',
            body: { mode: 'test' },
          })
        )
    );
  };

  const promoteToLive = () => {
    if (!authorDate) {
      setError('Enter the effective date of the version to promote to LIVE.');
      return;
    }
    requireConfirm(
      '⚠️ Promote to LIVE',
      `This is a LIVE-mode action. Provision version ${authorDate} to Stripe LIVE and record live price ids? This affects real billing.`,
      () =>
        run('Promote to LIVE', () =>
          call(`admin/pricing/version/${encodeURIComponent(authorDate)}/promote`, { method: 'POST' })
        )
    );
  };

  const setCutover = () => {
    if (!cutoverAt) {
      setError('Enter a cutover date/time.');
      return;
    }
    const doIt = () =>
      run('Set cutover', () =>
        call('admin/pricing/cutover', { method: 'PUT', body: { mode: cutoverMode, cutoverAt } })
      );
    if (cutoverMode === 'live') {
      requireConfirm(
        '⚠️ Set LIVE cutover',
        `This is a LIVE-mode action. Set the LIVE cutover to ${cutoverAt}? It affects ONLY new signups, never existing customers.`,
        doIt
      );
    } else {
      doIt();
    }
  };

  // ---- Render ------------------------------------------------------------

  // Server-side enforces Super_Admin too; this is the UI gate (Req 12.1).
  if (!isSuperAdmin()) {
    return null;
  }

  const activeVersion = status?.activeVersion || status?.version || null;
  const testCutover = status?.cutover?.test ?? status?.testCutoverAt ?? null;
  const liveCutover = status?.cutover?.live ?? status?.liveCutoverAt ?? null;

  const inputSx = { m: 0.5, minWidth: 180 };

  return (
    <Box className="pricing-system" data-testid="pricing-system" sx={{ p: 1 }}>
      <h2 style={{ marginTop: 0 }}>Pricing System</h2>
      <p style={{ color: '#666', marginTop: 0 }}>
        System-wide pricing controls: review the active pricing version, author prices to Stripe TEST, promote
        TEST → LIVE, and set the cutover date (affects new signups only). These are not per-business.
      </p>

      {notice && (
        <div className="pricing-console-notice" data-testid="pricing-system-notice">{notice}</div>
      )}
      {error && (
        <div className="pricing-console-error" data-testid="pricing-system-error">{error}</div>
      )}

      {/* Active-version status (GET /admin/pricing/status). */}
      <section className="pricing-panel pricing-status-compact" data-testid="pricing-status-panel">
        <div className="pricing-status-head">
          <h3 style={{ margin: 0 }}>Active pricing version</h3>
          <Button size="small" onClick={loadStatus} disabled={loading || busy} sx={{ textTransform: 'none' }}>
            🔄 Refresh
          </Button>
        </div>
        {loading ? (
          <div data-testid="pricing-status-loading">Loading pricing status…</div>
        ) : activeVersion ? (
          <div className="pricing-status-grid">
            <span className="pricing-status-meta">
              <strong>Effective:</strong> {activeVersion.effectiveDate || '—'}
            </span>
            <span className="pricing-status-meta">
              <strong>Ticket fee:</strong>{' '}
              {activeVersion.ticketFee
                ? `${activeVersion.ticketFee.percent}% + $${centsToDollars2(activeVersion.ticketFee.perTicketCents)}/ticket`
                : '—'}
            </span>
            <div className="pricing-plan-chips">
              {PLAN_LEVELS.map((level) => (
                <Chip
                  key={level}
                  size="small"
                  variant="outlined"
                  label={`${level}: $${centsToDollars(planMonthly(activeVersion, level))}/mo`}
                  data-testid={`plan-price-${level.toLowerCase()}`}
                />
              ))}
            </div>
            <span className="pricing-status-meta">
              <strong>Contract baselines:</strong>{' '}
              {PRODUCT_NAMES.ai_discovery}: ${centsToDollars(activeVersion.aiDiscovery?.baselineCents)}/
              {activeVersion.aiDiscovery?.interval || 'month'}
              {' · '}
              {PRODUCT_NAMES.market_intel}: ${centsToDollars(activeVersion.marketIntel?.baselineCents)}/
              {activeVersion.marketIntel?.interval || 'year'}
            </span>
            <div className="pricing-plan-chips">
              <Chip size="small" label={`Cutover test: ${testCutover || '—'}`} data-testid="cutover-test" />
              <Chip size="small" color="error" variant="outlined" label={`Cutover live: ${liveCutover || '—'}`} data-testid="cutover-live" />
            </div>
          </div>
        ) : (
          <div data-testid="pricing-status-empty">No active pricing version available.</div>
        )}
      </section>

      {/* Author + promote */}
      <div className="pricing-advanced-block" data-testid="pricing-author-panel">
        <h4 style={{ marginTop: 0 }}>Author prices (test) &amp; promote</h4>
        <TextField
          label="Effective date (YYYY-MM-DD)"
          size="small"
          value={authorDate}
          onChange={(e) => setAuthorDate(e.target.value)}
          sx={inputSx}
          inputProps={{ 'data-testid': 'author-date-input' }}
        />
        <Button variant="outlined" onClick={authorPrices} disabled={busy} sx={{ textTransform: 'none', m: 0.5 }} data-testid="author-btn">
          Author to Stripe TEST
        </Button>
        <Button variant="contained" color="error" onClick={promoteToLive} disabled={busy} sx={{ textTransform: 'none', m: 0.5 }} data-testid="promote-btn">
          Promote TEST → LIVE
        </Button>
      </div>

      {/* Cutover */}
      <div className="pricing-advanced-block" data-testid="pricing-cutover-panel">
        <h4>Set cutover (affects new signups only)</h4>
        <TextField select label="Mode" size="small" value={cutoverMode} onChange={(e) => setCutoverMode(e.target.value)} sx={inputSx} data-testid="cutover-mode-select">
          {MODES.map((m) => (
            <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Cutover at (ISO date/time)"
          size="small"
          value={cutoverAt}
          onChange={(e) => setCutoverAt(e.target.value)}
          sx={inputSx}
          inputProps={{ 'data-testid': 'cutover-at-input' }}
        />
        <Button
          variant={cutoverMode === 'live' ? 'contained' : 'outlined'}
          color={cutoverMode === 'live' ? 'error' : 'primary'}
          onClick={setCutover}
          disabled={busy}
          sx={{ textTransform: 'none', m: 0.5 }}
          data-testid="cutover-btn"
        >
          Set {cutoverMode} cutover
        </Button>
      </div>

      {/* Explicit confirmation dialog for live-mode actions (Req 12.10) */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} data-testid="pricing-confirm-dialog">
        <DialogTitle>{confirm?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirm?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} sx={{ textTransform: 'none' }} data-testid="confirm-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => confirm?.onConfirm && confirm.onConfirm()}
            color="error"
            variant="contained"
            disabled={busy}
            sx={{ textTransform: 'none' }}
            data-testid="confirm-proceed"
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PricingSystem;
