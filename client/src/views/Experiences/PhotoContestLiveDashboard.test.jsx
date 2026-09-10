import React from "react";
import { render, screen, waitFor, act, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PhotoContestLiveDashboard from "./PhotoContestLiveDashboard";
import { getLiveStats, transitionState } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  transitionState: jest.fn(),
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
          element={<PhotoContestLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A photo-contests live-stats payload matching the getAnalytics shape the
// dashboard consumes: { experienceType, state, phase?, totalSubmissions,
// submissionsByStatus:{pending,approved,rejected}, totalValidVotes,
// uniqueSubmitters, uniqueVoters, moderationQueue?, ranking?, winnerCount? }.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "photo-contests",
      state: "Live",
      phase: "submission",
      totalSubmissions: 12,
      submissionsByStatus: { pending: 3, approved: 8, rejected: 1 },
      totalValidVotes: 40,
      uniqueSubmitters: 9,
      uniqueVoters: 25,
      moderationQueue: [
        {
          submissionId: "sub-1",
          mediaReference: "https://cdn.example.com/photos/sub-1.jpg",
          caption: "Sunset over the main stage",
          submittedAt: "2024-06-01T18:30:00.000Z",
        },
        {
          submissionId: "sub-2",
          mediaReference: "storage-key-only",
          caption: "Crowd shot",
          submittedAt: "2024-06-01T19:00:00.000Z",
        },
      ],
      ...overrides,
    },
  },
});

// A results-phase payload with a ranking that flags winners via winnerCount.
const mockResultsResponse = (overrides = {}) =>
  mockStatsResponse({
    phase: "results",
    winnerCount: 1,
    moderationQueue: [],
    submissionsByStatus: { pending: 0, approved: 8, rejected: 1 },
    ranking: [
      { rank: 1, submissionId: "sub-a", caption: "Winning shot", voteCount: 30 },
      { rank: 2, submissionId: "sub-b", caption: "Runner up", voteCount: 10 },
    ],
    ...overrides,
  });

describe("PhotoContestLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    transitionState.mockResolvedValue({ status: 200, data: {} });
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
      expect(screen.getByTestId("total-submissions")).toBeInTheDocument();
    });
    // Header LIVE chip + submission phase chip.
    expect(screen.getByTestId("state-chip")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("phase-chip")).toBeInTheDocument();
    expect(screen.getByTestId("total-submissions")).toHaveTextContent("12");
  });

  // 11.2 — advancing 2s while Live triggers another getLiveStats call, invoked
  // with (eventId, experienceId, config object).
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-submissions")).toBeInTheDocument();
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

  // 11.3 — pending submissions render approve + reject controls; clicking them
  // calls the moderation action with the correct action + submissionId.
  it("renders approve/reject controls for pending submissions and calls the moderation action", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("moderation-item-sub-1")).toBeInTheDocument();
    });

    const item1 = screen.getByTestId("moderation-item-sub-1");
    expect(within(item1).getByText("Sunset over the main stage")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-photo-sub-1")).toBeInTheDocument();
    expect(screen.getByTestId("approve-sub-1")).toBeInTheDocument();
    expect(screen.getByTestId("reject-sub-1")).toBeInTheDocument();

    // Approve the first submission.
    fireEvent.click(screen.getByTestId("approve-sub-1"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "approve",
        submissionId: "sub-1",
      });
    });

    // Reject the second submission.
    fireEvent.click(screen.getByTestId("reject-sub-2"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "reject",
        submissionId: "sub-2",
      });
    });
  });

  // 11.4 — provided metrics render totals, per-status counts, total votes, and
  // unique submitters/voters.
  it("renders totals, per-status counts, total votes, and unique submitters/voters", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-submissions")).toBeInTheDocument();
    });

    expect(screen.getByTestId("total-submissions")).toHaveTextContent("12");
    expect(screen.getByTestId("total-valid-votes")).toHaveTextContent("40");
    expect(screen.getByTestId("unique-submitters")).toHaveTextContent("9");
    expect(screen.getByTestId("unique-voters")).toHaveTextContent("25");
    expect(screen.getByTestId("status-pending")).toHaveTextContent("3");
    expect(screen.getByTestId("status-approved")).toHaveTextContent("8");
    expect(screen.getByTestId("status-rejected")).toHaveTextContent("1");
  });

  // 11.5 — results-phase data renders the ranking with rank/vote-count and flags
  // winners.
  it("renders the ranking with rank and vote counts and flags winners in the results phase", async () => {
    getLiveStats.mockResolvedValue(mockResultsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("ranking")).toBeInTheDocument();
    });

    expect(screen.getByTestId("phase-chip")).toHaveTextContent("Results");

    const rowA = screen.getByTestId("ranking-row-sub-a");
    expect(within(rowA).getByText("#1")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-votes-sub-a")).toHaveTextContent("30");
    // Top entry within winnerCount is flagged as a winner.
    expect(screen.getByTestId("winner-sub-a")).toBeInTheDocument();

    const rowB = screen.getByTestId("ranking-row-sub-b");
    expect(within(rowB).getByText("#2")).toBeInTheDocument();
    expect(screen.getByTestId("ranking-votes-sub-b")).toHaveTextContent("10");
    // Second entry is outside winnerCount, so it is not flagged.
    expect(screen.queryByTestId("winner-sub-b")).not.toBeInTheDocument();
  });

  // 11.6 — a failed refresh shows an error and keeps polling; a later tick
  // succeeds and clears it.
  it("shows a refresh error on failed refresh and clears it on a later successful tick", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-submissions")).toBeInTheDocument();
    });

    // Second tick fails.
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(screen.getByTestId("refresh-error")).toBeInTheDocument();
    });
    expect(screen.getByTestId("refresh-error")).toHaveTextContent("Server error");

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

  // 11.7 — zero submissions renders the empty-state indicator.
  it("shows an empty-state indicator when there are zero submissions", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        totalSubmissions: 0,
        submissionsByStatus: { pending: 0, approved: 0, rejected: 0 },
        totalValidVotes: 0,
        uniqueSubmitters: 0,
        uniqueVoters: 0,
        moderationQueue: [],
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No photo submissions yet.");
  });

  // Closed — a closed indicator renders and polling stops.
  it("shows a closed indicator and stops polling while Closed", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ state: "Closed" }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("state-chip")).toHaveTextContent("CLOSED");
    });
    expect(screen.getByTestId("closed-indicator")).toBeInTheDocument();
    // Final metrics still render.
    expect(screen.getByTestId("total-submissions")).toHaveTextContent("12");

    // Polling stops while Closed — no further calls after the initial load.
    expect(getLiveStats).toHaveBeenCalledTimes(1);
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PhotoContestLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
