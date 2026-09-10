import React from "react";
import { render, screen, waitFor, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TreasureHuntLiveDashboard from "./TreasureHuntLiveDashboard";
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
          element={<TreasureHuntLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A treasure-hunts live-stats payload matching the backend index.js shape:
// counts = { totalClaims, checkpoints:[{ checkpointId, hint, claimCount }] } and
// leaderboard = bare array [{ attendeeId, score, claimedCount, completionState, rank }].
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "treasure-hunts",
      state: "Live",
      huntMode: "free-roam",
      completionThreshold: 2,
      completionBonus: { enabled: false },
      timeLimit: null,
      liveStartedAt: null,
      counts: {
        totalClaims: 45,
        checkpoints: [
          { checkpointId: "c1", hint: "The mural", claimCount: 30 },
          { checkpointId: "c2", hint: "The old tree", claimCount: 15 },
          { checkpointId: "c3", hint: "The fountain", claimCount: 0 },
        ],
      },
      leaderboard: [
        { attendeeId: "user-2", score: 40, claimedCount: 1, completionState: "in-progress", rank: 3 },
        { attendeeId: "user-1", score: 90, claimedCount: 3, completionState: "complete", rank: 1 },
        { attendeeId: "user-3", score: 90, claimedCount: 3, completionState: "complete", rank: 1 },
      ],
      totalClaims: 45,
      uniqueAttendees: 20,
      ...overrides,
    },
  },
});

describe("TreasureHuntLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(async () => {
    // The dashboard schedules a 2s polling interval + a 1s clock. Flush any
    // pending timers/promises inside act so they don't leak into the next test,
    // then clear timers and restore real timers.
    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // 11.1 — renders without crashing and shows each checkpoint with its count.
  it("renders each checkpoint with its claim count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The mural")).toBeInTheDocument();
    });
    expect(screen.getByText("The old tree")).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-count-c1")).toHaveTextContent("30");
    expect(screen.getByTestId("checkpoint-count-c2")).toHaveTextContent("15");
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 11.2 — advancing 2s triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The mural")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 11.3 — provided count data renders proportional bars vs the greatest count.
  it("renders proportional bars against the greatest count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The mural")).toBeInTheDocument();
    });

    // Max count is 30 (c1) → its bar is 100%; c2 (15) → 50%; c3 (0) → 0%.
    expect(screen.getByTestId("checkpoint-bar-c1")).toHaveStyle("width: 100%");
    expect(screen.getByTestId("checkpoint-bar-c2")).toHaveStyle("width: 50%");
    expect(screen.getByTestId("checkpoint-bar-c3")).toHaveStyle("width: 0%");
  });

  // 11.4 — leaderboard rows ordered by ascending rank with rank/score/claimed-
  // count/completion-state.
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
    expect(rows[0]).toHaveTextContent("3 found");
    expect(rows[0]).toHaveTextContent("Complete");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("40 pts");
    expect(rows[2]).toHaveTextContent("In progress");
  });

  // 11.5 — a configured time limit renders a time-remaining readout.
  it("renders a time-remaining readout when a time limit is configured", async () => {
    const startedAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
    getLiveStats.mockResolvedValue(
      mockStatsResponse({ timeLimit: 10, liveStartedAt: startedAt })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("time-remaining")).toBeInTheDocument();
    });
    // 10 min limit, ~1 min elapsed → about 9:00 remaining.
    expect(screen.getByTestId("time-remaining")).toHaveTextContent(/9:0\d left/);
  });

  // 11.5 — no time-remaining readout when no time limit is configured.
  it("omits the time-remaining readout when no time limit is configured", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The mural")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("time-remaining")).not.toBeInTheDocument();
  });

  // 11.6 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The mural")).toBeInTheDocument();
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

  // 11.7 — zero-claim checkpoints show a zero-count indicator.
  it("shows a zero-count indicator for checkpoints with no claims", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("The fountain")).toBeInTheDocument();
    });

    const zeroRow = screen.getByTestId("checkpoint-row-c3");
    expect(within(zeroRow).getByTestId("checkpoint-zero-c3")).toHaveTextContent("Not found yet");
    expect(within(zeroRow).getByTestId("checkpoint-count-c3")).toHaveTextContent("0");
    expect(within(zeroRow).getByTestId("checkpoint-bar-c3")).toHaveStyle("width: 0%");
    // Non-zero checkpoints do not show the indicator.
    expect(screen.queryByTestId("checkpoint-zero-c1")).not.toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./TreasureHuntLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
