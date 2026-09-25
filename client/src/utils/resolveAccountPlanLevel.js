import { getCustomerSubscription, getUserPremiumSubscription } from "../services/paymentService";
import { getCurrentUserId } from "./authUtils";
import { planLevelFromSubscriptionRow } from "../views/navAccess";

/**
 * Resolve the current account's plan level (Starter=1 … Enterprise=4; 0 = unknown),
 * robust to EXEMPT accounts.
 *
 * Why this exists: exempt Subscription rows are keyed by the ACCOUNT OWNER's userId,
 * which is not necessarily the logged-in Cognito user id (e.g. logged in as a person
 * whose id differs from the business's `userId`). getCustomerSubscription's exempt
 * branch keys on the login user id and can therefore miss, returning no level. So we:
 *   1. Try getCustomerSubscription({ userId, businessId }) — returns `level` incl. its
 *      exempt branch when the login id matches.
 *   2. Fall back to probing getUserPremiumSubscription under candidate ids (login id,
 *      selected business owner id, selected business id) and derive the level from the
 *      row's planId. This resolves exempt accounts regardless of id keying.
 *
 * Shared by the sidebar (HomeView) and the route guard (PlanLevelRouteGuard) so a
 * plan-gated feature shows in the nav and admits at the route identically — no drift.
 *
 * Injectable deps for testing; defaults use the real services/session.
 *
 * @returns {Promise<number>} plan level (0 when unresolvable)
 */
export const resolveAccountPlanLevel = async (deps = {}) => {
  const _getCustomerSubscription = deps.getCustomerSubscription || getCustomerSubscription;
  const _getUserPremiumSubscription = deps.getUserPremiumSubscription || getUserPremiumSubscription;
  const _getCurrentUserId = deps.getCurrentUserId || getCurrentUserId;
  const getSession = deps.getSession || ((k) => {
    try { return sessionStorage.getItem(k) || null; } catch (e) { return null; }
  });

  const userId = _getCurrentUserId();
  const businessId = getSession("selectedBusinessId");
  const bizOwnerId = getSession("selectedBusinessUserId");

  // 1. Primary: account-resolved subscription (includes exempt level when id matches).
  try {
    if (userId || businessId) {
      const res = await _getCustomerSubscription({ userId, businessId });
      const lvl = Number(res?.data?.level);
      if (Number.isFinite(lvl) && lvl > 0) return lvl;
    }
  } catch { /* fall through to row probing */ }

  // 2. Fallback: probe the Subscription row under candidate ids; derive from planId.
  const candidateIds = [...new Set([userId, bizOwnerId, businessId].filter(Boolean))];
  for (const id of candidateIds) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await _getUserPremiumSubscription(id);
      const lvl = planLevelFromSubscriptionRow(res?.data || null);
      if (lvl > 0) return lvl;
    } catch { /* try next candidate */ }
  }

  return 0;
};

export default resolveAccountPlanLevel;
