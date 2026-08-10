import { useState, useEffect } from "react";
import { getMyServices } from "../services/entitlementService";

/**
 * Experience type tier requirements.
 * Maps each experience type to the minimum subscription tier required.
 * Types available in "starter" are available to all paid tiers.
 */
const EXPERIENCE_TIER_REQUIREMENTS = {
  raffles: "starter",
  live_polls: "starter",
  trivia: "starter",
  surveys: "starter",
  pulse_feedback: "starter",
  check_in_challenges: "starter",
  prediction_challenges: "pro",
  instant_win: "pro",
  digital_scratch_offs: "pro",
  treasure_hunts: "pro",
  photo_contests: "pro",
  social_wall: "pro",
  leaderboards: "pro",
  digital_coupons: "enterprise",
  sponsor_promotions: "enterprise",
  loyalty_rewards: "enterprise",
  ai_concierge: "enterprise",
};

/**
 * Tier hierarchy — higher index means higher tier.
 * Used to compare whether a user's tier meets the requirement.
 */
const TIER_HIERARCHY = ["starter", "pro", "enterprise", "organization"];

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
    tier: "organization",
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
  const userIndex = TIER_HIERARCHY.indexOf(userTier);
  const requiredIndex = TIER_HIERARCHY.indexOf(requiredTier);
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

        // Find any experience_* service entry
        const experienceService = services.find(
          (s) => (s.id || s.serviceId) && (s.id || s.serviceId).startsWith("experience_")
        );

        if (!experienceService) {
          setState({
            hasSubscription: false,
            isLapsed: false,
            tier: null,
            limits: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        const isActive = experienceService.status === "active";
        const isLapsed =
          experienceService.status === "lapsed" ||
          experienceService.status === "past_due" ||
          experienceService.status === "canceled";

        const tierConfig = TIER_LIMITS[experienceService.id || experienceService.serviceId] || null;

        setState({
          hasSubscription: isActive,
          isLapsed: isLapsed,
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
    const requiredTier = EXPERIENCE_TIER_REQUIREMENTS[experienceType];
    if (!requiredTier) return false;
    return meetsRequiredTier(state.tier, requiredTier);
  };

  /**
   * Gets the required tier for a specific experience type.
   * @param {string} experienceType - The experience type key
   * @returns {string|null}
   */
  const getRequiredTier = (experienceType) => {
    return EXPERIENCE_TIER_REQUIREMENTS[experienceType] || null;
  };

  return {
    ...state,
    isExperienceTypeAvailable,
    getRequiredTier,
  };
};

export default useExperienceEntitlement;
export { EXPERIENCE_TIER_REQUIREMENTS, TIER_HIERARCHY, TIER_LIMITS, meetsRequiredTier };
