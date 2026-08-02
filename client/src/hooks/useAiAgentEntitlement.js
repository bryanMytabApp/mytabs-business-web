import { useState, useEffect } from "react";
import { getMyServices } from "../services/entitlementService";

/**
 * Tier limits keyed by service catalog ID.
 * Mirrors backend config in stripe-ai-agent-products.js.
 */
const TIER_LIMITS = {
  ai_agent_starter: {
    tier: "starter",
    sourcingAgents: 2,
    creationAgents: 5,
    tokenPool: 500000,
  },
  ai_agent_pro: {
    tier: "pro",
    sourcingAgents: 5,
    creationAgents: 15,
    tokenPool: 2000000,
  },
  ai_agent_enterprise: {
    tier: "enterprise",
    sourcingAgents: 10,
    creationAgents: 25,
    tokenPool: 10000000,
  },
  ai_agent_organization: {
    tier: "organization",
    sourcingAgents: Infinity,
    creationAgents: Infinity,
    tokenPool: Infinity,
  },
};

/**
 * Custom hook that checks entitlements for an active AI Agent subscription.
 *
 * Calls `getMyServices()` and finds any service whose `id` starts with "ai_agent_".
 * Returns subscription state, tier info, and limits for use by route guards and components.
 *
 * @returns {{
 *   hasSubscription: boolean,
 *   isLapsed: boolean,
 *   tier: string|null,
 *   limits: { sourcingAgents: number, creationAgents: number, tokenPool: number }|null,
 *   isLoading: boolean,
 *   error: Error|null
 * }}
 */
const useAiAgentEntitlement = () => {
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

        // Find any ai_agent_* service entry
        const aiAgentService = services.find(
          (s) => (s.id || s.serviceId) && (s.id || s.serviceId).startsWith("ai_agent_")
        );

        if (!aiAgentService) {
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

        const isActive = aiAgentService.status === "active";
        const isLapsed =
          aiAgentService.status === "lapsed" ||
          aiAgentService.status === "past_due" ||
          aiAgentService.status === "canceled";

        const tierConfig = TIER_LIMITS[aiAgentService.id] || null;

        setState({
          hasSubscription: isActive,
          isLapsed: isLapsed,
          tier: tierConfig ? tierConfig.tier : (aiAgentService.tier || null),
          limits: tierConfig
            ? {
                sourcingAgents: tierConfig.sourcingAgents,
                creationAgents: tierConfig.creationAgents,
                tokenPool: tierConfig.tokenPool,
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

  return state;
};

export default useAiAgentEntitlement;
export { TIER_LIMITS };
