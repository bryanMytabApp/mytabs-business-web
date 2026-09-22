import { useCallback, useEffect, useState } from "react";
import { getSystemSubscriptions, getCustomerSubscription } from "../../../services/paymentService";
import { CURRENT_VERSION, baselineLabel, buildPlanViewModels } from "../../../utils/pricing/pricingCatalog";
import { PRODUCT_NAMES } from "../../../config/pricingVersions";
import { parseJwt } from "../../../utils/common";

/**
 * Resolve the logged-in userId (if any) the same way the Billing screen does:
 * from the stored idToken JWT, falling back to a stored username. Returns null
 * for anonymous visitors — the public pricing page still works, it just won't
 * apply a per-user pricing override.
 */
const currentUserId = () => {
  try {
    return parseJwt(localStorage.getItem("idToken")) || localStorage.getItem("username") || null;
  } catch (e) {
    return null;
  }
};

/**
 * The currently-selected business (account) id, from session state. The backend
 * resolves this to the owning ACCOUNT (organization when the business is under an
 * org, else the standalone business) so the assigned pricing is account-scoped —
 * shared across an org's businesses, per model B. Falls back to null.
 */
const currentBusinessId = () => {
  try {
    return sessionStorage.getItem("selectedBusinessId") || null;
  } catch (e) {
    return null;
  }
};

/**
 * Best-effort lookup of an admin-assigned pricing version for the logged-in
 * ACCOUNT. Passes the current businessId so the backend resolves the owning
 * account (org or standalone). Returns the assigned `pricingEffectiveDate` (e.g.
 * "2000-01-01") when an active assignment exists, else null. Never throws —
 * anonymous visitors or a failed lookup simply yield null (current pricing).
 */
const fetchAssignedEffectiveDate = async () => {
  const userId = currentUserId();
  const businessId = currentBusinessId();
  if (!userId && !businessId) return null;
  try {
    const res = await getCustomerSubscription({ userId, businessId });
    const assigned = res?.data?.assignedPricing;
    return assigned && assigned.pricingEffectiveDate ? assigned.pricingEffectiveDate : null;
  } catch (e) {
    return null;
  }
};

/**
 * Config-derived Contract_Product add-ons (AI Discovery, Market Intelligence).
 *
 * These are ALWAYS available regardless of the pricing API result — they are built
 * purely from `pricingVersions` config (via `CURRENT_VERSION`) so the Pricing_Section
 * can render the add-ons even when `getSystemSubscriptions()` fails or returns nothing
 * (Req 10.6, 10.7). Each add-on is contact-only (`talkToSales: true`, no self-serve
 * price) and carries a baseline reference label from config (Req 10.5–10.7).
 *
 * @returns {Array<{ id: string, name: string, baselineLabel: string, talkToSales: true }>}
 */
const buildAddonViewModels = () => [
  {
    id: "ai_discovery",
    name: PRODUCT_NAMES.ai_discovery,
    baselineLabel: baselineLabel(CURRENT_VERSION?.aiDiscovery),
    talkToSales: true,
  },
  {
    id: "market_intel",
    name: PRODUCT_NAMES.market_intel,
    baselineLabel: baselineLabel(CURRENT_VERSION?.marketIntel),
    talkToSales: true,
  },
];

/**
 * Marketing pricing hook.
 *
 * On mount (and on `reload()`), calls `paymentService.getSystemSubscriptions()` and
 * maps the returned catalog rows (`response.data`) into plan display view-models via
 * the shared `buildPlanViewModels(rows, interval)` helper — the SAME cutover-aware
 * source of truth the authenticated Subscribe page uses, so marketing prices never
 * drift from checkout.
 *
 * Status transitions from `"loading"` to one of:
 *   - `"success"` — the response contained plan rows; `plans` holds the mapped cards.
 *   - `"empty"`   — the request succeeded but returned no plan rows.
 *   - `"error"`   — the request threw.
 *
 * `addons` is ALWAYS config-derived (never depends on the API), so the contract
 * add-ons render even when the plan request fails (Req 10.6, 10.7).
 *
 * @param {"monthly"|"yearly"} [interval="monthly"] - Billing interval to price plans at.
 * @returns {{
 *   status: "loading" | "success" | "empty" | "error",
 *   plans: Array<object>,   // PlanView[]; [] unless status === "success"
 *   addons: Array<object>,  // AddonView[]; always available (config-derived)
 *   reload: () => void
 * }}
 */
const usePlanData = (interval = "monthly") => {
  const [status, setStatus] = useState("loading");
  const [plans, setPlans] = useState([]);

  // Add-ons are config-derived and independent of the API, so they are always
  // available even before the fetch resolves or when it fails.
  const addons = buildAddonViewModels();

  const fetchPlans = useCallback(
    async (isCancelled) => {
      setStatus("loading");
      setPlans([]);
      try {
        // Fetch the catalog and (for logged-in users) any admin-assigned pricing
        // version in parallel. The assignment override makes this user see their
        // assigned version's prices (e.g. legacy) instead of the current version.
        const [response, effectiveDateOverride] = await Promise.all([
          getSystemSubscriptions(),
          fetchAssignedEffectiveDate(),
        ]);
        if (isCancelled && isCancelled()) return;

        // Rows are on `response.data`; guard against a non-array payload.
        const rows = Array.isArray(response?.data) ? response.data : [];
        const planViews = buildPlanViewModels(rows, interval, effectiveDateOverride);

        // "empty" when the response carried no plan rows; otherwise "success".
        if (rows.length === 0) {
          setPlans([]);
          setStatus("empty");
          return;
        }

        setPlans(planViews);
        setStatus("success");
      } catch (err) {
        if (isCancelled && isCancelled()) return;
        setPlans([]);
        setStatus("error");
      }
    },
    [interval]
  );

  useEffect(() => {
    let cancelled = false;
    fetchPlans(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [fetchPlans]);

  // Re-run the fetch on demand (e.g. a "retry" affordance in a failure fallback).
  const reload = useCallback(() => {
    fetchPlans();
  }, [fetchPlans]);

  return { status, plans, addons, reload };
};

export default usePlanData;
export { buildAddonViewModels };
