import { renderHook, waitFor } from "@testing-library/react";

// Mock the entitlement service
jest.mock("../services/entitlementService", () => ({
  getMyServices: jest.fn(),
}));

import useAiAgentEntitlement, { TIER_LIMITS } from "./useAiAgentEntitlement";
import { getMyServices } from "../services/entitlementService";

describe("useAiAgentEntitlement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns loading state initially", () => {
    getMyServices.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useAiAgentEntitlement());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
  });

  it("returns no subscription when services list is empty", async () => {
    getMyServices.mockResolvedValue([]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns no subscription when no ai_agent_* service exists", async () => {
    getMyServices.mockResolvedValue([
      { id: "business_basic", status: "active" },
      { id: "market_intelligence", status: "active" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
  });

  it("returns active subscription for ai_agent_starter", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_starter", status: "active" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.isLapsed).toBe(false);
    expect(result.current.tier).toBe("starter");
    expect(result.current.limits).toEqual({
      sourcingAgents: 2,
      creationAgents: 5,
      tokenPool: 500000,
    });
  });

  it("returns active subscription for ai_agent_pro", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("pro");
    expect(result.current.limits).toEqual({
      sourcingAgents: 5,
      creationAgents: 15,
      tokenPool: 2000000,
    });
  });

  it("returns active subscription for ai_agent_enterprise", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_enterprise", status: "active" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("enterprise");
    expect(result.current.limits).toEqual({
      sourcingAgents: 10,
      creationAgents: 25,
      tokenPool: 10000000,
    });
  });

  it("returns active subscription for ai_agent_organization", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_organization", status: "active" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("organization");
    expect(result.current.limits).toEqual({
      sourcingAgents: Infinity,
      creationAgents: Infinity,
      tokenPool: Infinity,
    });
  });

  it("detects lapsed subscription status", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "lapsed" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(true);
    expect(result.current.tier).toBe("pro");
    expect(result.current.limits).toEqual({
      sourcingAgents: 5,
      creationAgents: 15,
      tokenPool: 2000000,
    });
  });

  it("detects past_due as lapsed", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_starter", status: "past_due" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(true);
    expect(result.current.tier).toBe("starter");
  });

  it("detects canceled as lapsed", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_enterprise", status: "canceled" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(true);
  });

  it("handles API errors gracefully", async () => {
    const apiError = new Error("Network error");
    getMyServices.mockRejectedValue(apiError);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.isLapsed).toBe(false);
    expect(result.current.tier).toBeNull();
    expect(result.current.limits).toBeNull();
    expect(result.current.error).toBe(apiError);
  });

  it("handles null response from getMyServices", async () => {
    getMyServices.mockResolvedValue(null);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasSubscription).toBe(false);
    expect(result.current.tier).toBeNull();
  });

  it("selects first matching ai_agent_* service if multiple exist", async () => {
    getMyServices.mockResolvedValue([
      { id: "business_basic", status: "active" },
      { id: "ai_agent_pro", status: "active" },
      { id: "ai_agent_starter", status: "lapsed" },
    ]);
    const { result } = renderHook(() => useAiAgentEntitlement());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should pick the first match — ai_agent_pro
    expect(result.current.hasSubscription).toBe(true);
    expect(result.current.tier).toBe("pro");
  });

  it("exports TIER_LIMITS constant with correct tiers", () => {
    expect(TIER_LIMITS.ai_agent_starter.tier).toBe("starter");
    expect(TIER_LIMITS.ai_agent_pro.tier).toBe("pro");
    expect(TIER_LIMITS.ai_agent_enterprise.tier).toBe("enterprise");
    expect(TIER_LIMITS.ai_agent_organization.tier).toBe("organization");
  });
});
