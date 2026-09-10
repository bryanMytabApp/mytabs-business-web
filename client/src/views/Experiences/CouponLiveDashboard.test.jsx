import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CouponLiveDashboard from "./CouponLiveDashboard";
import { getLiveStats } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<CouponLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A digital-coupons live-stats payload matching the backend index.js shape:
// { totalClaimed, totalRedeemed, state, offers:[{ offerId, title, vendorName,
// claimedCount, redeemedCount, remainingInventory, fullyClaimed, redemptionRate }] }.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "digital-coupons",
      state: "Live",
      totalClaimed: 45,
      totalRedeemed: 18,
      offers: [
        {
          offerId: "offer-a",
          title: "20% Off Any Order",
          vendorName: "Smokehouse BBQ",
          claimedCount: 30,
          redeemedCount: 15,
          remainingInventory: 0,
          fullyClaimed: true,
          redemptionRate: 0.5,
        },
        {
          offerId: "offer-b",
          title: "Free Bottled Water",
          vendorName: "Event Concessions",
          claimedCount: 15,
          redeemedCount: 3,
          remainingInventory: "unlimited",
          fullyClaimed: false,
          redemptionRate: 0.2,
        },
      ],
      ...overrides,
    },
  },
});

describe("CouponLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(async () => {
    // The dashboard schedules a 2s polling interval. Flush any pending
    // timers/promises inside act so they don't leak into the next test, then
    // clear timers and restore real timers.
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // 10.1 — renders without crashing and shows per-offer metrics.
  it("renders each offer with its metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("20% Off Any Order")).toBeInTheDocument();
    });
    expect(screen.getByText("Free Bottled Water")).toBeInTheDocument();
    expect(screen.getByText("Smokehouse BBQ")).toBeInTheDocument();
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 10.2 — advancing 2s while Live triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("20% Off Any Order")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 10.3 — provided metrics render per-offer title/vendor/claimed/redeemed/
  // remaining/rate.
  it("renders per-offer title, vendor, claimed, redeemed, remaining, and rate", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("offer-card-offer-a")).toBeInTheDocument();
    });

    const cardA = screen.getByTestId("offer-card-offer-a");
    expect(within(cardA).getByText("20% Off Any Order")).toBeInTheDocument();
    expect(within(cardA).getByText("Smokehouse BBQ")).toBeInTheDocument();
    expect(screen.getByTestId("offer-claimed-offer-a")).toHaveTextContent("30");
    expect(screen.getByTestId("offer-redeemed-offer-a")).toHaveTextContent("15");
    expect(screen.getByTestId("offer-remaining-offer-a")).toHaveTextContent("0");
    expect(screen.getByTestId("offer-rate-offer-a")).toHaveTextContent("50%");

    // The unlimited offer reports "Unlimited" remaining.
    expect(screen.getByTestId("offer-remaining-offer-b")).toHaveTextContent("Unlimited");
    expect(screen.getByTestId("offer-rate-offer-b")).toHaveTextContent("20%");
  });

  // 10.4 — totals claimed/redeemed render.
  it("renders instance totals for claimed and redeemed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-claimed")).toBeInTheDocument();
    });
    expect(screen.getByTestId("total-claimed")).toHaveTextContent("45");
    expect(screen.getByTestId("total-redeemed")).toHaveTextContent("18");
  });

  // 10.5 — a finite offer with zero remaining shows a fully-claimed indicator.
  it("shows a fully-claimed indicator for a finite offer with zero remaining", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("offer-card-offer-a")).toBeInTheDocument();
    });
    expect(screen.getByTestId("fully-claimed-offer-a")).toHaveTextContent("Fully claimed");
    // The unlimited offer is never fully claimed.
    expect(screen.queryByTestId("fully-claimed-offer-b")).not.toBeInTheDocument();
  });

  // 10.6 — a Closed instance shows final metrics and a closed indicator.
  it("shows final metrics and a closed indicator when the instance is Closed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("CLOSED")).toBeInTheDocument();
    });
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final metrics still render.
    expect(screen.getByText("20% Off Any Order")).toBeInTheDocument();
    expect(screen.getByTestId("total-claimed")).toHaveTextContent("45");

    // Polling stops while Closed — no further calls after the initial load.
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
  });

  // 10.7 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling while Live", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("20% Off Any Order")).toBeInTheDocument();
    });

    // Second tick fails.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // Third tick retries (interval still running) and clears the error.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.queryByText("Server error")).not.toBeInTheDocument();
    });
  });

  // 10.8 — zero claimed coupons shows an empty-state indicator.
  it("shows an empty-state indicator when there are zero claimed coupons", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        totalClaimed: 0,
        totalRedeemed: 0,
        offers: [
          {
            offerId: "offer-a",
            title: "20% Off Any Order",
            vendorName: "Smokehouse BBQ",
            claimedCount: 0,
            redeemedCount: 0,
            remainingInventory: 500,
            fullyClaimed: false,
            redemptionRate: 0,
          },
        ],
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No coupons claimed yet.");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./CouponLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
