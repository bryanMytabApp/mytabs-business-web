import { act, renderHook, waitFor } from "@testing-library/react";
import usePlanData from "./usePlanData";
import { getSystemSubscriptions, getCustomerSubscription } from "../../../services/paymentService";
import { parseJwt } from "../../../utils/common";

// Mock the payment service so no real HTTP request is made. The hook consumes
// `getSystemSubscriptions` (catalog) and `getCustomerSubscription` (per-user
// assigned pricing version). jest.mock calls are hoisted above the imports.
jest.mock("../../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
  getCustomerSubscription: jest.fn(),
}));

// parseJwt resolves the logged-in userId from the idToken. Control it per test so
// we can exercise both anonymous (null) and logged-in-with-assignment paths.
jest.mock("../../../utils/common", () => ({
  parseJwt: jest.fn(() => null),
}));

// A minimal set of catalog rows (one per plan level, monthly) shaped like the
// System_Subscriptions payload the backend returns. Amounts are arbitrary but
// finite so `buildPlanViewModels` maps them to non-null prices.
const planRows = [
  { level: 1, sublevel: "monthly", amount: 1399 },
  { level: 2, sublevel: "monthly", amount: 1998 },
  { level: 3, sublevel: "monthly", amount: 4999 },
  { level: 4, sublevel: "monthly", amount: 9999 },
];

// Assert that `addons` always carries the two contract add-ons regardless of the
// hook's current status. This holds in loading/success/empty/error alike because
// add-ons are config-derived and never depend on the API result (Req 10.6, 10.7).
const expectContractAddons = (addons) => {
  expect(Array.isArray(addons)).toBe(true);
  expect(addons).toHaveLength(2);

  const byId = Object.fromEntries(addons.map((a) => [a.id, a]));

  expect(byId.ai_discovery).toBeDefined();
  expect(byId.ai_discovery.name).toBe("AI Discovery");
  expect(byId.ai_discovery.talkToSales).toBe(true);

  expect(byId.market_intel).toBeDefined();
  expect(byId.market_intel.name).toBe("Market Intelligence");
  expect(byId.market_intel.talkToSales).toBe(true);
};

describe("usePlanData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: anonymous visitor (no userId) and no assignment, so the override
    // path is inert unless a test opts in.
    parseJwt.mockReturnValue(null);
    getCustomerSubscription.mockResolvedValue({ data: { assignedPricing: null } });
  });

  it("starts in the loading state with contract add-ons already present", () => {
    getSystemSubscriptions.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => usePlanData());

    expect(result.current.status).toBe("loading");
    expect(result.current.plans).toEqual([]);
    // Add-ons are config-derived, so they exist even before the fetch resolves.
    expectContractAddons(result.current.addons);
  });

  it("transitions loading -> success and maps plan rows", async () => {
    getSystemSubscriptions.mockResolvedValue({ data: planRows });
    const { result } = renderHook(() => usePlanData());

    // Initial render is loading.
    expect(result.current.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    // Rows present -> plans mapped to the four plan view-models, non-empty.
    expect(result.current.plans.length).toBe(4);
    expect(result.current.plans.map((p) => p.name)).toEqual([
      "Starter",
      "Growth",
      "Pro",
      "Enterprise",
    ]);
    expectContractAddons(result.current.addons);
  });

  it("transitions loading -> empty when the response carries no plan rows", async () => {
    getSystemSubscriptions.mockResolvedValue({ data: [] });
    const { result } = renderHook(() => usePlanData());

    await waitFor(() => {
      expect(result.current.status).toBe("empty");
    });

    expect(result.current.plans).toEqual([]);
    expectContractAddons(result.current.addons);
  });

  it("transitions loading -> error when the request rejects", async () => {
    getSystemSubscriptions.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => usePlanData());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current.plans).toEqual([]);
    // Add-ons must still render on failure (the whole point of config-derived add-ons).
    expectContractAddons(result.current.addons);
  });

  it("calls getSystemSubscriptions exactly once on mount", async () => {
    getSystemSubscriptions.mockResolvedValue({ data: planRows });
    const { result } = renderHook(() => usePlanData());

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    expect(getSystemSubscriptions).toHaveBeenCalledTimes(1);
  });

  it("re-runs the fetch when reload() is called", async () => {
    getSystemSubscriptions.mockResolvedValue({ data: planRows });
    const { result } = renderHook(() => usePlanData());

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(getSystemSubscriptions).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.reload();
    });

    // The reload re-issues the fetch and settles back to "success".
    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });
    expect(getSystemSubscriptions).toHaveBeenCalledTimes(2);
  });

  // Admin-assigned pricing version: a logged-in user with an active assignment
  // sees THAT version's prices, not the current version's.
  it("uses the admin-assigned pricing version's price for a logged-in user", async () => {
    // Two rows for level 1 monthly: legacy (2000-01-01, $13.99) and current
    // (2026-09-06, $187.00). With an assignment to 2000-01-01, the hook must show
    // the legacy price.
    const versionedRows = [
      { level: 1, sublevel: "monthly", amount: 1399, pricingEffectiveDate: "2000-01-01" },
      { level: 1, sublevel: "monthly", amount: 18700, pricingEffectiveDate: "2026-09-06" },
    ];
    getSystemSubscriptions.mockResolvedValue({ data: versionedRows });
    parseJwt.mockReturnValue("user-eace2601");
    getCustomerSubscription.mockResolvedValue({
      data: { assignedPricing: { pricingEffectiveDate: "2000-01-01", allowUpdate: true } },
    });

    const { result } = renderHook(() => usePlanData("monthly"));

    await waitFor(() => expect(result.current.status).toBe("success"));

    const starter = result.current.plans.find((p) => p.level === 1);
    expect(starter.amountCents).toBe(1399); // legacy, not 18700
    expect(getCustomerSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-eace2601" })
    );
  });

  it("uses current pricing (no override) when the logged-in user has no assignment", async () => {
    const versionedRows = [
      { level: 1, sublevel: "monthly", amount: 1399, pricingEffectiveDate: "2000-01-01" },
      { level: 1, sublevel: "monthly", amount: 18700, pricingEffectiveDate: "2026-09-06" },
    ];
    getSystemSubscriptions.mockResolvedValue({ data: versionedRows });
    parseJwt.mockReturnValue("user-noassign");
    getCustomerSubscription.mockResolvedValue({ data: { assignedPricing: null } });

    const { result } = renderHook(() => usePlanData("monthly"));

    await waitFor(() => expect(result.current.status).toBe("success"));

    const starter = result.current.plans.find((p) => p.level === 1);
    // Current effective version (post-cutover) = 2026-09-06 → $187.00.
    expect(starter.amountCents).toBe(18700);
  });
});
