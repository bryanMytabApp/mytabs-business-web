import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoyaltyLiveDashboard from "./LoyaltyLiveDashboard";
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
          element={<LoyaltyLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A loyalty-rewards live-stats payload matching the plugin's /live-stats shape:
// { state, totalPointsIssued, totalPointsRedeemed, activeMembers, rewardCount,
// tierDistribution, rewards:[{ rewardId, rewardLabel, redemptionCount,
// remainingInventory }] }. tierDistribution defaults to an array of
// { tierId, tierName, memberCount } with a null-tierId "No tier" entry
// (Requirement 11.5).
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "loyalty-rewards",
      state: "Live",
      totalPointsIssued: 1200,
      totalPointsRedeemed: 450,
      activeMembers: 37,
      rewardCount: 2,
      tierDistribution: [
        { tierId: "tier-gold", tierName: "Gold", memberCount: 12 },
        { tierId: "tier-silver", tierName: "Silver", memberCount: 20 },
        { tierId: null, tierName: "No tier", memberCount: 5 },
      ],
      rewards: [
        {
          rewardId: "reward-a",
          rewardLabel: "Free T-Shirt",
          redemptionCount: 15,
          remainingInventory: 35,
        },
        {
          rewardId: "reward-b",
          rewardLabel: "VIP Upgrade",
          redemptionCount: 8,
          remainingInventory: "unlimited",
        },
      ],
      ...overrides,
    },
  },
});

describe("LoyaltyLiveDashboard", () => {
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

  // 11.1 — renders without crashing and shows the current metrics.
  it("renders without crashing and shows current metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Free T-Shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("VIP Upgrade")).toBeInTheDocument();
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    // Current metric totals are present.
    expect(screen.getByTestId("total-points-issued")).toHaveTextContent("1,200");
    expect(screen.getByTestId("active-members")).toHaveTextContent("37");
  });

  // 11.2 — advancing 2s while Live triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Free T-Shirt")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 11.3 — provided metrics render total points issued, total points redeemed,
  // and active members.
  it("renders total points issued, total points redeemed, and active members", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-points-issued")).toBeInTheDocument();
    });
    expect(screen.getByTestId("total-points-issued")).toHaveTextContent("1,200");
    expect(screen.getByTestId("total-points-redeemed")).toHaveTextContent("450");
    expect(screen.getByTestId("active-members")).toHaveTextContent("37");
  });

  // 11.4 — each reward renders its label, redemption count, and remaining
  // inventory.
  it("renders each reward with its label, redemption count, and remaining inventory", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("reward-card-reward-a")).toBeInTheDocument();
    });

    const cardA = screen.getByTestId("reward-card-reward-a");
    expect(within(cardA).getByText("Free T-Shirt")).toBeInTheDocument();
    expect(screen.getByTestId("reward-redeemed-reward-a")).toHaveTextContent("15");
    expect(screen.getByTestId("reward-remaining-reward-a")).toHaveTextContent("35");

    const cardB = screen.getByTestId("reward-card-reward-b");
    expect(within(cardB).getByText("VIP Upgrade")).toBeInTheDocument();
    expect(screen.getByTestId("reward-redeemed-reward-b")).toHaveTextContent("8");
    // The unlimited reward reports "Unlimited" remaining.
    expect(screen.getByTestId("reward-remaining-reward-b")).toHaveTextContent("Unlimited");
  });

  // 11.5 — with tiers configured the tier distribution renders across tiers and
  // the no-tier group.
  it("renders the tier distribution across tiers and the no-tier group", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("tier-distribution")).toBeInTheDocument();
    });

    const panel = screen.getByTestId("tier-distribution");
    expect(within(panel).getByText("Gold")).toBeInTheDocument();
    expect(within(panel).getByText("Silver")).toBeInTheDocument();
    expect(within(panel).getByText("No tier")).toBeInTheDocument();

    // Per-tier member counts render, including the no-tier group.
    expect(within(screen.getByTestId("tier-tier-gold")).getByText("12")).toBeInTheDocument();
    expect(within(screen.getByTestId("tier-tier-silver")).getByText("20")).toBeInTheDocument();
    expect(within(screen.getByTestId("tier-none")).getByText("5")).toBeInTheDocument();
  });

  // 11.5 — the component also tolerates tierDistribution as an object keyed by
  // tierId with a `none` bucket for the no-tier group.
  it("renders a tier distribution provided as an object keyed by tierId with a none bucket", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        tierDistribution: { "tier-gold": 4, "tier-silver": 9, none: 2 },
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("tier-distribution")).toBeInTheDocument();
    });
    expect(within(screen.getByTestId("tier-tier-gold")).getByText("4")).toBeInTheDocument();
    expect(within(screen.getByTestId("tier-tier-silver")).getByText("9")).toBeInTheDocument();
    expect(within(screen.getByTestId("tier-none")).getByText("2")).toBeInTheDocument();
  });

  // 11.6 — a Closed instance shows final metrics and a closed indicator.
  it("shows final metrics and a closed indicator when the instance is Closed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("CLOSED")).toBeInTheDocument();
    });
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final metrics still render.
    expect(screen.getByText("Free T-Shirt")).toBeInTheDocument();
    expect(screen.getByTestId("total-points-issued")).toHaveTextContent("1,200");

    // Polling stops while Closed — no further calls after the initial load.
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
  });

  // 11.7 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling while Live", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Free T-Shirt")).toBeInTheDocument();
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

  // 11.8 — zero recorded Accruals shows an empty-state indicator.
  it("shows an empty-state indicator when there are zero recorded accruals", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        totalPointsIssued: 0,
        totalPointsRedeemed: 0,
        activeMembers: 0,
        rewards: [],
        tierDistribution: [],
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No loyalty activity yet.");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LoyaltyLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
