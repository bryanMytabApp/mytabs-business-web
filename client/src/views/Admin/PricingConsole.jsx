import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { isSuperAdmin } from '../../utils/authUtils';
import {
  pickStripeSubscription,
  reconciliationView,
} from '../../utils/subscriptionStatus';
import {
  PLAN_LEVELS,
  PRODUCT_NAMES,
  planProductMix,
  pricingVersions,
  versionForDate,
} from '../../config/pricingVersions';
import { setHelpRoute } from '../../components/TabsHelp/helpRoute';
import config from '../../config.json';

// ---------------------------------------------------------------------------
// Pricing-admin API base.
//
// IMPORTANT: The 7 pricing-admin endpoints (/admin/pricing/*) are deployed on
// REST API `16psjhr9ni` (us-east-1, stage `prod`). AdminPortal's business/org
// fetches use a DIFFERENT API — `cte36laj2i` in us-east-2 — via its own
// `API_URLS`/`API_URL`. Those pricing endpoints are NOT on the us-east-2 API,
// so the pricing console must NOT reuse AdminPortal's base. We source the base
// from the web client's central config (`config.json` -> backendUrl), which is
// already the us-east-1 `16psjhr9ni/prod` base, rather than hardcoding it. This
// keeps AdminPortal's existing us-east-2 fetches untouched.
// ---------------------------------------------------------------------------
const PRICING_ADMIN_API = (config.backendUrl || '').replace(/\/?$/, '/');

// Whole-dollar formatter for plan prices (e.g. $187, $1,221) — plan amounts are
// always whole dollars on the Price_Card, so 0 decimals reads cleanest.
const centsToDollars = (cents) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : '—';

// Exact 2-decimal formatter for sub-dollar / per-ticket amounts (e.g. $0.89).
// The ticket per-ticket flat is 89 cents; the old code rendered it via
// centsToDollars (0 decimals) which rounded 89¢ to "$1" — this is the $0.89 fix.
// Smart plan-price formatter: whole dollars for round amounts ($187), 2 decimals
// for sub-dollar/cents amounts ($24.98 legacy) so legacy prices render exactly.
const centsToDollarsSmart = (cents) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('en-US', {
        minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
        maximumFractionDigits: 2,
      })
    : '—';

const centsToDollars2 = (cents) =>
  typeof cents === 'number'
    ? (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';

// The version display labels required by Req 12: the pre-migration version
// (2000-01-01) reads "Legacy (pre-migration)"; the migration version (2026-09-01)
// reads "New (2026-09-01)". Any other effectiveDate falls back to the raw date.
// Derive the boundary dates from the config registry (single source of truth) so the
// console follows the go-live cutover automatically — the migration version's
// effectiveDate IS the cutover. Never hardcode the date here.
const PRE_MIGRATION_EFFECTIVE_DATE = pricingVersions[0]
  ? pricingVersions[0].effectiveDate
  : '2000-01-01';
const MIGRATION_EFFECTIVE_DATE = pricingVersions.length
  ? pricingVersions[pricingVersions.length - 1].effectiveDate
  : '2026-09-06';
const versionLabel = (effectiveDate) => {
  if (effectiveDate === PRE_MIGRATION_EFFECTIVE_DATE) return 'Legacy (pre-migration)';
  if (effectiveDate === MIGRATION_EFFECTIVE_DATE) return `New (${MIGRATION_EFFECTIVE_DATE})`;
  return effectiveDate || 'unknown';
};
// Short version label for the combined selector option.
const versionShortLabel = (effectiveDate) => {
  if (effectiveDate === PRE_MIGRATION_EFFECTIVE_DATE) return 'Legacy (pre-migration)';
  if (effectiveDate === MIGRATION_EFFECTIVE_DATE) return 'New';
  return effectiveDate || 'unknown';
};

// The two contract-negotiated products that are togglable per business via the
// contract-addon endpoint. Everything else in a plan is included-by-plan.
const CONTRACT_PRODUCTS = [
  { value: 'ai_discovery', label: PRODUCT_NAMES.ai_discovery, defaultInterval: 'month' },
  { value: 'market_intel', label: PRODUCT_NAMES.market_intel, defaultInterval: 'year' },
];

// Per-step hash slugs for help context. Moving through the wizard pushes
// `/admin-portal#pricing/<slug>` so the TabsHelp panel resolves a distinct,
// PRIVATE help doc per step (mirrors the Settings page's #section hashes and
// EventCreateNew's per-step help hashes).
const STEP_HELP_SLUGS = {
  1: 'business',
  2: 'plan',
  3: 'pricing-price',
  4: 'subscription',
  5: 'addons',
  6: 'review',
};

// The guided workflow steps. Modeled on EventCreateNew's `steps` array
// ([{ n, l }]) rendered as the pc-steps / pc-step-btn pill bar.
const STEPS = [
  { n: 1, l: 'Business' },
  { n: 2, l: 'Plan' },
  { n: 3, l: 'Pricing & Price' },
  { n: 4, l: 'Subscription' },
  { n: 5, l: 'Add-ons' },
  { n: 6, l: 'Review & Apply' },
];

// Read the monthly plan price from the status payload. The endpoint returns
// `activeVersion.plans[LEVEL].monthlyCents`; older/mirror shapes exposed a flat
// `planMonthlyCents[LEVEL]`. Prefer the real endpoint shape, fall back to the
// legacy flat map. (This is the fix for the "$—" bug: the old console only read
// `planMonthlyCents?.[level]`, which the endpoint never returns.)
const planMonthly = (activeVersion, level) => {
  if (!activeVersion) return undefined;
  const fromPlans = activeVersion.plans?.[level]?.monthlyCents;
  if (typeof fromPlans === 'number') return fromPlans;
  return activeVersion.planMonthlyCents?.[level];
};

// Subscription-status helpers (ACTIVE_STRIPE_STATUSES, pickStripeSubscription,
// reconciliationView) now live in ../../utils/subscriptionStatus and are shared
// with AdminPortal's businesses grid so both surfaces read subscription state the
// same way.

// Resolve a stable subscriber/business id from a business row.
const rowSubscriberId = (row) =>
  row?.subscriberId || row?.businessId || row?.userId || row?._id || row?.id || null;

// Resolve the OWNER/payer userId from a candidate row. Subscriptions and the Stripe
// customer are keyed under the owner userId (Business PK), NOT the businessId, so
// the status call sends this as ?userId=<owner> to resolve the real subscription /
// Stripe state. AdminPortal tags rows with `ownerUserId` (= b.userId); we fall back
// to the row's `userId` for older shapes.
const rowOwnerUserId = (row) => row?.ownerUserId || row?.userId || null;

// Short id suffix used to disambiguate identically-named (or nameless) rows.
const shortId = (id) => (id ? String(id).slice(0, 8) : '');

// Resolve a business's DISPLAY name. A row with no real `name` renders an
// explicit placeholder — it must NEVER fall back to `businessName`, the session
// business name, or any logged-in-user value (that bad fallback made every
// nameless stub row show up as the session business, e.g. "UrbanHTX"). Nameless
// rows are labeled "(unnamed business)" so they're obviously not real.
const businessDisplayName = (row) => {
  const name = typeof row?.name === 'string' ? row.name.trim() : '';
  return name || '(unnamed business)';
};

// Is this candidate row an organization (vs a business)? Organization candidates
// are tagged by AdminPortal with `isOrganization: true` (and carry
// subscriberType 'organization'); we treat either marker as authoritative.
const isOrgRow = (row) =>
  row?.isOrganization === true ||
  row?.subscriberType === 'organization' ||
  row?.accountType === 'organization';

// Full picker/label text: display name plus a short id suffix so identically
// named businesses (e.g. "James" x5) and nameless placeholders are distinct.
// Organization candidates get an explicit "(org)" indicator so an admin can see
// at a glance that (e.g.) "Urban HTX" is an organization, not a business.
const businessOptionLabel = (row, id) => {
  const sid = shortId(id ?? rowSubscriberId(row));
  const base = businessDisplayName(row);
  const orgTag = isOrgRow(row) ? ' (org)' : '';
  return sid ? `${base}${orgTag} — ${sid}…` : `${base}${orgTag}`;
};

/**
 * Admin Pricing Console (Req 12, 13) — GUIDED STEPPED WORKFLOW.
 *
 * Rebuilt as a tabbed/stepped wizard modeled on the event creation page
 * (EventCreateNew.jsx): a `STEPS` array rendered as a pc-steps / pc-step-btn
 * pill bar (current = blue, done = green ✓, click a completed step to go back),
 * a `step` state with next/back/goTo, one panel per step, and a running side
 * summary panel (like EventCreateNew's SidePanel). The admin manages ONE
 * selected business/org through the steps:
 *
 *   1. BUSINESS   — pick the business/org; see its current plan / pinned version
 *                   / exempt state AND the read-only Stripe confirmation.
 *   2. PLAN       — choose the plan level; each level shows its product mix.
 *   3. PRICING &  — choose Legacy (pre-migration) vs New (2026-09-01) and see the
 *      PRICE        resulting real price for the chosen plan+version.
 *   4. SUBSCRIPTION — normal subscription vs EXEMPT.
 *   5. ADD-ONS    — optional contract add-ons (AI Discovery / Market
 *                   Intelligence); skippable (Next works with none selected).
 *   6. REVIEW & APPLY — summarize + APPLY via the existing endpoints, then
 *                       re-fetch the Stripe confirmation.
 *
 * All actions use the SAME endpoints as before (status, migrate, exempt,
 * contract-addon, subscriber/{id}/status). Apply's version change goes through
 * POST /admin/pricing/migrate, which preserves the plan LEVEL and only changes
 * the pinned VERSION — a documented limitation surfaced clearly in the UI (there
 * is no level-change endpoint; we do NOT invent one).
 *
 * Global/system controls (author prices to TEST, promote TEST->LIVE, set
 * cutover) live OUTSIDE this per-business flow entirely, in the separate
 * top-level "Pricing System" Admin tab (see PricingSystem.jsx).
 *
 * `selectedSubscribers` are the business rows currently selected in the
 * AdminPortal business grid. `businesses` (optional) is the full row set so the
 * admin can pick any business even without a grid selection. `organizations`
 * (optional) is the ORGANIZATION-type candidate set (accountType 'organization',
 * e.g. "Urban HTX"); these are excluded from the businesses list upstream, so we
 * fold them into the picker here and tag them as orgs so per-business actions
 * can send `subscriberType: 'organization'`. `initialBusinessId` (optional)
 * pre-selects a candidate (e.g. from a per-row "Pricing" action).
 */
const PricingConsole = ({
  selectedSubscribers = [],
  businesses = [],
  organizations = [],
  initialBusinessId = null,
}) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  // Wizard step (1..6). Mirrors EventCreateNew's `step` + next/back/goTo.
  const [step, setStep] = useState(1);

  // The currently-focused business id (the subject of the whole workflow).
  const [activeBusinessId, setActiveBusinessId] = useState(initialBusinessId);

  // Step 2 selection: the chosen plan LEVEL (defaults to the business's current).
  const [selectedLevel, setSelectedLevel] = useState('');
  // Step 3 selection: the chosen pricing VERSION effectiveDate.
  const [selectedVersion, setSelectedVersion] = useState('');
  // Step 4 selection: subscription mode ('subscription' | 'exempt').
  const [subMode, setSubMode] = useState('subscription');

  // The READ-ONLY "confirm via Stripe" status for the selected business
  // (GET /admin/pricing/subscriber/{id}/status). null = not loaded / unknown.
  const [subStatus, setSubStatus] = useState(null);
  const [subStatusLoading, setSubStatusLoading] = useState(false);

  // Confirmation dialog for live-mode actions (Req 12.10).
  const [confirm, setConfirm] = useState(null); // { title, message, onConfirm }

  // Candidate subscribers to operate on: prefer the grid selection of BUSINESSES,
  // fall back to the full business list so the console is usable on its own.
  // ORGANIZATION candidates are always folded in (they never appear in the
  // businesses list upstream, so "Urban HTX" would otherwise be unreachable),
  // de-duped by id alongside businesses and sorted with them alphabetically.
  const candidates = useMemo(() => {
    const businessSrc = selectedSubscribers.length ? selectedSubscribers : businesses;
    const seen = new Set();
    const src = [...(businessSrc || []), ...(organizations || [])];
    return src
      .map((row) => ({ row, id: rowSubscriberId(row), isOrg: isOrgRow(row) }))
      .filter(({ id }) => {
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      // Sort alphabetically by resolved display name (case-insensitive) so the
      // picker is easy to scan. Nameless placeholders start with "(" and sort
      // together near the top, which is fine — they're clearly labeled.
      .sort((a, b) => {
        const an = businessDisplayName(a.row).toLowerCase();
        const bn = businessDisplayName(b.row).toLowerCase();
        return an.localeCompare(bn);
      });
  }, [selectedSubscribers, businesses, organizations]);

  // Keep the active business valid as the candidate set changes. Default to the
  // first candidate so a super-admin lands on a business immediately.
  useEffect(() => {
    if (initialBusinessId && candidates.some((c) => c.id === initialBusinessId)) {
      setActiveBusinessId(initialBusinessId);
      return;
    }
    setActiveBusinessId((prev) => {
      if (prev && candidates.some((c) => c.id === prev)) return prev;
      return candidates[0]?.id || null;
    });
  }, [candidates, initialBusinessId]);

  const activeBusiness = useMemo(
    () => candidates.find((c) => c.id === activeBusinessId)?.row || null,
    [candidates, activeBusinessId]
  );

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

  // READ-ONLY "confirm via Stripe" status for the currently-selected business.
  // Hits GET /admin/pricing/subscriber/{id}/status. Returns { pin, exempt,
  // contractAddons, stripe, reconciliation }. On failure we surface an honest
  // "unknown" state rather than inventing a reconciliation.
  const loadSubStatus = useCallback(
    async (id, ownerUserId = null) => {
      if (!id) {
        setSubStatus(null);
        return;
      }
      setSubStatusLoading(true);
      try {
        // subscriberId (path) stays the business/org id — that's what the pin +
        // exempt lookups key on. The owner/payer userId (Business PK) is passed as
        // ?userId= so the endpoint can resolve the subscription row + Stripe
        // customer, which are keyed under the owner userId, not the businessId.
        const ownerQuery = ownerUserId
          ? `?userId=${encodeURIComponent(ownerUserId)}`
          : '';
        const data = await call(
          `admin/pricing/subscriber/${encodeURIComponent(id)}/status${ownerQuery}`
        );
        setSubStatus(data);
      } catch (err) {
        // Honest unknown state — do NOT fabricate a match/mismatch.
        setSubStatus({ reconciliation: 'unknown', error: err.message || 'failed' });
      } finally {
        setSubStatusLoading(false);
      }
    },
    [call]
  );

  useEffect(() => {
    if (isSuperAdmin() && activeBusinessId) {
      loadSubStatus(activeBusinessId, rowOwnerUserId(activeBusiness));
    } else {
      setSubStatus(null);
    }
  }, [activeBusinessId, activeBusiness, loadSubStatus]);

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

  // ---- Per-business derivations -----------------------------------------

  // Resolve the business's pinned pricing version from its subscription planId.
  // planId = pricingEffectiveDate + planLevel; the effectiveDate is the leading
  // YYYY-MM-DD. Where the row doesn't carry a planId we surface "unknown".
  const businessInfo = useMemo(() => {
    if (!activeBusiness) return null;
    // subStatus is the AUTHORITATIVE, freshly-fetched backend state (pin + exempt +
    // contract add-ons, reconciled against Stripe). Prefer it over the stale
    // AdminPortal row so the panel reflects reality (e.g. an exempt subscription
    // written after the row was loaded) instead of "unknown / Not exempt".
    const statusPlanId =
      (subStatus && subStatus.pin && subStatus.pin.planId) ||
      (subStatus && subStatus.exempt && subStatus.exempt.planId) ||
      null;
    const planId = statusPlanId || activeBusiness.planId || null;
    const pinnedEffectiveDate =
      planId && /^\d{4}-\d{2}-\d{2}/.test(planId) ? planId.slice(0, 10) : activeBusiness.pinnedVersion || null;
    const pinnedVersion =
      pinnedEffectiveDate && versionForDate(pinnedEffectiveDate) ? pinnedEffectiveDate : null;

    // Plan level: from planId suffix, an explicit planLevel/plan field, else null.
    const levelFromPlanId =
      planId && PLAN_LEVELS.find((lvl) => planId.toLowerCase().endsWith(lvl.toLowerCase()));
    const planLevel =
      levelFromPlanId ||
      (PLAN_LEVELS.includes(activeBusiness.planLevel) ? activeBusiness.planLevel : null) ||
      (PLAN_LEVELS.includes(activeBusiness.plan) ? activeBusiness.plan : null);

    const exempt =
      subStatus && subStatus.exempt && typeof subStatus.exempt.exempt === 'boolean'
        ? subStatus.exempt.exempt
        : activeBusiness.exempt === true;
    const statusAddons =
      subStatus && Array.isArray(subStatus.contractAddons)
        ? subStatus.contractAddons.map((a) => a && a.serviceId).filter(Boolean)
        : null;
    const addons = statusAddons && statusAddons.length
      ? statusAddons
      : (Array.isArray(activeBusiness.addons) ? activeBusiness.addons : []);

    // The effective level we render products for when nothing else is chosen:
    // the known plan level, else Starter as a safe default (step 2's selection
    // drives the visible product mix once the admin reaches it).
    const effectiveLevel = planLevel || 'Starter';

    return {
      id: rowSubscriberId(activeBusiness),
      ownerUserId: rowOwnerUserId(activeBusiness),
      name: businessDisplayName(activeBusiness),
      isOrganization: isOrgRow(activeBusiness),
      planId,
      pinnedVersion,
      planLevel,
      effectiveLevel,
      levelIsKnown: !!planLevel,
      exempt,
      addons,
    };
  }, [activeBusiness, subStatus]);

  // Which contract add-ons are currently ON for this business. The AUTHORITATIVE
  // source is the subscriber-status endpoint's `contractAddons` (what's actually in
  // User_Services), refreshed after each assign; fall back to the row's `addons`.
  const assignedAddonIds = useMemo(() => {
    const fromStatus = Array.isArray(subStatus?.contractAddons)
      ? subStatus.contractAddons.map((a) => a && a.serviceId).filter(Boolean)
      : [];
    const fromRow = Array.isArray(businessInfo?.addons) ? businessInfo.addons : [];
    return new Set([...fromStatus, ...fromRow]);
  }, [subStatus, businessInfo]);
  const addonOn = useCallback(
    (product) => assignedAddonIds.has(product),
    [assignedAddonIds]
  );

  // Seed the step selections from the business's current pin whenever the
  // business changes, so the workflow defaults to a no-op unless the admin
  // deliberately changes something (level → current, version → current, subMode
  // → exempt-vs-subscription from the current state).
  useEffect(() => {
    if (!businessInfo) return;
    setSelectedLevel(businessInfo.planLevel || businessInfo.effectiveLevel || 'Starter');
    setSelectedVersion(businessInfo.pinnedVersion || MIGRATION_EFFECTIVE_DATE);
    setSubMode(businessInfo.exempt ? 'exempt' : 'subscription');
  }, [businessInfo]);

  // The monthly price (cents) for a {version, level} pair. NEW version amounts
  // come from the live /admin/pricing/status payload
  // (activeVersion.plans[LEVEL].monthlyCents); other versions' amounts come from
  // the pricing-version registry mirror's planMonthlyCents — NEVER invented.
  const priceForVersionLevel = useCallback(
    (effectiveDate, level) => {
      const statusVersion = status?.activeVersion || null;
      if (statusVersion && statusVersion.effectiveDate === effectiveDate) {
        const fromPlans = statusVersion.plans?.[level]?.monthlyCents;
        if (typeof fromPlans === 'number') return fromPlans;
        const fromFlat = statusVersion.planMonthlyCents?.[level];
        if (typeof fromFlat === 'number') return fromFlat;
      }
      const v = (pricingVersions || []).find((x) => x.effectiveDate === effectiveDate);
      const cents = v?.planMonthlyCents?.[level];
      return typeof cents === 'number' ? cents : null;
    },
    [status]
  );

  // Version options for step 3, New first (so admins land on current pricing).
  const versionOptions = useMemo(
    () =>
      [...(pricingVersions || [])]
        .map((v) => v.effectiveDate)
        .sort((a, b) => (a < b ? 1 : -1)),
    []
  );

  // The price for the CURRENT step selection (chosen level + version).
  const selectedPriceCents = useMemo(
    () => (selectedLevel && selectedVersion ? priceForVersionLevel(selectedVersion, selectedLevel) : null),
    [selectedLevel, selectedVersion, priceForVersionLevel]
  );

  // Is the admin moving a grandfathered (Legacy) customer to the New version?
  const grandfatheredToNew =
    businessInfo?.pinnedVersion === PRE_MIGRATION_EFFECTIVE_DATE &&
    selectedVersion === MIGRATION_EFFECTIVE_DATE;

  // Did the admin pick a different LEVEL than the current pin? migrate preserves
  // level, so this is surfaced as a clear limitation rather than applied.
  const levelChanged =
    !!businessInfo &&
    !!selectedLevel &&
    selectedLevel !== (businessInfo.planLevel || businessInfo.effectiveLevel);

  const versionChanged =
    !!businessInfo && !!selectedVersion && selectedVersion !== businessInfo.pinnedVersion;

  const exemptChanged = !!businessInfo && (subMode === 'exempt') !== businessInfo.exempt;

  // ---- Wizard navigation (mirrors EventCreateNew) -----------------------

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));
  const goTo = (n) => {
    // Only allow navigating to the current step or a completed (earlier) one,
    // just like the Events stepper where ✓ steps are clickable back-nav.
    if (n <= step) setStep(n);
  };

  // Reset to step 1 when the selected business changes.
  useEffect(() => {
    setStep(1);
  }, [activeBusinessId]);

  // Drive the Help panel from the current wizard step. Pushing
  // `/admin-portal#pricing/<slug>` (via replaceState + the help SDK) gives each
  // step its own PRIVATE help doc, the same way the Settings sub-pages and the
  // event-creation wizard do. The parent AdminPortal keeps the tab-level
  // `#pricing` in sync when the Pricing tab is first opened; this narrows it to
  // the active step while the console is mounted.
  useEffect(() => {
    const slug = STEP_HELP_SLUGS[step] || 'business';
    const desiredHash = `#pricing/${slug}`;
    if (window.location.hash !== desiredHash) {
      window.history.replaceState(null, '', window.location.pathname + desiredHash);
    }
    // Buffer + forward to the help SDK. setHelpRoute survives the SDK not being
    // loaded yet (cold/incognito loads) — the route is replayed on boot.
    setHelpRoute(window.location.pathname + desiredHash);
  }, [step]);

  // ---- Per-business actions (target = selected business, no typed ids) ----

  const toggleAddon = (product) => {
    if (!businessInfo) return;
    const cfg = CONTRACT_PRODUCTS.find((p) => p.value === product);
    const turningOn = !addonOn(product);
    // The contract-addon endpoint assigns OR unassigns the add-on for this business.
    // Toggling ON grants the contract entitlement; toggling OFF sends
    // `assigned: false`, which cancels (soft-deletes) it. A contract add-on has no
    // Stripe object, so neither path ever charges/refunds.
    const body = {
      // OWNER/payer userId (Business PK) — the entitlement is keyed by userId +
      // serviceId in User_Services, so the endpoint REQUIRES this (else it 400s).
      userId: businessInfo.ownerUserId,
      businessId: businessInfo.id,
      product,
      interval: cfg?.defaultInterval || 'month',
      assigned: turningOn,
    };
    run(`${turningOn ? 'Assign' : 'Unassign'} ${cfg?.label || product}`, async () => {
      await call('admin/pricing/contract-addon', { method: 'POST', body });
      // Re-fetch the subscriber status so the toggle reflects the new state
      // (assigned add-on appears in contractAddons; an unassigned one no longer does).
      await loadSubStatus(businessInfo.id, businessInfo.ownerUserId);
    });
  };

  // APPLY the full workflow selection at Step 5 (Req 12). Applies the chosen
  // actions via the EXISTING endpoints, behind the live confirmation dialog:
  //   - version change → POST /admin/pricing/migrate { subscriberIds, toEffectiveDate }
  //     (migrate PRESERVES the plan LEVEL — it changes VERSION only; if the admin
  //     picked a different level we say so and do NOT apply it — no invented
  //     level-change endpoint).
  //   - exempt set/clear → POST /admin/pricing/exempt { subscriberId, exempt,
  //     planLevel?, subscriberType? } (org-aware).
  // After apply, RE-FETCH the subscriber status so the Stripe ✓/⚠️ updates.
  const applyWorkflow = () => {
    if (!businessInfo) return;
    if (!versionChanged && !exemptChanged) {
      setError('Nothing to apply — the selection matches this business’s current state.');
      return;
    }

    const parts = [];
    if (versionChanged) {
      parts.push(
        `migrate pinned pricing version to "${versionShortLabel(selectedVersion)}"`
      );
    }
    if (exemptChanged) {
      parts.push(subMode === 'exempt' ? 'set EXEMPT (create a subscription record, exempt from payment; cancels any live Stripe sub)' : 'clear EXEMPT (cut over to paid)');
    }

    const grandfatheredWarning = grandfatheredToNew
      ? ' ⚠️ This customer is currently grandfathered on Legacy pricing — moving them to the New version CHANGES their pricing.'
      : '';
    const levelChangeNote =
      versionChanged && levelChanged
        ? ` NOTE: migrate preserves the plan LEVEL (${businessInfo.planLevel || businessInfo.effectiveLevel || 'unknown'}); it changes the VERSION only. The level change to ${selectedLevel} will NOT be applied by this action.`
        : '';

    requireConfirm(
      '⚠️ Apply plan & pricing (LIVE)',
      `Apply to "${businessInfo.name}": ${parts.join(' and ')}. This affects a real subscription.${grandfatheredWarning}${levelChangeNote}`,
      async () => {
        await run('Apply plan & pricing', async () => {
          if (versionChanged) {
            await call('admin/pricing/migrate', {
              method: 'POST',
              body: { subscriberIds: [businessInfo.id], toEffectiveDate: selectedVersion },
            });
          }
          if (exemptChanged) {
            const nextExempt = subMode === 'exempt';
            await call('admin/pricing/exempt', {
              method: 'POST',
              body: {
                subscriberId: businessInfo.id,
                exempt: nextExempt,
                // The exempt Subscription row + the payer's Stripe customer are keyed
                // under the OWNER userId — pass it so the backend writes the row and
                // (on set-exempt) cancels the payer's existing live Stripe sub (Req 13.9).
                ...(businessInfo.ownerUserId ? { ownerUserId: businessInfo.ownerUserId } : {}),
                ...(businessInfo.isOrganization ? { subscriberType: 'organization' } : {}),
                ...(nextExempt ? { planLevel: selectedLevel || businessInfo.effectiveLevel } : {}),
              },
            });
          }
        });
        // Re-confirm against Stripe after applying, so the ✓/⚠️ indicator updates.
        await loadSubStatus(businessInfo.id, businessInfo.ownerUserId);
      }
    );
  };

  // ---- Render ------------------------------------------------------------

  // Server-side enforces Super_Admin too; this is the UI gate (Req 12.1).
  if (!isSuperAdmin()) {
    return null;
  }

  const activeVersion = status?.activeVersion || status?.version || null;
  const testCutover = status?.cutover?.test ?? status?.testCutoverAt ?? null;
  const liveCutover = status?.cutover?.live ?? status?.liveCutoverAt ?? null;

  // Product mix for the currently-selected plan level (step 2/6) — falls back to
  // the business's effective level so the list is always populated.
  const mixLevel = selectedLevel || businessInfo?.effectiveLevel || 'Starter';
  const productMix = planProductMix[mixLevel] || [];

  // The Stripe reconciliation indicator, shared by step 1 and step 6.
  const renderStripeConfirm = () => (
    <div className="pricing-stripe-confirm" data-testid="business-stripe-confirm" style={{ marginTop: 8 }}>
      {subStatusLoading ? (
        <span data-testid="stripe-confirm-loading">Confirming with Stripe…</span>
      ) : subStatus ? (
        (() => {
          const rv = reconciliationView(subStatus);
          // Highlight the representative Stripe subscription — active-ish when there
          // is one, otherwise the canceled/expired sub so a stale-active mismatch
          // still shows the real Stripe status + amount (never hidden as "none").
          const liveSub = pickStripeSubscription(subStatus.stripe);
          return (
            <>
              <Chip
                size="small"
                color={rv.color}
                variant={rv.color === 'default' ? 'outlined' : 'filled'}
                label={`${rv.icon} ${rv.text}`}
                data-testid="stripe-reconciliation"
                data-reconciliation={subStatus.reconciliation || 'unknown'}
              />
              {liveSub && liveSub.status ? (
                <span
                  className="pricing-status-meta"
                  data-testid="stripe-subscription-detail"
                  style={{ marginLeft: 8 }}
                >
                  Stripe: {liveSub.status}
                  {typeof liveSub.unitAmount === 'number'
                    ? ` · $${centsToDollars2(liveSub.unitAmount)}/${liveSub.interval || 'mo'}`
                    : ''}
                  {liveSub.priceId ? ` · ${liveSub.priceId}` : ''}
                </span>
              ) : (
                <span
                  className="pricing-status-meta"
                  data-testid="stripe-subscription-none"
                  style={{ marginLeft: 8 }}
                >
                  {subStatus.reconciliation === 'exempt-no-subscription'
                    ? 'No Stripe subscription (expected for exempt)'
                    : 'No live Stripe subscription'}
                </span>
              )}
            </>
          );
        })()
      ) : (
        <span data-testid="stripe-confirm-unknown">Stripe status not loaded.</span>
      )}
    </div>
  );

  // A completed step is any step BEFORE the current one AND a business is chosen.
  const stepIsDone = (n) => n < step && !!businessInfo;

  return (
    <Box className="pricing-console" data-testid="pricing-console" sx={{ p: 1 }}>
      {notice && (
        <div className="pricing-console-notice" data-testid="pricing-notice">{notice}</div>
      )}
      {error && (
        <div className="pricing-console-error" data-testid="pricing-error">{error}</div>
      )}

      {/* Active pricing version moved to the right sidebar, below Your selection. */}

      {/* STEP BAR — mirrors EventCreateNew's ecn-steps / ecn-step-btn pill bar:
          current step = blue, completed = green ✓, click a completed step to
          navigate back to it (goTo). */}
      <div className="pc-steps" data-testid="pc-steps">
        {STEPS.map((s) => (
          <button
            key={s.n}
            type="button"
            className={`pc-step-btn${step === s.n ? ' cur' : stepIsDone(s.n) ? ' done' : ''}`}
            data-testid={`pc-step-${s.n}`}
            data-step={s.n}
            onClick={() => goTo(s.n)}
          >
            {stepIsDone(s.n) ? '\u2713 ' : ''}
            {s.l}
          </button>
        ))}
      </div>

      <div className="pc-layout">
        <div className="pc-main">
          {/* ─────────────── STEP 1 — BUSINESS ─────────────── */}
          {step === 1 && (
            <section className="pricing-panel" data-testid="pc-panel-1">
              <h3>Step 1 · Select business</h3>
              {candidates.length === 0 ? (
                <div data-testid="pricing-no-business" style={{ color: '#666', fontSize: 14 }}>
                  No business selected. Select one or more businesses in the grid (or open the pricing view from a
                  business row) to manage its pricing here.
                </div>
              ) : (
                <TextField
                  select
                  label="Managing business"
                  size="small"
                  value={activeBusinessId || ''}
                  onChange={(e) => setActiveBusinessId(e.target.value)}
                  sx={{ minWidth: 320 }}
                  data-testid="business-select"
                >
                  {candidates.map(({ row, id }) => (
                    <MenuItem key={id} value={id} data-testid={`business-option-${id}`}>
                      {businessOptionLabel(row, id)}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {businessInfo && (
                <div className="pricing-business-detail" data-testid="pricing-business-detail" style={{ marginTop: 16 }}>
                  <div className="pricing-business-head">
                    <div>
                      <h3 style={{ margin: 0 }} data-testid="business-detail-name">{businessInfo.name}</h3>
                      <div className="pricing-business-id" data-testid="business-detail-id">id: {businessInfo.id}</div>
                    </div>
                    <div className="pricing-business-badges">
                      {businessInfo.isOrganization && (
                        <Chip size="small" color="secondary" label="Organization" data-testid="business-org-badge" />
                      )}
                      {businessInfo.levelIsKnown ? (
                        <Chip size="small" color="primary" label={`Plan: ${businessInfo.planLevel}`} data-testid="business-plan-level" />
                      ) : (
                        <Chip size="small" variant="outlined" label="Plan: unknown" data-testid="business-plan-unknown" />
                      )}
                      <Chip
                        size="small"
                        variant="outlined"
                        label={`Version: ${businessInfo.pinnedVersion || 'unknown'}`}
                        data-testid="business-pinned-version"
                      />
                      <Chip
                        size="small"
                        color={businessInfo.exempt ? 'warning' : 'default'}
                        variant={businessInfo.exempt ? 'filled' : 'outlined'}
                        label={businessInfo.exempt ? 'Exempt' : 'Not exempt'}
                        data-testid="business-exempt-badge"
                      />
                    </div>
                  </div>

                  <Divider sx={{ my: 1.5 }} />
                  <div className="pricing-current-state" data-testid="business-current-state">
                    <h4 style={{ margin: '0 0 6px' }}>Current state</h4>
                    <div className="pricing-status-grid">
                      <span className="pricing-status-meta">
                        <strong>Plan:</strong> {businessInfo.levelIsKnown ? businessInfo.planLevel : 'unknown'}
                      </span>
                      <span className="pricing-status-meta">
                        <strong>Version:</strong>{' '}
                        <span data-testid="business-version-label">
                          {businessInfo.pinnedVersion ? versionLabel(businessInfo.pinnedVersion) : 'unknown'}
                        </span>
                      </span>
                      <span className="pricing-status-meta">
                        <strong>Exempt:</strong> {businessInfo.exempt ? 'yes' : 'no'}
                      </span>
                    </div>
                    {/* READ-ONLY Stripe reconciliation indicator. */}
                    {renderStripeConfirm()}
                  </div>
                </div>
              )}

              <div className="pc-foot">
                <span />
                <Button
                  variant="contained"
                  onClick={next}
                  disabled={!businessInfo}
                  sx={{ textTransform: 'none' }}
                  data-testid="pc-next"
                >
                  Next →
                </Button>
              </div>
            </section>
          )}

          {/* ─────────────── STEP 2 — PLAN ─────────────── */}
          {step === 2 && businessInfo && (
            <section className="pricing-panel pricing-panel--scroll" data-testid="pc-panel-2">
              <h3>Step 2 · Choose plan level</h3>
              <p className="pricing-inline-note" style={{ marginTop: 0 }}>
                Pick the plan level for <strong>{businessInfo.name}</strong>. Each plan shows what’s included (its
                product mix). Defaults to the business’s current level when known.
              </p>
              <div className="pc-choice-grid" data-testid="plan-level-cards">
                {PLAN_LEVELS.map((level) => {
                  const cents = priceForVersionLevel(selectedVersion || MIGRATION_EFFECTIVE_DATE, level);
                  const mix = planProductMix[level] || [];
                  return (
                    <button
                      key={level}
                      type="button"
                      className={`pc-choice${selectedLevel === level ? ' sel' : ''}`}
                      data-testid={`plan-level-${level}`}
                      onClick={() => setSelectedLevel(level)}
                    >
                      <div className="pc-choice-title">{level}</div>
                      <div className="pc-choice-price">
                        {typeof cents === 'number' ? `$${centsToDollarsSmart(cents)}/mo` : '$—/mo'}
                      </div>
                      <div className="pc-choice-sub">{mix.length} products included</div>
                    </button>
                  );
                })}
              </div>

              <Divider sx={{ my: 1.5 }} />
              <h4 style={{ margin: '0 0 6px' }}>
                Included products{' '}
                <span style={{ fontWeight: 400, color: '#666', fontSize: 13 }}>(via {mixLevel} plan)</span>
              </h4>
              <div className="pricing-product-scroll">
                <ul className="pricing-product-list" data-testid="business-product-list">
                  {productMix.map((pid) => (
                    <li key={pid} className="pricing-product-item" data-testid={`product-${pid}`}>
                      <CheckCircleIcon fontSize="small" color="success" />
                      <span>{PRODUCT_NAMES[pid] || pid}</span>
                      <Chip size="small" variant="outlined" label={`via ${mixLevel}`} sx={{ ml: 'auto', fontSize: 10 }} />
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pc-foot">
                <Button variant="outlined" onClick={back} sx={{ textTransform: 'none' }} data-testid="pc-back">
                  ← Back
                </Button>
                <Button variant="contained" onClick={next} sx={{ textTransform: 'none' }} data-testid="pc-next">
                  Next →
                </Button>
              </div>
            </section>
          )}

          {/* ─────────────── STEP 3 — PRICING VERSION & PRICE ─────────────── */}
          {step === 3 && businessInfo && (
            <section className="pricing-panel" data-testid="pc-panel-3">
              <h3>Step 3 · Pricing version &amp; price</h3>
              <p className="pricing-inline-note" style={{ marginTop: 0 }}>
                Choose the pricing version. The resulting monthly price for the chosen plan ({selectedLevel || mixLevel})
                is shown from real sources — New from the live status endpoint, Legacy from the registry mirror.
              </p>
              <div className="pc-choice-grid" data-testid="version-cards">
                {versionOptions.map((ed) => {
                  const cents = priceForVersionLevel(ed, selectedLevel || mixLevel);
                  return (
                    <button
                      key={ed}
                      type="button"
                      className={`pc-choice${selectedVersion === ed ? ' sel' : ''}`}
                      data-testid={`version-${ed}`}
                      onClick={() => setSelectedVersion(ed)}
                    >
                      <div className="pc-choice-title">{versionLabel(ed)}</div>
                      <div className="pc-choice-price" data-testid={`version-price-${ed}`}>
                        {typeof cents === 'number' ? `$${centsToDollarsSmart(cents)}/mo` : '$—/mo'}
                      </div>
                      <div className="pc-choice-sub">{selectedLevel || mixLevel} · effective {ed}</div>
                    </button>
                  );
                })}
              </div>

              <div className="pricing-status-meta" data-testid="selected-price" style={{ marginTop: 12 }}>
                <strong>Selected:</strong> {versionShortLabel(selectedVersion)} — {selectedLevel || mixLevel} —{' '}
                {typeof selectedPriceCents === 'number' ? `$${centsToDollarsSmart(selectedPriceCents)}/mo` : '$—/mo'}
              </div>

              {grandfatheredToNew && (
                <div className="pc-warn" data-testid="grandfathered-warning">
                  ⚠️ This customer is currently grandfathered on Legacy pricing. Moving them to the New version
                  CHANGES their pricing.
                </div>
              )}

              <div className="pc-foot">
                <Button variant="outlined" onClick={back} sx={{ textTransform: 'none' }} data-testid="pc-back">
                  ← Back
                </Button>
                <Button variant="contained" onClick={next} sx={{ textTransform: 'none' }} data-testid="pc-next">
                  Next →
                </Button>
              </div>
            </section>
          )}

          {/* ─────────────── STEP 4 — SUBSCRIPTION / EXEMPT ─────────────── */}
          {step === 4 && businessInfo && (
            <section className="pricing-panel" data-testid="pc-panel-4">
              <h3>Step 4 · Subscription or exempt</h3>
              <p className="pricing-inline-note" style={{ marginTop: 0 }}>
                Choose how this business is on the plan: a normal paid subscription, or EXEMPT — a real subscription
                record is created that the system is exempt from charging (no Stripe charge; any existing live Stripe
                subscription is cancelled).
              </p>
              <div className="pc-choice-grid" data-testid="sub-mode-cards">
                <button
                  type="button"
                  className={`pc-choice${subMode === 'subscription' ? ' sel' : ''}`}
                  data-testid="sub-mode-subscription"
                  onClick={() => setSubMode('subscription')}
                >
                  <div className="pc-choice-title">Normal subscription</div>
                  <div className="pc-choice-sub">Pinned to the selected version via migrate; billed via Stripe.</div>
                </button>
                <button
                  type="button"
                  className={`pc-choice${subMode === 'exempt' ? ' sel' : ''}`}
                  data-testid="sub-mode-exempt"
                  onClick={() => setSubMode('exempt')}
                >
                  <div className="pc-choice-title">Exempt (no charge)</div>
                  <div className="pc-choice-sub">Real subscription record, exempt from payment — full plan access, no charge.</div>
                </button>
              </div>

              <div className="pc-foot">
                <Button variant="outlined" onClick={back} sx={{ textTransform: 'none' }} data-testid="pc-back">
                  ← Back
                </Button>
                <Button variant="contained" onClick={next} sx={{ textTransform: 'none' }} data-testid="pc-next">
                  Next →
                </Button>
              </div>
            </section>
          )}

          {/* ─────────────── STEP 5 — CONTRACT ADD-ONS (optional) ─────────────── */}
          {step === 5 && businessInfo && (
            <section className="pricing-panel" data-testid="pc-panel-5">
              <h3>Step 5 · Contract add-ons (optional)</h3>
              <p className="pricing-inline-note" style={{ marginTop: 0 }}>
                Optionally assign contract-negotiated add-ons for <strong>{businessInfo.name}</strong>. Add-ons are
                optional — you can continue to Review with none selected.
              </p>
              <div className="pricing-addon-toggles" data-testid="business-addon-toggles">
                {CONTRACT_PRODUCTS.map((p) => (
                  <FormControlLabel
                    key={p.value}
                    control={
                      <Switch
                        checked={addonOn(p.value)}
                        onChange={() => toggleAddon(p.value)}
                        disabled={busy}
                        data-testid={`addon-toggle-${p.value}`}
                      />
                    }
                    label={`${p.label} (${addonOn(p.value) ? 'assigned' : 'not assigned'})`}
                  />
                ))}
              </div>
              <p className="pricing-inline-note">
                Contract add-ons are granted at a negotiated price and billed via the signed contract (not
                auto-charged). Assigning one takes effect immediately via the contract-addon endpoint.
              </p>

              <div className="pc-foot">
                <Button variant="outlined" onClick={back} sx={{ textTransform: 'none' }} data-testid="pc-back">
                  ← Back
                </Button>
                <Button variant="contained" onClick={next} sx={{ textTransform: 'none' }} data-testid="pc-next">
                  Next →
                </Button>
              </div>
            </section>
          )}

          {/* ─────────────── STEP 6 — REVIEW & APPLY ─────────────── */}
          {step === 6 && businessInfo && (
            <section className="pricing-panel" data-testid="pc-panel-6">
              <h3>Step 6 · Review &amp; apply</h3>
              <div className="pricing-status-grid" data-testid="review-summary">
                <span className="pricing-status-meta">
                  <strong>Business:</strong> {businessInfo.name}
                  {businessInfo.isOrganization ? ' (org)' : ''}
                </span>
                <span className="pricing-status-meta">
                  <strong>Plan:</strong> {selectedLevel || mixLevel}
                  {levelChanged && (
                    <em style={{ color: '#6d4c00' }}> (level change not applied — see note below)</em>
                  )}
                </span>
                <span className="pricing-status-meta">
                  <strong>Pricing version:</strong> {versionLabel(selectedVersion)} —{' '}
                  {typeof selectedPriceCents === 'number' ? `$${centsToDollarsSmart(selectedPriceCents)}/mo` : '$—/mo'}
                </span>
                <span className="pricing-status-meta">
                  <strong>Subscription:</strong>{' '}
                  {subMode === 'exempt' ? 'Subscription created · exempt from payment (no charge)' : 'Normal subscription'}
                </span>
                <span className="pricing-status-meta">
                  <strong>Contract add-ons:</strong>{' '}
                  {(businessInfo.addons || []).length
                    ? businessInfo.addons
                        .map((a) => CONTRACT_PRODUCTS.find((p) => p.value === a)?.label || a)
                        .join(', ')
                    : 'none'}
                </span>
              </div>

              {grandfatheredToNew && (
                <div className="pc-warn" data-testid="grandfathered-warning">
                  ⚠️ This customer is currently grandfathered on Legacy pricing. Applying the New version CHANGES
                  their pricing.
                </div>
              )}
              {versionChanged && levelChanged && (
                <div className="pc-warn" data-testid="level-change-note">
                  Note: the migrate endpoint preserves the plan LEVEL and changes the VERSION only. The selected
                  level ({selectedLevel}) will NOT be applied — there is no level-change endpoint from this console.
                </div>
              )}

              <Divider sx={{ my: 1.5 }} />
              <h4 style={{ margin: '0 0 6px' }}>Confirm via Stripe</h4>
              {renderStripeConfirm()}

              <div className="pc-foot">
                <Button variant="outlined" onClick={back} sx={{ textTransform: 'none' }} data-testid="pc-back">
                  ← Back
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={applyWorkflow}
                  disabled={busy}
                  sx={{ textTransform: 'none' }}
                  data-testid="pc-apply"
                >
                  Apply (LIVE)
                </Button>
              </div>
            </section>
          )}
        </div>

        {/* RUNNING SIDE SUMMARY — mirrors EventCreateNew's SidePanel. */}
        <aside className="pc-side" data-testid="pc-side-summary">
          <div className="pc-side-card">
            <p className="pc-side-title">Your selection</p>
            {businessInfo ? (
              <>
                <div className="pc-side-row">
                  <span className="pc-side-l">Business</span>
                  <span className="pc-side-v" data-testid="side-business">
                    {businessInfo.name}
                    {businessInfo.isOrganization ? ' (org)' : ''}
                  </span>
                </div>
                <div className="pc-side-row">
                  <span className="pc-side-l">Plan</span>
                  <span className="pc-side-v" data-testid="side-plan">{selectedLevel || mixLevel}</span>
                </div>
                <div className="pc-side-row">
                  <span className="pc-side-l">Version</span>
                  <span className="pc-side-v" data-testid="side-version">{versionShortLabel(selectedVersion)}</span>
                </div>
                <div className="pc-side-row">
                  <span className="pc-side-l">Price</span>
                  <span className="pc-side-v" data-testid="side-price">
                    {typeof selectedPriceCents === 'number' ? `$${centsToDollarsSmart(selectedPriceCents)}/mo` : '$—/mo'}
                  </span>
                </div>
                <div className="pc-side-row">
                  <span className="pc-side-l">Subscription</span>
                  <span className="pc-side-v" data-testid="side-submode">
                    {subMode === 'exempt' ? 'Exempt' : 'Subscription'}
                  </span>
                </div>
              </>
            ) : (
              <div style={{ color: '#8a9ab0', fontSize: 13 }} data-testid="side-empty">
                Pick a business to start.
              </div>
            )}
          </div>

          {/* ACTIVE PRICING VERSION — system reference, below the selection. */}
          <div className="pc-side-card" data-testid="pricing-status-panel" style={{ marginTop: 12 }}>
            <div className="pricing-status-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="pc-side-title" style={{ margin: 0 }}>Active pricing version</p>
              <Button size="small" onClick={loadStatus} disabled={loading || busy} sx={{ textTransform: 'none', minWidth: 0, p: '2px 6px' }}>
                🔄
              </Button>
            </div>
            {loading ? (
              <div data-testid="pricing-status-loading" style={{ fontSize: 12, color: '#8a9ab0' }}>Loading…</div>
            ) : activeVersion ? (
              <div className="pricing-status-grid" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="pricing-status-meta" style={{ fontSize: 12 }}>
                  <strong>Effective:</strong> {activeVersion.effectiveDate || '—'}
                </span>
                <span className="pricing-status-meta" style={{ fontSize: 12 }}>
                  <strong>Ticket fee:</strong>{' '}
                  {activeVersion.ticketFee
                    ? `${activeVersion.ticketFee.percent}% + $${centsToDollars2(activeVersion.ticketFee.perTicketCents)}/ticket`
                    : '—'}
                </span>
                <div className="pricing-plan-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
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
                <span className="pricing-status-meta" style={{ fontSize: 12 }}>
                  <strong>Contract:</strong>{' '}
                  {PRODUCT_NAMES.ai_discovery}: ${centsToDollars(activeVersion.aiDiscovery?.baselineCents)}/
                  {activeVersion.aiDiscovery?.interval || 'month'}
                  {' · '}
                  {PRODUCT_NAMES.market_intel}: ${centsToDollars(activeVersion.marketIntel?.baselineCents)}/
                  {activeVersion.marketIntel?.interval || 'year'}
                </span>
                <div className="pricing-plan-chips" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <Chip size="small" label={`Cutover test: ${testCutover || '—'}`} data-testid="cutover-test" />
                  <Chip size="small" color="error" variant="outlined" label={`Cutover live: ${liveCutover || '—'}`} data-testid="cutover-live" />
                </div>
              </div>
            ) : (
              <div data-testid="pricing-status-empty" style={{ fontSize: 12, color: '#8a9ab0' }}>No active pricing version available.</div>
            )}
          </div>
        </aside>
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

export default PricingConsole;
