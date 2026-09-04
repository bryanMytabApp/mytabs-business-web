import { act, renderHook, waitFor } from "@testing-library/react";

// Mock the payment service so no real HTTP request is made. Only
// `getSystemSubscriptions` is consumed by the hook under test.
jest.mock("../../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
}));

import usePlanData from "./usePlanData";
import { getSystemSubscriptions } from "../../../services/paymentService";

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
});
