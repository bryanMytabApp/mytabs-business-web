import { resolveAccountEntitlement } from "./resolveAccountEntitlement";

const makeDeps = (over = {}) => ({
  getSession: () => null,
  getCustomerSubscription: jest.fn().mockResolvedValue({ data: { hasSubscription: false, priceId: null } }),
  getMyOrganizations: jest.fn().mockResolvedValue({ data: [] }),
  getUserPremiumSubscription: jest.fn().mockResolvedValue({ data: null }),
  getBusiness: jest.fn().mockResolvedValue({ data: null }),
  ...over,
});

describe("resolveAccountEntitlement", () => {
  it("true for a live paid Stripe subscription", async () => {
    const deps = makeDeps({
      getCustomerSubscription: jest.fn().mockResolvedValue({ data: { hasSubscription: true, priceId: "price_1" } }),
    });
    await expect(resolveAccountEntitlement("login-1", deps)).resolves.toBe(true);
  });

  it("true for an org member", async () => {
    const deps = makeDeps({
      getMyOrganizations: jest.fn().mockResolvedValue({ data: [{ id: "org-1" }] }),
    });
    await expect(resolveAccountEntitlement("login-1", deps)).resolves.toBe(true);
  });

  it("true for an exempt row found under the LOGIN id (Red Rooster case)", async () => {
    const deps = makeDeps({
      getUserPremiumSubscription: jest.fn().mockImplementation((id) =>
        id === "login-1"
          ? Promise.resolve({ data: { billingMode: "exempt", isActive: true, planId: "2026-09-06Growth" } })
          : Promise.resolve({ data: null })
      ),
    });
    await expect(resolveAccountEntitlement("login-1", deps)).resolves.toBe(true);
  });

  it("true for an exempt row keyed under the BUSINESS owner id resolved via getBusiness (Starter Test cold-login case)", async () => {
    // Login token id differs from the account/business userId that owns the exempt row.
    const TOKEN = "cognito-sub-xyz";
    const OWNER = "725e6ceb"; // business userId / exempt row PK
    const deps = makeDeps({
      getSession: () => null, // nothing cached on cold login
      getBusiness: jest.fn().mockResolvedValue({ data: { _id: "biz-_id", userId: OWNER } }),
      getUserPremiumSubscription: jest.fn().mockImplementation((id) =>
        id === OWNER
          ? Promise.resolve({ data: { billingMode: "exempt", isActive: true, planId: "2026-09-06Starter" } })
          : Promise.resolve({ data: null })
      ),
    });
    await expect(resolveAccountEntitlement(TOKEN, deps)).resolves.toBe(true);
  });

  it("true for an exempt row keyed under the selected business owner id in session", async () => {
    const OWNER = "owner-in-session";
    const deps = makeDeps({
      getSession: (k) => (k === "selectedBusinessUserId" ? OWNER : null),
      getUserPremiumSubscription: jest.fn().mockImplementation((id) =>
        id === OWNER
          ? Promise.resolve({ data: { billingMode: "exempt", isActive: true, planId: "2026-09-06Enterprise" } })
          : Promise.resolve({ data: null })
      ),
    });
    await expect(resolveAccountEntitlement("login-1", deps)).resolves.toBe(true);
  });

  it("false when no paid/org/exempt signal resolves anywhere", async () => {
    await expect(resolveAccountEntitlement("login-1", makeDeps())).resolves.toBe(false);
  });

  it("does not treat an inactive non-exempt row as entitled", async () => {
    const deps = makeDeps({
      getUserPremiumSubscription: jest.fn().mockResolvedValue({ data: { isActive: false, billingMode: "paid" } }),
    });
    await expect(resolveAccountEntitlement("login-1", deps)).resolves.toBe(false);
  });
});
