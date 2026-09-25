import { resolveAccountPlanLevel } from "./resolveAccountPlanLevel";

// Build a deps bundle with sane defaults; override per test.
const makeDeps = (over = {}) => ({
  getCurrentUserId: () => "login-user",
  getSession: () => null,
  getCustomerSubscription: jest.fn().mockResolvedValue({ data: {} }),
  getUserPremiumSubscription: jest.fn().mockResolvedValue({ data: null }),
  ...over,
});

describe("resolveAccountPlanLevel", () => {
  it("uses getCustomerSubscription level when present (login id matches)", async () => {
    const deps = makeDeps({
      getCustomerSubscription: jest.fn().mockResolvedValue({ data: { level: 3 } }),
    });
    await expect(resolveAccountPlanLevel(deps)).resolves.toBe(3);
    expect(deps.getUserPremiumSubscription).not.toHaveBeenCalled();
  });

  it("falls back to the exempt row under the BUSINESS OWNER id (Red Rooster: Growth)", async () => {
    // getCustomerSubscription misses (exempt row keyed by owner id, not login id).
    const OWNER = "biz-owner-id";
    const deps = makeDeps({
      getCurrentUserId: () => "login-user",
      getSession: (k) => (k === "selectedBusinessUserId" ? OWNER : k === "selectedBusinessId" ? "biz-_id" : null),
      getCustomerSubscription: jest.fn().mockResolvedValue({ data: { hasSubscription: false } }),
      getUserPremiumSubscription: jest.fn().mockImplementation((id) =>
        id === OWNER
          ? Promise.resolve({ data: { billingMode: "exempt", isActive: true, planId: "2026-09-06Growth" } })
          : Promise.resolve({ data: null })
      ),
    });
    await expect(resolveAccountPlanLevel(deps)).resolves.toBe(2);
  });

  it("resolves an exempt Enterprise account (UrbanHTX = level 4) via owner-id fallback", async () => {
    const OWNER = "urbanhtx-owner";
    const deps = makeDeps({
      getSession: (k) => (k === "selectedBusinessUserId" ? OWNER : null),
      getCustomerSubscription: jest.fn().mockResolvedValue({ data: { hasSubscription: false } }),
      getUserPremiumSubscription: jest.fn().mockImplementation((id) =>
        id === OWNER
          ? Promise.resolve({ data: { billingMode: "exempt", isActive: true, planId: "2026-09-06Enterprise" } })
          : Promise.resolve({ data: null })
      ),
    });
    await expect(resolveAccountPlanLevel(deps)).resolves.toBe(4);
  });

  it("returns 0 when nothing resolves", async () => {
    await expect(resolveAccountPlanLevel(makeDeps())).resolves.toBe(0);
  });

  it("survives getCustomerSubscription throwing and still probes rows", async () => {
    const deps = makeDeps({
      getCustomerSubscription: jest.fn().mockRejectedValue(new Error("net")),
      getUserPremiumSubscription: jest.fn().mockResolvedValue({ data: { isActive: true, level: 2 } }),
    });
    await expect(resolveAccountPlanLevel(deps)).resolves.toBe(2);
  });
});
