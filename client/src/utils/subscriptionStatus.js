// ---------------------------------------------------------------------------
// Shared subscription-status helpers.
//
// These interpret the READ-ONLY "confirm via Stripe" payload returned by
// GET /admin/pricing/subscriber/{id}/status ({ pin, exempt, contractAddons,
// stripe, reconciliation }). They were originally private to PricingConsole.jsx;
// they now live here so AdminPortal's businesses grid can surface the SAME
// notion of an active subscription that the Pricing Console uses, instead of
// re-deriving it from the lighter /subscription/{userId} payload.
// ---------------------------------------------------------------------------

// The live Stripe statuses that count as "still running" (active-ish). A sub in
// any OTHER status (canceled, incomplete_expired, …) is not currently billing.
export const ACTIVE_STRIPE_STATUSES = ['active', 'trialing', 'past_due', 'unpaid', 'paused'];

// Pick the single Stripe subscription to highlight. The backend now returns
// `stripe.subscription` (the representative one — active-ish else the
// canceled/expired one). Fall back to scanning the list for older payload
// shapes, preferring an active-ish sub but NEVER hiding a canceled one.
export const pickStripeSubscription = (stripe) => {
  if (!stripe) return null;
  if (stripe.subscription) return stripe.subscription;
  const subs = Array.isArray(stripe.subscriptions) ? stripe.subscriptions : [];
  return subs.find((s) => ACTIVE_STRIPE_STATUSES.includes(s.status)) || subs[0] || null;
};

// Map the status payload to a user-facing reconciliation indicator. matches → ✓
// agrees with Stripe; exempt-no-subscription → "exempt (expected)";
// no-stripe-subscription → ⚠️ none found; mismatch → ⚠️ differs. The mismatch
// case is refined to the stale-active wording ("Dynamo active, Stripe canceled")
// when the DynamoDB pin is active but the highlighted Stripe subscription is
// canceled/expired — so a canceled sub reads as a real MISMATCH, never as "no
// subscription".
export const reconciliationView = (subStatus) => {
  const reconciliation = subStatus?.reconciliation;
  switch (reconciliation) {
    case 'matches':
      return { icon: '✓', text: 'matches Stripe', color: 'success' };
    case 'exempt-no-subscription':
      return { icon: '✓', text: 'exempt — no subscription (expected)', color: 'default' };
    case 'mismatch': {
      const sub = pickStripeSubscription(subStatus?.stripe);
      const pinActive = subStatus?.pin?.isActive === true;
      const stripeCanceled = sub && !ACTIVE_STRIPE_STATUSES.includes(sub.status);
      if (pinActive && stripeCanceled) {
        return {
          icon: '⚠️',
          text: `differs from Stripe (Dynamo active, Stripe ${sub.status})`,
          color: 'error',
        };
      }
      return { icon: '⚠️', text: 'differs from Stripe', color: 'error' };
    }
    case 'no-stripe-subscription':
      return { icon: '⚠️', text: 'no Stripe subscription found', color: 'warning' };
    default:
      return { icon: '…', text: 'Stripe status unknown', color: 'default' };
  }
};

// Condense a subscriber-status payload into a single "does this account have an
// active subscription?" summary for a compact grid column. This is the same
// source of truth the Pricing Console reconciles against:
//   - exempt account (plan granted, no subscription expected) → 'exempt'
//   - a Stripe subscription in an active-ish status            → 'active'
//   - a Stripe subscription that exists but is canceled/etc.   → 'inactive'
//   - no Stripe subscription at all                            → 'none'
//   - not yet loaded / errored                                 → 'unknown'
// Returns { state, label, color, stripeStatus } where `color` maps to an MUI
// Chip color and `stripeStatus` is the raw Stripe status when known.
export const subscriptionActiveState = (subStatus) => {
  if (!subStatus) {
    return { state: 'unknown', label: 'Unknown', color: 'default', stripeStatus: null };
  }

  // Exempt accounts intentionally carry NO subscription — that's the expected,
  // healthy state, so surface it distinctly rather than as "none".
  const isExempt =
    subStatus.exempt === true ||
    subStatus.exempt?.exempt === true ||
    subStatus.reconciliation === 'exempt-no-subscription';
  if (isExempt) {
    return { state: 'exempt', label: 'Exempt', color: 'warning', stripeStatus: null };
  }

  const sub = pickStripeSubscription(subStatus.stripe);
  if (!sub) {
    if (subStatus.reconciliation === 'unknown') {
      return { state: 'unknown', label: 'Unknown', color: 'default', stripeStatus: null };
    }
    return { state: 'none', label: 'No subscription', color: 'default', stripeStatus: null };
  }

  const stripeStatus = sub.status || null;
  if (ACTIVE_STRIPE_STATUSES.includes(stripeStatus)) {
    return { state: 'active', label: 'Active', color: 'success', stripeStatus };
  }
  return { state: 'inactive', label: stripeStatus || 'Inactive', color: 'error', stripeStatus };
};

// ---------------------------------------------------------------------------
// Shared column derivation for the Admin Portal businesses grid.
//
// Resolves the three pricing-migration columns — pinned pricing VERSION, EXEMPT
// status, and contract ADD-ONS — from the SAME authoritative "confirm via
// Stripe" payload the Subscription column already consumes (GET /admin/pricing/
// subscriber/{id}/status → { pin, exempt, contractAddons, stripe, reconciliation }).
//
// This mirrors PricingConsole.jsx's `businessInfo` derivation so the grid and
// the per-business console never disagree. The lightweight /subscription/{userId}
// payload does NOT carry planId/exempt/addons, so callers should prefer the
// status payload; an optional `fallbackRow` (the grid's business row, which may
// carry a stale planId/exempt/addons) is consulted only when the status payload
// is missing a field.
//
// @param {object|null} subStatus - the subscriber-status payload (subStatuses[id]).
// @param {function} versionForDate - resolver from config/pricingVersions; returns
//   a version when the effectiveDate maps to a known pricing version, else null.
// @param {object} [fallbackRow] - optional business row for legacy/stale fallback.
// @returns {{ pinnedVersion: string|null, exempt: boolean, addons: string[] }}
export const deriveSubscriberColumns = (subStatus, versionForDate, fallbackRow = {}) => {
  const row = fallbackRow || {};

  // Pinned pricing version. The planId (e.g. "2026-09-06Pro") encodes the pinned
  // pricing effectiveDate as its leading YYYY-MM-DD. Prefer the status payload's
  // pin/exempt planId; fall back to the row's planId, then its precomputed
  // pinnedVersion. Only surface a version that resolves to a KNOWN registry
  // version — never invent one.
  const statusPlanId =
    (subStatus && subStatus.pin && subStatus.pin.planId) ||
    (subStatus && subStatus.exempt && subStatus.exempt.planId) ||
    null;
  const planId = statusPlanId || row.planId || null;
  const pinnedEffectiveDate =
    planId && /^\d{4}-\d{2}-\d{2}/.test(planId)
      ? planId.slice(0, 10)
      : row.pinnedVersion || null;
  const pinnedVersion =
    pinnedEffectiveDate &&
    typeof versionForDate === 'function' &&
    versionForDate(pinnedEffectiveDate)
      ? pinnedEffectiveDate
      : null;

  // Exempt: the status payload's exempt flag is authoritative (it reflects the
  // subscription row's billingMode==='exempt' or a legacy exempt assignment).
  // `subStatus.exempt` may be a boolean or an object { exempt: boolean }.
  let exempt;
  if (subStatus && typeof subStatus.exempt === 'boolean') {
    exempt = subStatus.exempt;
  } else if (
    subStatus &&
    subStatus.exempt &&
    typeof subStatus.exempt.exempt === 'boolean'
  ) {
    exempt = subStatus.exempt.exempt;
  } else {
    exempt = row.exempt === true;
  }

  // Contract add-ons: the status payload's contractAddons (User_Services entries
  // of type 'contract') is authoritative; each carries a serviceId. Fall back to
  // the row's addons array (already a list of ids) only when status has none.
  const statusAddons =
    subStatus && Array.isArray(subStatus.contractAddons)
      ? subStatus.contractAddons.map((a) => a && a.serviceId).filter(Boolean)
      : null;
  const addons =
    statusAddons && statusAddons.length
      ? statusAddons
      : Array.isArray(row.addons)
        ? row.addons
        : [];

  return { pinnedVersion, exempt, addons };
};
