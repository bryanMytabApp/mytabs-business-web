import { useState, useEffect } from "react";
import { getMyServices } from "../services/entitlementService";
import { getUserPremiumSubscription } from "../services/paymentService";
import { getCurrentUserId } from "../utils/authUtils";

/**
 * Parse the plan tier from a Subscription row's `planId`.
 *
 * planId is "<YYYY-MM-DD><Tier>" (e.g. "2026-09-06Growth", "2000-01-01Pro").
 * Returns a lowercased tier ("starter"|"growth"|"pro"|"enterprise"), normalizing
 * "organization" → "enterprise" (alias for the top tier). Null if unparseable.
 */
const tierFromPlanId = (planId) => {
  if (!planId) return null;
  const name = String(planId).replace(/^\d{4}-\d{2}-\d{2}/, "").trim().toLowerCase();
  if (!name) return null;
  const normalized = name === "organization" ? "enterprise" : name;
  return TIER_HIERARCHY.includes(normalized) ? normalized : null;
};

/**
 * Experience type tier requirements.
 * Maps each experience type to the minimum subscription tier required.
 * The lowest engagement tier is "growth" — starter has no engagement types.
 * Types available in "growth" are available to all higher paid tiers.
 */
const EXPERIENCE_TIER_REQUIREMENTS = {
  raffles: "growth",
  live_polls: "growth",
  trivia: "pro",
  surveys: "growth",
  pulse_feedback: "growth",
  check_in_challenges: "growth",
  prediction_challenges: "pro",
  instant_win: "pro",
  digital_scratch_offs: "pro",
  treasure_hunts: "pro",
  photo_contests: "pro",
  social_wall: "pro",
  leaderboards: "pro",
  digital_coupons: "growth",
  sponsor_promotions: "pro",
  loyalty_rewards: "pro",
  ai_concierge: "enterprise",
};

/**
 * Resolve a type's required tier tolerant of key format. The catalog/backend use
 * hyphenated type ids (e.g. 'digital-scratch-offs', 'instant-win',
 * 'trivia-challenges') while EXPERIENCE_TIER_REQUIREMENTS is keyed by underscore
 * ids (e.g. 'digital_scratch_offs'). Normalize hyphens→underscores (and map the
 * catalog's 'trivia-challenges' to the map's 'trivia') so a lookup succeeds for
 * either form. Returns the tier string or null.
 */
const resolveRequiredTier = (experienceType) => {
  if (!experienceType) return null;
  if (EXPERIENCE_TIER_REQUIREMENTS[experienceType]) {
    return EXPERIENCE_TIER_REQUIREMENTS[experienceType];
  }
  const underscored = String(experienceType).replace(/-/g, "_");
  if (EXPERIENCE_TIER_REQUIREMENTS[underscored]) {
    return EXPERIENCE_TIER_REQUIREMENTS[underscored];
  }
  // The catalog id 'trivia-challenges' maps to the requirements key 'trivia'.
  if (underscored === "trivia_challenges" && EXPERIENCE_TIER_REQUIREMENTS.trivia) {
    return EXPERIENCE_TIER_REQUIREMENTS.trivia;
  }
  return null;
};

/**
 * Tier hierarchy — higher index means higher tier.
 * Used to compare whether a user's tier meets the requirement.
 * NOTE: "organization" is NOT a separate rung here. It is an alias for the top
 * tier "enterprise" (see meetsRequiredTier, which normalizes organization → enterprise).
 */
const TIER_HIERARCHY = ["starter", "growth", "pro", "enterprise"];

/**
 * Tier limits for experience features.
 */
const TIER_LIMITS = {
  experience_starter: {
    tier: "starter",
    maxInstances: 5,
    maxDrawingsPerInstance: 5,
    analyticsRetentionDays: 30,
    customBranding: false,
  },
  experience_growth: {
    tier: "growth",
    maxInstances: 8,
    maxDrawingsPerInstance: 10,
    analyticsRetentionDays: 60,
    customBranding: true,
  },
  experience_pro: {
    tier: "pro",
    maxInstances: 10,
    maxDrawingsPerInstance: 20,
    analyticsRetentionDays: 90,
    customBranding: true,
  },
  experience_enterprise: {
    tier: "enterprise",
    maxInstances: 20,
    maxDrawingsPerInstance: Infinity,
    analyticsRetentionDays: 365,
    customBranding: true,
  },
  experience_organization: {
    // "organization" is an alias for the top tier. Resolve it to "enterprise"
    // so the exposed `tier` value is unambiguous and comparisons are correct.
    tier: "enterprise",
    maxInstances: Infinity,
    maxDrawingsPerInstance: Infinity,
    analyticsRetentionDays: Infinity,
    customBranding: true,
  },
};

/**
 * Checks if a tier meets or exceeds the required tier.
 * @param {string} userTier - The user's current tier
 * @param {string} requiredTier - The required tier for the feature
 * @returns {boolean}
 */
const meetsRequiredTier = (userTier, requiredTier) => {
  // "organization" is an alias for the top tier "enterprise" (same subscription
  // level). Normalize both arguments before comparing so a subscription tier of
  // "organization" is treated exactly like "enterprise". Genuinely unknown tiers
  // still resolve to index -1 and return false.
  const normalize = (tier) => (tier === "organization" ? "enterprise" : tier);
  const userIndex = TIER_HIERARCHY.indexOf(normalize(userTier));
  const requiredIndex = TIER_HIERARCHY.indexOf(normalize(requiredTier));
  if (userIndex === -1 || requiredIndex === -1) return false;
  return userIndex >= requiredIndex;
};

/**
 * Custom hook that checks entitlements for an active Experience subscription.
 *
 * Calls `getMyServices()` and finds any service whose `id` starts with "experience_".
 * Returns subscription state, tier info, limits, and a helper to check if a specific
 * experience type is available at the user's tier.
 *
 * @returns {{
 *   hasSubscription: boolean,
 *   isLapsed: boolean,
 *   tier: string|null,
 *   limits: object|null,
 *   isLoading: boolean,
 *   error: Error|null,
 *   isExperienceTypeAvailable: (experienceType: string) => boolean,
 *   getRequiredTier: (experienceType: string) => string|null
 * }}
 */
const useExperienceEntitlement = () => {
  const [state, setState] = useState({
    hasSubscription: false,
    isLapsed: false,
    tier: null,
    limits: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    const checkEntitlement = async () => {
      try {
        const response = await getMyServices();
        if (cancelled) return;

        const services = Array.isArray(response) ? response : (response?.services || []);

        // Find any explicit experience_* service entry. When present it is the
        // authoritative source (dedicated engagement subscription with its own
        // tier + limits).
        const experienceService = services.find(
          (s) => (s.id || s.serviceId) && (s.id || s.serviceId).startsWith("experience_")
        );

        if (experienceService) {
          const isActive = experienceService.status === "active";
          const isLapsed =
            experienceService.status === "lapsed" ||
            experienceService.status === "past_due" ||
            experienceService.status === "canceled";

          const tierConfig = TIER_LIMITS[experienceService.id || experienceService.serviceId] || null;

          setState({
            hasSubscription: isActive,
            isLapsed,
            tier: tierConfig ? tierConfig.tier : (experienceService.tier || null),
            limits: tierConfig
              ? {
                  maxInstances: tierConfig.maxInstances,
                  maxDrawingsPerInstance: tierConfig.maxDrawingsPerInstance,
                  analyticsRetentionDays: tierConfig.analyticsRetentionDays,
                  customBranding: tierConfig.customBranding,
                }
              : null,
            isLoading: false,
            error: null,
          });
          return;
        }

        // No dedicated experience_* service — engagement entitlement is granted by
        // the account's SUBSCRIPTION PLAN tier (Starter/Growth/Pro/Enterprise). The
        // `entitlements/my-services` catalog does not carry the plan tier, so resolve
        // it from the account's Subscription ROW (GET /subscription/{userId}), which
        // returns the versioned `planId` (e.g. "2026-09-06Growth") and covers EXEMPT
        // accounts that have no Stripe subscription. This is the common case: an
        // account on a paid/exempt plan gets the engagement types its tier includes,
        // without a separate experience_* subscription. An inactive/cancelled row or a
        // Starter plan resolves to a tier that meets no engagement requirement, so
        // those types stay correctly locked.
        const userId = getCurrentUserId();
        if (userId) {
          try {
            const subRes = await getUserPremiumSubscription(userId);
            if (cancelled) return;
            const row = subRes?.data || null;
            const rowActive = row && row.isActive === true && row.isCancelled !== true;
            const tier = rowActive ? tierFromPlanId(row.planId) : null;
            if (tier) {
              const tierConfig = TIER_LIMITS[`experience_${tier}`] || null;
              setState({
                hasSubscription: true,
                isLapsed: false,
                tier,
                limits: tierConfig
                  ? {
                      maxInstances: tierConfig.maxInstances,
                      maxDrawingsPerInstance: tierConfig.maxDrawingsPerInstance,
                      analyticsRetentionDays: tierConfig.analyticsRetentionDays,
                      customBranding: tierConfig.customBranding,
                    }
                  : null,
                isLoading: false,
                error: null,
              });
              return;
            }
          } catch (subErr) {
            // Fall through to "no subscription" if the plan lookup fails.
          }
        }

        // No experience_* service and no resolvable paid/exempt plan tier.
        setState({
          hasSubscription: false,
          isLapsed: false,
          tier: null,
          limits: null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState({
          hasSubscription: false,
          isLapsed: false,
          tier: null,
          limits: null,
          isLoading: false,
          error: err,
        });
      }
    };

    checkEntitlement();

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Checks if a specific experience type is available at the user's current tier.
   * @param {string} experienceType - The experience type key (e.g., 'raffles', 'live_polls')
   * @returns {boolean}
   */
  const isExperienceTypeAvailable = (experienceType) => {
    if (!state.hasSubscription || !state.tier) return false;
    const requiredTier = resolveRequiredTier(experienceType);
    if (!requiredTier) return false;
    return meetsRequiredTier(state.tier, requiredTier);
  };

  /**
   * Gets the required tier for a specific experience type.
   * @param {string} experienceType - The experience type key
   * @returns {string|null}
   */
  const getRequiredTier = (experienceType) => {
    return resolveRequiredTier(experienceType);
  };

  return {
    ...state,
    isExperienceTypeAvailable,
    getRequiredTier,
  };
};

export default useExperienceEntitlement;
export { EXPERIENCE_TIER_REQUIREMENTS, TIER_HIERARCHY, TIER_LIMITS, meetsRequiredTier };
