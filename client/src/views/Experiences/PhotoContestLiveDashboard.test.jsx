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
          // Signed display URL the backend hydrates from the stored S3 key; the raw
          // mediaReference is a bare storage key that can't be rendered directly.
          mediaReference: "photo-contest-submissions/exp/sub-1/photo.jpg",
          mediaUrl: "https://signed.example.com/photos/sub-1.jpg?sig=abc",
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
      gallery: [
        {
          submissionId: "sub-app-1",
          mediaReference: "photo-contest-submissions/exp/sub-app-1/photo.jpg",
          mediaUrl: "https://signed.example.com/photos/sub-app-1.jpg?sig=xyz",
          caption: "Approved fireworks",
          voteCount: 7,
          rank: 1,
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
        gallery: [],
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

  // The moderation-queue photo renders from the backend-signed `mediaUrl`, not the
  // bare stored `mediaReference` (which is an unrenderable S3 key).
  it("renders the moderation photo from the signed mediaUrl", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("moderation-photo-sub-1")).toBeInTheDocument();
    });
    const img = screen.getByTestId("moderation-photo-sub-1");
    expect(img.tagName).toBe("IMG");
    expect(img).toHaveAttribute(
      "src",
      "https://signed.example.com/photos/sub-1.jpg?sig=abc"
    );
  });

  // The Approved Submissions section renders each approved photo with its signed
  // preview and exposes Unapprove + Reject controls that call the moderation action.
  it("renders approved submissions with unapprove/reject controls and calls the moderation action", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("approved-item-sub-app-1")).toBeInTheDocument();
    });

    const item = screen.getByTestId("approved-item-sub-app-1");
    expect(within(item).getByText("Approved fireworks")).toBeInTheDocument();
    const img = screen.getByTestId("approved-photo-sub-app-1");
    expect(img).toHaveAttribute(
      "src",
      "https://signed.example.com/photos/sub-app-1.jpg?sig=xyz"
    );
    expect(screen.getByTestId("approved-votes-sub-app-1")).toHaveTextContent("7");

    // Unapprove sends it back to the queue as pending.
    fireEvent.click(screen.getByTestId("unapprove-sub-app-1"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "unapprove",
        submissionId: "sub-app-1",
      });
    });
    // Optimistically removed from the approved section immediately.
    expect(screen.queryByTestId("approved-item-sub-app-1")).not.toBeInTheDocument();
  });

  // Rejecting an approved submission calls the moderation action with `reject`.
  it("rejects an approved submission from the approved section", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("approved-reject-sub-app-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("approved-reject-sub-app-1"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "reject",
        submissionId: "sub-app-1",
      });
    });
  });

  // Zero approved submissions renders the approved-section empty state.
  it("shows an empty state in the approved section when there are none", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse({ gallery: [] }));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("approved-empty")).toBeInTheDocument();
    });
    expect(screen.getByTestId("approved-empty")).toHaveTextContent(
      "No approved submissions yet."
    );
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PhotoContestLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  // ─── Big Screen mode ──────────────────────────────────────────────────────
  describe("Big Screen mode", () => {
    it("toggles into a full-bleed big-screen showing the top approved photo with its vote count", async () => {
      getLiveStats.mockResolvedValue(mockStatsResponse());
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("big-screen-toggle")).toBeInTheDocument();
      });
      // Not in big-screen mode yet.
      expect(screen.queryByTestId("big-screen")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("big-screen-toggle"));

      // Overlay renders the approved photo (from the signed mediaUrl) + its vote count.
      expect(screen.getByTestId("big-screen")).toBeInTheDocument();
      const photo = screen.getByTestId("big-screen-photo");
      expect(photo).toHaveAttribute(
        "src",
        "https://signed.example.com/photos/sub-app-1.jpg?sig=xyz"
      );
      expect(screen.getByTestId("big-screen-votes")).toHaveTextContent("7");

      // Exit returns to the dashboard.
      fireEvent.click(screen.getByTestId("big-screen-close"));
      expect(screen.queryByTestId("big-screen")).not.toBeInTheDocument();
      expect(screen.getByTestId("total-submissions")).toBeInTheDocument();
    });

    it("shows a big-screen empty state when there are no approved photos", async () => {
      getLiveStats.mockResolvedValue(mockStatsResponse({ gallery: [] }));
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("big-screen-toggle")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId("big-screen-toggle"));

      expect(screen.getByTestId("big-screen-empty")).toBeInTheDocument();
      expect(screen.queryByTestId("big-screen-photo")).not.toBeInTheDocument();
    });
  });

  // ─── Click-to-enlarge lightbox ────────────────────────────────────────────
  describe("Lightbox", () => {
    it("opens a full-size lightbox when an approved photo is clicked and closes it", async () => {
      getLiveStats.mockResolvedValue(mockStatsResponse());
      renderComponent();

      await waitFor(() => {
        expect(screen.getByTestId("approved-photo-sub-app-1")).toBeInTheDocument();
      });
      // Lightbox closed initially.
      expect(screen.queryByTestId("lightbox-photo")).not.toBeInTheDocument();

      // Click the approved thumbnail's container to enlarge.
      fireEvent.click(screen.getByTestId("approved-photo-sub-app-1"));

      const enlarged = screen.getByTestId("lightbox-photo");
      expect(enlarged).toHaveAttribute(
        "src",
        "https://signed.example.com/photos/sub-app-1.jpg?sig=xyz"
      );

      // Close via the close button.
      fireEvent.click(screen.getByTestId("lightbox-close"));
      await waitFor(() => {
        expect(screen.queryByTestId("lightbox-photo")).not.toBeInTheDocument();
      });
    });
  });

  // Edit Windows — the report page must offer a way to change the submission/
  // voting time windows, navigating to the shared config route (which reuses
  // PhotoContestConfig's window editor). Without this an organizer can't open or
  // adjust the voting window except via a manual data edit.
  describe("Edit Windows affordance", () => {
    // Render with a /config route marker so we can assert navigation lands there.
    const renderWithConfigRoute = () =>
      render(
        <MemoryRouter
          initialEntries={[`/admin/my-events/${EVENT_ID}/experiences/${EXPERIENCE_ID}/live`]}
        >
          <Routes>
            <Route
              path="/admin/my-events/:eventId/experiences/:experienceId/live"
              element={<PhotoContestLiveDashboard />}
            />
            <Route
              path="/admin/my-events/:eventId/experiences/:experienceId/config"
              element={<div data-testid="config-route">config screen</div>}
            />
          </Routes>
        </MemoryRouter>
      );

    it("renders an Edit Windows button on the report page", async () => {
      getLiveStats.mockResolvedValue(mockStatsResponse());
      renderComponent();
      await waitFor(() => {
        expect(screen.getByTestId("edit-windows")).toBeInTheDocument();
      });
      expect(screen.getByTestId("edit-windows")).toHaveTextContent(/edit windows/i);
    });

    it("navigates to the config route when Edit Windows is clicked", async () => {
      getLiveStats.mockResolvedValue(mockStatsResponse());
      renderWithConfigRoute();
      await waitFor(() => {
        expect(screen.getByTestId("edit-windows")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId("edit-windows"));

      await waitFor(() => {
        expect(screen.getByTestId("config-route")).toBeInTheDocument();
      });
    });
  });
});
