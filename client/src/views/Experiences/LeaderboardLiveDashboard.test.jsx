import React from "react";
import { render, screen, waitFor, act, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LeaderboardLiveDashboard from "./LeaderboardLiveDashboard";
import { getLiveStats } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
// The Leaderboard dashboard only reads standings via getLiveStats — it has no
// moderation/transition actions — so the mock only needs getLiveStats.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
}));

const EVENT_ID = "evt-123";
const EXPERIENCE_ID = "exp-456";

const renderComponent = () =>
  render(
    <MemoryRouter
      initialEntries={[`/admin/my-events/${EVENT_ID}/experiences/${EXPERIENCE_ID}/live`]}
    >
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<LeaderboardLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A leaderboards live-stats payload matching the getLiveStats shape the dashboard
// consumes: { experienceType, state, experienceName, mode, displaySize, tieBreak,
// standings:[{ attendeeId, combinedScore, rank, breakdown:[{ sourceExperienceId,
// weightedSourceScore }] }], analytics:{...} }.
// Wrapped exactly as the service returns: { data: { data: ... }, status, headers:{etag} }.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: { etag: 'W/"leaderboards-v1"' },
  data: {
    data: {
      experienceType: "leaderboards",
      state: "Live",
      experienceName: "Event Leaderboard",
      mode: "aggregation",
      displaySize: 10,
      tieBreak: "shared-rank",
      standings: [
        {
          attendeeId: "att-1",
          combinedScore: 980,
          rank: 1,
          breakdown: [
            { sourceExperienceId: "trivia-1", weightedSourceScore: 800 },
            { sourceExperienceId: "checkin-1", weightedSourceScore: 180 },
          ],
        },
        {
          attendeeId: "att-2",
          combinedScore: 640,
          rank: 2,
          breakdown: [
            { sourceExperienceId: "trivia-1", weightedSourceScore: 500 },
            { sourceExperienceId: "checkin-1", weightedSourceScore: 140 },
          ],
        },
      ],
      analytics: {
        configuredSources: 2,
        uniqueContributingAttendees: 2,
        totalAcceptedContributions: 5,
        greatestCombinedScore: 980,
      },
      ...overrides,
    },
  },
});

describe("LeaderboardLiveDashboard", () => {
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

  // 9.1 — renders without crashing and shows current standings ordered by
  // ascending rank.
  it("renders without crashing and shows current standings ordered by ascending rank", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });
    expect(screen.getByTestId("state-chip")).toHaveTextContent("LIVE");

    // Both rows render, ordered att-1 (rank 1) before att-2 (rank 2).
    const standings = screen.getByTestId("standings");
    const rows = within(standings).getAllByTestId(/^standings-row-/);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAttribute("data-testid", "standings-row-att-1");
    expect(rows[1]).toHaveAttribute("data-testid", "standings-row-att-2");
  });

  // 9.2 — advancing 2s while Live triggers another getLiveStats call, invoked
  // with (eventId, experienceId, config object).
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    expect(getLiveStats).toHaveBeenCalledWith(
      EVENT_ID,
      EXPERIENCE_ID,
      expect.any(Object)
    );

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
    expect(getLiveStats).toHaveBeenLastCalledWith(
      EVENT_ID,
      EXPERIENCE_ID,
      expect.any(Object)
    );
  });

  // 9.3 — provided standings render each entry with rank, combinedScore, and an
  // expandable per-source breakdown.
  it("renders rank, combined score, and an expandable per-source breakdown", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });

    // Rank + combined score render for each entry.
    const row1 = screen.getByTestId("standings-row-att-1");
    expect(within(row1).getByText("#1")).toBeInTheDocument();
    expect(screen.getByTestId("combined-score-att-1")).toHaveTextContent("980");
    expect(screen.getByTestId("combined-score-att-2")).toHaveTextContent("640");

    // Breakdown is collapsed until toggled.
    expect(screen.queryByTestId("breakdown-att-1")).not.toBeInTheDocument();

    // Expand the per-source breakdown for att-1.
    fireEvent.click(screen.getByTestId("toggle-breakdown-att-1"));
    await waitFor(() => {
      expect(screen.getByTestId("breakdown-att-1")).toBeInTheDocument();
    });
    const breakdown = screen.getByTestId("breakdown-att-1");
    expect(within(breakdown).getByText("trivia-1")).toBeInTheDocument();
    expect(within(breakdown).getByText("checkin-1")).toBeInTheDocument();
    expect(within(breakdown).getByText("800 pts")).toBeInTheDocument();
    expect(within(breakdown).getByText("180 pts")).toBeInTheDocument();
  });

  // 9.4 — Closed state renders the final standings with a closed indicator.
  it("renders a closed indicator with final standings when Closed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });
    expect(screen.getByTestId("state-chip")).toHaveTextContent("CLOSED");
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final standings still render.
    expect(screen.getByTestId("standings-row-att-1")).toBeInTheDocument();
  });

  // 9.5 — a failed refresh shows an error and the interval keeps running so a
  // subsequent tick retries and clears it.
  it("shows a refresh error on failed refresh and retries on a later tick", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Failed to load standings" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });

    // Second tick fails.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("refresh-error")).toHaveTextContent("Failed to load standings");

    // Third tick retries (interval still running) and clears the error.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.queryByTestId("refresh-error")).not.toBeInTheDocument();
    });
  });

  // 9.6 — zero-contribution data shows the empty-standings indicator.
  it("shows the empty-standings indicator when there are zero contributions", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        standings: [],
        analytics: {
          configuredSources: 2,
          uniqueContributingAttendees: 0,
          totalAcceptedContributions: 0,
          greatestCombinedScore: 0,
        },
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-standings")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("standings")).not.toBeInTheDocument();
  });

  // 9.7 — a Manual_Mode instance shows the direct-awards indicator.
  it("shows the manual-mode chip and direct-awards indicator when mode is manual", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ mode: "manual" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("standings")).toBeInTheDocument();
    });
    expect(screen.getByTestId("manual-mode-chip")).toBeInTheDocument();
    expect(screen.getByTestId("manual-mode-indicator")).toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LeaderboardLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
