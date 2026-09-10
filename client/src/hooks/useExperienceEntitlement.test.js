import { renderHook, waitFor } from "@testing-library/react";

// Mock the entitlement service
jest.mock("../services/entitlementService", () => ({
  getMyServices: jest.fn(),
}));

import useExperienceEntitlement, {
  EXPERIENCE_TIER_REQUIREMENTS,
  TIER_HIERARCHY,
  TIER_LIMITS,
  meetsRequiredTier,
} from "./useExperienceEntitlement";
import { getMyServices } from "../services/entitlementService";

describe("useExperienceEntitlement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns loading state initially", () => {
    getMyServices.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useExperienceEntitlement());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
  });

  it("returns no subscription when services list is empty", async () => {
    getMyServices.mockResolvedValue([]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns no subscription when no experience_* service exists", async () => {
    getMyServices.mockResolvedValue([
      { id: "business_basic", status: "active" },
      { id: "ai_agent_pro", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
  });

  it("returns active subscription for experience_starter", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_starter", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.isLapsed).toBe(false);
    expect(result.current.tier).toBe("starter");
    expect(result.current.limits).toEqual({
      maxInstances: 5,
      maxDrawingsPerInstance: 5,
      analyticsRetentionDays: 30,
      customBranding: false,
    });
  });

  it("returns active subscription for experience_pro", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_pro", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("pro");
    expect(result.current.limits).toEqual({
      maxInstances: 10,
      maxDrawingsPerInstance: 20,
      analyticsRetentionDays: 90,
      customBranding: true,
    });
  });

  it("returns active subscription for experience_enterprise", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_enterprise", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("enterprise");
    expect(result.current.limits).toEqual({
      maxInstances: 20,
      maxDrawingsPerInstance: Infinity,
      analyticsRetentionDays: 365,
      customBranding: true,
    });
  });

  it("returns active subscription for experience_growth", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_growth", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("growth");
    expect(result.current.limits).toEqual({
      maxInstances: 8,
      maxDrawingsPerInstance: 10,
      analyticsRetentionDays: 60,
      customBranding: true,
    });
  });

  it("resolves experience_organization as the enterprise (top) tier", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_organization", status: "active" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    // organization is an alias for the top tier
    expect(result.current.tier).toBe("enterprise");
  });

  it("detects lapsed subscription status", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_pro", status: "lapsed" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(true);
    expect(result.current.tier).toBe("pro");
  });

  it("detects past_due as lapsed", async () => {
    getMyServices.mockResolvedValue([
      { id: "experience_starter", status: "past_due" },
    ]);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(true);
  });

  it("handles API errors gracefully", async () => {
    const apiError = new Error("Network error");
    getMyServices.mockRejectedValue(apiError);
    const { result } = renderHook(() => useExperienceEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.error).toBe(apiError);
  });

  describe("isExperienceTypeAvailable", () => {
    it("returns false for all engagement types with starter subscription (starter has none)", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_starter", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Growth-tier engagement types are NOT available to starter
      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(false);
      expect(result.current.isExperienceTypeAvailable("live_polls")).toBe(false);
      expect(result.current.isExperienceTypeAvailable("surveys")).toBe(false);
    });

    it("returns true for growth-tier types with growth subscription", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_growth", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("live_polls")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("surveys")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("digital_coupons")).toBe(true);
      // Pro-tier types are not available to growth
      expect(result.current.isExperienceTypeAvailable("prediction_challenges")).toBe(false);
    });

    it("returns false for pro-tier types with starter subscription", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_starter", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("prediction_challenges")).toBe(false);
      expect(result.current.isExperienceTypeAvailable("instant_win")).toBe(false);
    });

    it("returns true for pro-tier types with pro subscription", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_pro", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("prediction_challenges")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("photo_contests")).toBe(true);
      // Pro also includes growth types
      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(true);
    });

    it("returns true for all types with enterprise subscription", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_enterprise", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("prediction_challenges")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("ai_concierge")).toBe(true);
    });

    it("returns true for all types with organization subscription (alias for enterprise)", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_organization", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // organization resolves to the top tier, so everything (incl ai_concierge) is available
      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("prediction_challenges")).toBe(true);
      expect(result.current.isExperienceTypeAvailable("ai_concierge")).toBe(true);
    });

    it("returns false when no subscription", async () => {
      getMyServices.mockResolvedValue([]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("raffles")).toBe(false);
    });

    it("returns false for unknown experience type", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_enterprise", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isExperienceTypeAvailable("unknown_type")).toBe(false);
    });
  });

  describe("getRequiredTier", () => {
    it("returns correct tier for each experience type", async () => {
      getMyServices.mockResolvedValue([
        { id: "experience_starter", status: "active" },
      ]);
      const { result } = renderHook(() => useExperienceEntitlement());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.getRequiredTier("raffles")).toBe("growth");
      expect(result.current.getRequiredTier("prediction_challenges")).toBe("pro");
      expect(result.current.getRequiredTier("ai_concierge")).toBe("enterprise");
      expect(result.current.getRequiredTier("unknown_type")).toBeNull();
    });
  });
});

describe("meetsRequiredTier", () => {
  it("returns true when user tier equals required tier", () => {
    expect(meetsRequiredTier("starter", "starter")).toBe(true);
    expect(meetsRequiredTier("growth", "growth")).toBe(true);
    expect(meetsRequiredTier("pro", "pro")).toBe(true);
    expect(meetsRequiredTier("enterprise", "enterprise")).toBe(true);
  });

  it("returns true when user tier exceeds required tier", () => {
    expect(meetsRequiredTier("growth", "starter")).toBe(true);
    expect(meetsRequiredTier("pro", "starter")).toBe(true);
    expect(meetsRequiredTier("pro", "growth")).toBe(true);
    expect(meetsRequiredTier("enterprise", "starter")).toBe(true);
    expect(meetsRequiredTier("enterprise", "pro")).toBe(true);
    expect(meetsRequiredTier("organization", "starter")).toBe(true);
  });

  it("returns false when user tier is below required tier", () => {
    expect(meetsRequiredTier("starter", "growth")).toBe(false);
    expect(meetsRequiredTier("starter", "pro")).toBe(false);
    expect(meetsRequiredTier("growth", "pro")).toBe(false);
    expect(meetsRequiredTier("starter", "enterprise")).toBe(false);
    expect(meetsRequiredTier("pro", "enterprise")).toBe(false);
  });

  it("returns false for unknown tiers", () => {
    expect(meetsRequiredTier("unknown", "starter")).toBe(false);
    expect(meetsRequiredTier("starter", "unknown")).toBe(false);
  });

  it("treats organization as an alias for enterprise (top tier)", () => {
    expect(meetsRequiredTier("organization", "enterprise")).toBe(true);
    expect(meetsRequiredTier("enterprise", "organization")).toBe(true);
    expect(meetsRequiredTier("organization", "pro")).toBe(true);
    expect(meetsRequiredTier("organization", "growth")).toBe(true);
    expect(meetsRequiredTier("organization", "organization")).toBe(true);
    // pro does not meet the top tier requirement (regardless of alias)
    expect(meetsRequiredTier("pro", "organization")).toBe(false);
  });
});

describe("exports", () => {
  it("exports EXPERIENCE_TIER_REQUIREMENTS with all 17 types", () => {
    expect(Object.keys(EXPERIENCE_TIER_REQUIREMENTS)).toHaveLength(17);
    expect(EXPERIENCE_TIER_REQUIREMENTS.raffles).toBe("growth");
    expect(EXPERIENCE_TIER_REQUIREMENTS.ai_concierge).toBe("enterprise");
  });

  it("exports TIER_HIERARCHY in correct order", () => {
    expect(TIER_HIERARCHY).toEqual(["starter", "growth", "pro", "enterprise"]);
  });

  it("exports TIER_LIMITS with correct structure", () => {
    expect(TIER_LIMITS.experience_starter.tier).toBe("starter");
    expect(TIER_LIMITS.experience_growth.tier).toBe("growth");
    expect(TIER_LIMITS.experience_pro.tier).toBe("pro");
    expect(TIER_LIMITS.experience_enterprise.tier).toBe("enterprise");
    // organization is an alias for the top tier — resolves to "enterprise"
    expect(TIER_LIMITS.experience_organization.tier).toBe("enterprise");
  });
});
