import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import InstantWinLiveDashboard from "./InstantWinLiveDashboard";
import { getLiveStats } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
// Mirrors ScratchOffLiveDashboard.test.jsx mocking style.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<InstantWinLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// An instant-win live-stats payload with two tiers, one sold out.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "instant-win",
      state: "Live",
      analytics: {
        totalPlays: 90,
        totalWins: 12,
        totalLosses: 78,
        uniqueAttendees: 90,
        tiers: [
          {
            tierId: "tier-a",
            prizeLabel: "Free Drink",
            prizeQuantity: 100,
            awardsCount: 10,
            remainingInventory: 90,
            soldOut: false,
          },
          {
            tierId: "tier-b",
            prizeLabel: "$25 Gift Card",
            prizeQuantity: 5,
            awardsCount: 5,
            remainingInventory: 0,
            soldOut: true,
          },
        ],
        fulfillmentBreakdown: { unclaimed: 8, claimed: 3, redeemed: 1 },
      },
      ...overrides,
    },
  },
});

// A zero-plays payload: tiers present but no plays recorded.
const mockZeroResponse = () =>
  mockStatsResponse({
    analytics: {
      totalPlays: 0,
      totalWins: 0,
      totalLosses: 0,
      uniqueAttendees: 0,
      tiers: [
        {
          tierId: "tier-a",
          prizeLabel: "Free Drink",
          prizeQuantity: 100,
          awardsCount: 0,
          remainingInventory: 100,
          soldOut: false,
        },
      ],
      fulfillmentBreakdown: { unclaimed: 0, claimed: 0, redeemed: 0 },
    },
  });

describe("InstantWinLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // 10.1 — renders without crashing and shows per-tier metrics.
  it("renders the title and per-tier metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("instantwin-title")).toBeInTheDocument();
    });
    expect(screen.getByTestId("availability-chip")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("tier-card-tier-a")).toBeInTheDocument();
    expect(screen.getByTestId("tier-card-tier-b")).toBeInTheDocument();
  });

  // 10.2 — advancing 2s while Live triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds while live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 10.3 — provided metrics render per-tier label, awards, and remaining.
  it("renders each tier's label, awards count, and remaining inventory", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("tier-label-tier-a")).toHaveTextContent("Free Drink");
    });
    expect(screen.getByTestId("tier-awards-tier-a")).toHaveTextContent("10");
    expect(screen.getByTestId("tier-remaining-tier-a")).toHaveTextContent("90");

    expect(screen.getByTestId("tier-label-tier-b")).toHaveTextContent("$25 Gift Card");
    expect(screen.getByTestId("tier-awards-tier-b")).toHaveTextContent("5");
    expect(screen.getByTestId("tier-remaining-tier-b")).toHaveTextContent("0");
  });

  // 10.4 — totals plays/wins/losses render.
  it("renders the instance totals", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-plays")).toHaveTextContent("90");
    });
    expect(screen.getByTestId("total-wins")).toHaveTextContent("12");
    expect(screen.getByTestId("total-losses")).toHaveTextContent("78");
  });

  // 10.5 — a tier with zero remaining inventory shows a sold-out indicator.
  it("shows a sold-out indicator for a depleted tier", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("tier-soldout-tier-b")).toBeInTheDocument();
    });
    // The in-stock tier shows no sold-out chip.
    expect(screen.queryByTestId("tier-soldout-tier-a")).not.toBeInTheDocument();
  });

  // 10.6 — a Closed instance shows final metrics and a closed indicator, stops polling.
  it("shows final metrics and a closed indicator when closed and stops polling", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("availability-chip")).toHaveTextContent("CLOSED");
    });
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final metrics still render.
    expect(screen.getByTestId("total-plays")).toHaveTextContent("90");

    // Polling has stopped: advancing time does not trigger further calls.
    const callsSoFar = getLiveStats.mock.calls.length;
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(getLiveStats).toHaveBeenCalledTimes(callsSoFar);
  });

  // 10.7 — a failed refresh shows an error and retries next tick.
  it("shows an error on a failed refresh and retries next tick", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("instantwin-title")).toBeInTheDocument();
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

  // 10.8 — zero recorded plays shows an empty-state indicator.
  it("shows an empty-state indicator when no plays have been recorded", async () => {
    getLiveStats.mockResolvedValue(mockZeroResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("total-plays")).toHaveTextContent("0");
    // Tier cards are not rendered in the empty state.
    expect(screen.queryByTestId("tier-card-tier-a")).not.toBeInTheDocument();
  });

  // ETag optimization: 304 skips re-render, ETag echoed on next request.
  it("passes the ETag header on subsequent requests and skips 304 updates", async () => {
    getLiveStats
      .mockResolvedValueOnce({
        status: 200,
        headers: { etag: '"abc123"' },
        data: { data: mockStatsResponse().data.data },
      })
      .mockResolvedValueOnce({ status: 304, headers: {} });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("instantwin-title")).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
    const secondCall = getLiveStats.mock.calls[1];
    expect(secondCall[2]).toEqual(
      expect.objectContaining({
        headers: expect.objectContaining({ "If-None-Match": '"abc123"' }),
      })
    );
    // Still shows the data (304 did not clear it).
    expect(screen.getByTestId("total-plays")).toHaveTextContent("90");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./InstantWinLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
