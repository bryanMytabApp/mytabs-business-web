// Pure, testable access logic for the left-nav rail (extracted from HomeView so it
// can be unit-tested and kept consistent with the plan packaging in the sales sheet
// and the /pricing page).
//
// Gating flags an option may carry:
//   requiresServiceId: string  -> show only if that entitlement is subscribed
//   requiresOrg:       string  -> show only if the user's org matches (e.g. UrbanHTX)
//   requiresPlanLevel: number  -> show only if the account's plan level >= this number
//
// Plan levels (Starter=1, Growth=2, Pro=3, Enterprise=4) match the backend
// planLevelResolver and the Price_Card. Engagements/Experiences are a Growth+ (>=2)
// feature per the sales sheet ("Engagement products are available on every paid plan
// except Starter"), so they are gated by requiresPlanLevel: 2 — NOT by UrbanHTX org.

const normalizeOrg = (s) => (s || "").replace(/\s+/g, "").toLowerCase();

// Plan levels in ascending order (Starter=1 … Enterprise=4). Mirrors the backend
// planLevelResolver so a planId's trailing tier name maps to the same numeric level.
export const PLAN_LEVELS = ["Starter", "Growth", "Pro", "Enterprise"];

/**
 * Numeric plan level (1-4) from a planId like "2026-09-06Enterprise" (or a bare
 * tier name like "Growth"). Strips a leading YYYY-MM-DD date if present. Returns 0
 * when it can't be resolved. Case-insensitive.
 */
export const planLevelFromPlanId = (planId) => {
  if (!planId) return 0;
  const name = String(planId).replace(/^\d{4}-\d{2}-\d{2}/, "").trim();
  const idx = PLAN_LEVELS.findIndex((p) => p.toLowerCase() === name.toLowerCase());
  return idx >= 0 ? idx + 1 : 0;
};

/**
 * Resolve a plan level from a User_Premium_Subscriptions row. Prefers an explicit
 * numeric `level`, then derives it from `planId`. Only trusts active rows. Returns
 * 0 when the row is absent/inactive/unresolvable.
 */
export const planLevelFromSubscriptionRow = (row) => {
  if (!row) return 0;
  const active = row.isActive === true || row.billingMode === "exempt" || row.billingMode === "paid";
  if (!active) return 0;
  const explicit = Number(row.level);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return planLevelFromPlanId(row.planId);
};

/**
 * Decide whether a single nav option is visible for the given user context.
 *
 * @param {object} option - a nav option (may carry requiresServiceId/requiresOrg/requiresPlanLevel)
 * @param {object} ctx
 * @param {boolean} ctx.isVerifier            - verifier/scanner roles see no main nav
 * @param {boolean} ctx.userHasTicketAccess   - gates "My Tickets"
 * @param {Array}   ctx.headerServices        - entitlements ([{id, subscribed}])
 * @param {string|null} ctx.userOrgName       - the user's (first) org name
 * @param {number}  ctx.planLevel             - resolved plan level (0 = none/unknown)
 * @returns {boolean}
 */
export const isNavOptionVisible = (option, ctx = {}) => {
  const {
    isVerifier = false,
    userHasTicketAccess = false,
    headerServices = [],
    userOrgName = null,
    planLevel = 0,
  } = ctx;

  // Verifiers/scanners get no main navigation items.
  if (isVerifier) return false;

  // My Tickets requires ticket access.
  if (option.title === "My Tickets" && !userHasTicketAccess) return false;

  // Entitlement-gated items: require an active/subscribed matching service.
  if (option.requiresServiceId) {
    const svc = headerServices.find((s) => s.id === option.requiresServiceId);
    if (!svc || !svc.subscribed) return false;
  }

  // Org-restricted items (e.g. AI Agents → UrbanHTX): require a matching org.
  if (option.requiresOrg) {
    if (normalizeOrg(option.requiresOrg) !== normalizeOrg(userOrgName)) return false;
  }

  // Plan-level-gated items (e.g. Engagements → Growth+): require plan level >= threshold.
  if (option.requiresPlanLevel) {
    if (!(Number(planLevel) >= Number(option.requiresPlanLevel))) return false;
  }

  // These live only in the bottom section, never the main list.
  return !["Logout", "Configuration", "Team Management"].includes(option.title);
};

/**
 * Filter a full options array for the given user context.
 */
export const filterNavOptions = (options = [], ctx = {}) =>
  options.filter((option) => isNavOptionVisible(option, ctx));
