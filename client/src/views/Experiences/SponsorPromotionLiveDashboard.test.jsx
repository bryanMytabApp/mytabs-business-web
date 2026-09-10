import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SponsorPromotionLiveDashboard from "./SponsorPromotionLiveDashboard";
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
          element={<SponsorPromotionLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A sponsor-promotions live-stats payload matching the component's expected
// shape: { totalImpressions, totalEngagements, state, promotions:[{ promotionId,
// sponsorId, headline, impressions, engagements, clickThroughRate,
// impressionGoalAttainment?, engagementGoalAttainment? }], sponsorRoi:[{
// sponsorId, sponsorName, impressions, engagements, clickThroughRate }] }.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "sponsor-promotions",
      state: "Live",
      totalImpressions: 320,
      totalEngagements: 48,
      promotions: [
        {
          promotionId: "promo-a",
          sponsorId: "sponsor-1",
          headline: "Grand Opening Sale",
          impressions: 200,
          engagements: 40,
          clickThroughRate: 0.2,
          impressionGoalAttainment: 0.8,
        },
        {
          promotionId: "promo-b",
          sponsorId: "sponsor-2",
          headline: "Meet the Roadster",
          impressions: 120,
          engagements: 8,
          clickThroughRate: 0.0667,
        },
      ],
      sponsorRoi: [
        {
          sponsorId: "sponsor-1",
          sponsorName: "Smokehouse BBQ",
          impressions: 200,
          engagements: 40,
          clickThroughRate: 0.2,
        },
        {
          sponsorId: "sponsor-2",
          sponsorName: "AutoWorks",
          impressions: 120,
          engagements: 8,
          clickThroughRate: 0.0667,
        },
      ],
      ...overrides,
    },
  },
});

describe("SponsorPromotionLiveDashboard", () => {
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

  // 11.1 — renders without crashing and shows current per-promotion metrics.
  it("renders each promotion with its metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Grand Opening Sale")).toBeInTheDocument();
    });
    expect(screen.getByText("Meet the Roadster")).toBeInTheDocument();
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    // Instance totals.
    expect(screen.getByTestId("total-impressions")).toHaveTextContent("320");
    expect(screen.getByTestId("total-engagements")).toHaveTextContent("48");
  });

  // 11.2 — advancing 2s while Live triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Grand Opening Sale")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    // Called with the routed eventId / experienceId.
    expect(getLiveStats).toHaveBeenCalledWith("evt-123", "exp-456", expect.any(Object));

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 11.3 — provided data renders each promotion's headline, sponsor,
  // impressions, engagements, and CTR (CTR as (rate*100).toFixed(1)+'%').
  it("renders per-promotion headline, sponsor, impressions, engagements, and CTR", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("promotion-card-promo-a")).toBeInTheDocument();
    });

    const cardA = screen.getByTestId("promotion-card-promo-a");
    expect(within(cardA).getByText("Grand Opening Sale")).toBeInTheDocument();
    // Sponsor name resolved from the sponsorRoi entry by sponsorId.
    expect(screen.getByTestId("promotion-sponsor-promo-a")).toHaveTextContent("Smokehouse BBQ");
    expect(screen.getByTestId("promotion-impressions-promo-a")).toHaveTextContent("200");
    expect(screen.getByTestId("promotion-engagements-promo-a")).toHaveTextContent("40");
    // 0.2 -> "20.0%"
    expect(screen.getByTestId("promotion-ctr-promo-a")).toHaveTextContent("20.0%");

    // Second promotion: 0.0667 -> "6.7%".
    expect(screen.getByTestId("promotion-sponsor-promo-b")).toHaveTextContent("AutoWorks");
    expect(screen.getByTestId("promotion-ctr-promo-b")).toHaveTextContent("6.7%");
  });

  // 11.4 — per-sponsor ROI renders grouped by sponsor.
  it("renders per-sponsor ROI grouped by sponsor", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("sponsor-roi-section")).toBeInTheDocument();
    });

    expect(screen.getByTestId("sponsor-roi-name-sponsor-1")).toHaveTextContent("Smokehouse BBQ");
    expect(screen.getByTestId("sponsor-roi-impressions-sponsor-1")).toHaveTextContent("200");
    expect(screen.getByTestId("sponsor-roi-engagements-sponsor-1")).toHaveTextContent("40");
    expect(screen.getByTestId("sponsor-roi-ctr-sponsor-1")).toHaveTextContent("20.0%");

    expect(screen.getByTestId("sponsor-roi-name-sponsor-2")).toHaveTextContent("AutoWorks");
    expect(screen.getByTestId("sponsor-roi-impressions-sponsor-2")).toHaveTextContent("120");
  });

  // 11.5 — promotions with goals render goal progress; goal-less promotions do
  // not render a progress bar.
  it("renders goal progress only for promotions with an attainment", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("promotion-card-promo-a")).toBeInTheDocument();
    });

    // promo-a has an impressionGoalAttainment (0.8) -> goal block + bar shown.
    const goalBlock = screen.getByTestId("promotion-impression-goal-promo-a");
    expect(goalBlock).toBeInTheDocument();
    expect(goalBlock).toHaveTextContent("80.0%");
    expect(within(goalBlock).getByRole("progressbar")).toBeInTheDocument();

    // promo-a has no engagement goal; promo-b has no goals at all.
    expect(screen.queryByTestId("promotion-engagement-goal-promo-a")).not.toBeInTheDocument();
    expect(screen.queryByTestId("promotion-impression-goal-promo-b")).not.toBeInTheDocument();
    expect(screen.queryByTestId("promotion-engagement-goal-promo-b")).not.toBeInTheDocument();
  });

  // 11.6 — a Closed instance shows final metrics + a closed indicator and stops
  // the polling interval.
  it("shows final metrics and a closed indicator when the instance is Closed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("CLOSED")).toBeInTheDocument();
    });
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final metrics still render.
    expect(screen.getByText("Grand Opening Sale")).toBeInTheDocument();
    expect(screen.getByTestId("total-impressions")).toHaveTextContent("320");

    // Polling stops while Closed — no further calls after the initial load.
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
  });

  // 11.7 — a failed refresh shows an error Alert and retries next tick.
  it("shows an error on failed refresh and keeps polling while Live", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Grand Opening Sale")).toBeInTheDocument();
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

  // 11.8 — zero impressions renders the empty-state indicator.
  it("shows an empty-state indicator when there are zero impressions", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        totalImpressions: 0,
        totalEngagements: 0,
        promotions: [
          {
            promotionId: "promo-a",
            sponsorId: "sponsor-1",
            headline: "Grand Opening Sale",
            impressions: 0,
            engagements: 0,
            clickThroughRate: 0,
          },
        ],
        sponsorRoi: [],
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No promotion impressions yet.");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SponsorPromotionLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
