import {
  getCustomerSubscription,
  getUserPremiumSubscription,
} from "../services/paymentService";
import { getBusiness } from "../services/businessService";
import { getMyOrganizations } from "../services/organizationService";

/**
 * Resolve whether the current account is ENTITLED to the app — i.e. should reach the
 * dashboard rather than the /subscription page. Returns true for a live paid Stripe
 * subscription, organization membership, OR an active/exempt DynamoDB Subscription row.
 *
 * Why this is more than a single lookup: exempt (and some paid) Subscription rows are
 * keyed by the ACCOUNT OWNER's userId (the business's `userId`), which is NOT
 * necessarily the logged-in Cognito id (`custom:user_id`/`sub`). A newer login can
 * carry a Cognito `sub` that differs from the account/business `userId` the exempt row
 * is stored under. A single lookup by the token id therefore misses and bounces an
 * entitled account to /subscription. So we probe several candidate account ids:
 *   - the login/token id,
 *   - the selected business owner id + business id from session (if present),
 *   - and, as a last resort, the business resolved via getBusiness(loginId) — its
 *     `userId` (owner) and `_id` — which works even on a COLD login before any
 *     business context is cached in session.
 *
 * Shared by useLogin (post-login redirect) and SubscriptionGuard (route gate) so they
 * admit exactly the same accounts and never disagree.
 *
 * Injectable deps for testing; defaults use the real services/session.
 *
 * @param {string} loginUserId - the id extracted from the JWT at login
 * @returns {Promise<boolean>} true if entitled (paid | org | active/exempt row)
 */
export const resolveAccountEntitlement = async (loginUserId, deps = {}) => {
  const _getCustomerSubscription = deps.getCustomerSubscription || getCustomerSubscription;
  const _getUserPremiumSubscription = deps.getUserPremiumSubscription || getUserPremiumSubscription;
  const _getBusiness = deps.getBusiness || getBusiness;
  const _getMyOrganizations = deps.getMyOrganizations || getMyOrganizations;
  const getSession = deps.getSession || ((k) => {
    try { return sessionStorage.getItem(k) || null; } catch (e) { return null; }
  });

  const isEntitledRow = (row) =>
    !!row && (row.isActive === true || row.billingMode === "exempt");

  // 1. Live paid Stripe subscription.
  try {
    if (loginUserId) {
      const res = await _getCustomerSubscription({ userId: loginUserId });
      if (res?.data?.hasSubscription && res.data.priceId) return true;
    }
  } catch { /* no Stripe subscription */ }

  // 2. Organization membership (org members ride the org plan).
  try {
    const orgsRes = await _getMyOrganizations();
    const orgs = orgsRes?.data?.organizations || orgsRes?.data || [];
    if (Array.isArray(orgs) && orgs.length > 0) return true;
  } catch { /* not in an org */ }

  // 3. Active/exempt Subscription row under any candidate account id.
  const candidateIds = [loginUserId];
  candidateIds.push(getSession("selectedBusinessUserId"));
  candidateIds.push(getSession("selectedBusinessId"));

  // Cold-login fallback: resolve the user's business to get the owner id + business id
  // the exempt row is actually keyed under, even when nothing is cached in session yet.
  try {
    if (loginUserId) {
      const bizRes = await _getBusiness(loginUserId);
      const biz = bizRes?.data || bizRes || null;
      if (biz) {
        if (biz.userId) candidateIds.push(biz.userId);
        if (biz._id) candidateIds.push(biz._id);
      }
    }
  } catch { /* couldn't resolve a business — proceed with what we have */ }

  for (const id of [...new Set(candidateIds.filter(Boolean))]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await _getUserPremiumSubscription(id);
      if (isEntitledRow(res?.data || null)) return true;
    } catch { /* try next candidate */ }
  }

  return false;
};

export default resolveAccountEntitlement;
