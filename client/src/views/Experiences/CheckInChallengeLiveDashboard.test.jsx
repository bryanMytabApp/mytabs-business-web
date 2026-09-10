import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CheckInChallengeLiveDashboard from "./CheckInChallengeLiveDashboard";
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
          element={<CheckInChallengeLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A check-in-challenges live-stats payload matching the backend index.js shape:
// counts.points[{pointId,label,count}], milestones[{id,rewardLabel,grantedCount}],
// and leaderboard{enabled,entries[{attendeeId,score,checkInCount,milestonesGranted,rank}]}.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "check-in-challenges",
      state: "Live",
      leaderboardEnabled: true,
      counts: {
        totalCheckIns: 45,
        points: [
          { pointId: "p1", label: "Main Stage", count: 30 },
          { pointId: "p2", label: "Vendor Row", count: 15 },
          { pointId: "p3", label: "Quiet Zone", count: 0 },
        ],
      },
      milestones: [
        { id: "m1", rewardLabel: "Event Explorer", grantedCount: 5 },
        { id: "m2", rewardLabel: "Sponsor Tour", grantedCount: 2 },
      ],
      leaderboard: {
        enabled: true,
        entries: [
          { attendeeId: "user-2", score: 40, checkInCount: 1, milestonesGranted: 0, rank: 3 },
          { attendeeId: "user-1", score: 90, checkInCount: 3, milestonesGranted: 1, rank: 1 },
          { attendeeId: "user-3", score: 90, checkInCount: 3, milestonesGranted: 1, rank: 1 },
        ],
      },
      totalCheckIns: 45,
      uniqueAttendees: 20,
      ...overrides,
    },
  },
});

describe("CheckInChallengeLiveDashboard", () => {
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

  // 12.1 — renders without crashing and shows each point with its count.
  it("renders each check-in point with its count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Main Stage")).toBeInTheDocument();
    });
    expect(screen.getByText("Vendor Row")).toBeInTheDocument();
    expect(screen.getByTestId("point-count-p1")).toHaveTextContent("30");
    expect(screen.getByTestId("point-count-p2")).toHaveTextContent("15");
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 12.2 — advancing 2s triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Main Stage")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 12.3 — provided count data renders proportional bars vs the greatest count.
  it("renders proportional bars against the greatest count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Main Stage")).toBeInTheDocument();
    });

    // Max count is 30 (Main Stage) → its bar is 100%; Vendor Row (15) → 50%.
    expect(screen.getByTestId("point-bar-p1")).toHaveStyle("width: 100%");
    expect(screen.getByTestId("point-bar-p2")).toHaveStyle("width: 50%");
    expect(screen.getByTestId("point-bar-p3")).toHaveStyle("width: 0%");
  });

  // 12.4 — milestone completion data renders each label + granted count.
  it("renders each milestone label with its granted count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("milestones")).toBeInTheDocument();
    });
    expect(screen.getByText("Event Explorer")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-count-m1")).toHaveTextContent("5 granted");
    expect(screen.getByText("Sponsor Tour")).toBeInTheDocument();
    expect(screen.getByTestId("milestone-count-m2")).toHaveTextContent("2 granted");
  });

  // 12.5 — leaderboard enabled → rows ordered by ascending rank with rank/score/
  // check-in-count/milestones.
  it("renders leaderboard rows ordered by ascending rank", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId(/^leaderboard-row-/);
    // Ordered by ascending rank: rank 1 (user-1), rank 1 (user-3), rank 3 (user-2).
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[0]).toHaveTextContent("90 pts");
    expect(rows[0]).toHaveTextContent("3 check-ins");
    expect(rows[0]).toHaveTextContent("1 milestone");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("40 pts");
  });

  // 12.6 — leaderboard disabled → section omitted.
  it("omits the leaderboard section when the leaderboard is disabled", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({ leaderboardEnabled: false, leaderboard: { enabled: false } })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Main Stage")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("leaderboard")).not.toBeInTheDocument();
  });

  // 12.7 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Main Stage")).toBeInTheDocument();
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

  // 12.8 — zero-count points show a zero-count indicator.
  it("shows a zero-count indicator for points with no check-ins", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Quiet Zone")).toBeInTheDocument();
    });

    const zeroRow = screen.getByTestId("point-row-p3");
    expect(within(zeroRow).getByTestId("point-zero-p3")).toHaveTextContent("No check-ins yet");
    expect(within(zeroRow).getByTestId("point-count-p3")).toHaveTextContent("0");
    expect(within(zeroRow).getByTestId("point-bar-p3")).toHaveStyle("width: 0%");
    // Non-zero points do not show the indicator.
    expect(screen.queryByTestId("point-zero-p1")).not.toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./CheckInChallengeLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
