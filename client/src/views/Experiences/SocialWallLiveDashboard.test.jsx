import React from "react";
import { render, screen, waitFor, act, within, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SocialWallLiveDashboard from "./SocialWallLiveDashboard";
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
          element={<SocialWallLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A social-wall live-stats payload matching the getLiveStats shape the dashboard
// consumes: { experienceType, state, experienceName, totalPosts,
// postsByStatus:{pending,approved,hidden,removed}, removedContentCount,
// totalReactions, uniquePosters, uniqueReactors, feed:[...], moderationQueue:[...] }.
// Wrapped exactly as the service returns: { data: { data: ... }, status, headers:{etag} }.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: { etag: 'W/"social-wall-v1"' },
  data: {
    data: {
      experienceType: "social-wall",
      state: "Live",
      experienceName: "Festival Social Wall",
      totalPosts: 20,
      postsByStatus: { pending: 5, approved: 12, hidden: 2, removed: 1 },
      removedContentCount: 1,
      totalReactions: 88,
      uniquePosters: 14,
      uniqueReactors: 31,
      feed: [
        {
          postId: "post-a",
          text: "Loving the main stage vibes",
          mediaReference: "https://cdn.example.com/social/post-a.jpg",
          reactionCount: 42,
          createdAt: "2024-06-01T18:30:00.000Z",
        },
        {
          postId: "post-b",
          text: "Best food trucks ever",
          mediaReference: "storage-key-only",
          reactionCount: 17,
          createdAt: "2024-06-01T19:00:00.000Z",
        },
      ],
      moderationQueue: [
        {
          postId: "pend-1",
          text: "Sunset over the crowd",
          mediaReference: "https://cdn.example.com/social/pend-1.jpg",
          createdAt: "2024-06-01T18:45:00.000Z",
        },
        {
          postId: "pend-2",
          text: "Backstage sneak peek",
          mediaReference: "storage-key-only",
          createdAt: "2024-06-01T19:15:00.000Z",
        },
      ],
      ...overrides,
    },
  },
});

describe("SocialWallLiveDashboard", () => {
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

  // 13.1 — renders without crashing and shows the current metrics.
  it("renders without crashing and shows current metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-posts")).toBeInTheDocument();
    });
    expect(screen.getByTestId("state-chip")).toHaveTextContent("LIVE");
    expect(screen.getByTestId("total-posts")).toHaveTextContent("20");
  });

  // 13.2 — advancing 2s while Live triggers another getLiveStats call, invoked
  // with (eventId, experienceId, config object).
  it("polls getLiveStats every 2 seconds while Live", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-posts")).toBeInTheDocument();
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

  // 13.3 — pending posts render approve + remove controls; clicking them calls
  // the moderation action with the correct action + postId.
  it("renders approve/remove controls for pending posts and calls the moderation action", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("moderation-item-pend-1")).toBeInTheDocument();
    });

    const item1 = screen.getByTestId("moderation-item-pend-1");
    expect(within(item1).getByText("Sunset over the crowd")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-photo-pend-1")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-time-pend-1")).toBeInTheDocument();
    expect(screen.getByTestId("approve-pend-1")).toBeInTheDocument();
    expect(screen.getByTestId("remove-pend-1")).toBeInTheDocument();

    // Approve the first pending post.
    fireEvent.click(screen.getByTestId("approve-pend-1"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "approve",
        postId: "pend-1",
      });
    });

    // Remove the second pending post.
    fireEvent.click(screen.getByTestId("remove-pend-2"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "remove",
        postId: "pend-2",
      });
    });
  });

  // 13.4 — approved posts render hide + remove controls; clicking them calls the
  // moderation action with the correct action + postId.
  it("renders hide/remove controls for approved posts and calls the moderation action", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("approved-item-post-a")).toBeInTheDocument();
    });

    const itemA = screen.getByTestId("approved-item-post-a");
    expect(within(itemA).getByText("Loving the main stage vibes")).toBeInTheDocument();
    expect(screen.getByTestId("hide-post-a")).toBeInTheDocument();
    expect(screen.getByTestId("approved-remove-post-a")).toBeInTheDocument();

    // Hide the first approved post.
    fireEvent.click(screen.getByTestId("hide-post-a"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "hide",
        postId: "post-a",
      });
    });

    // Remove the second approved post.
    fireEvent.click(screen.getByTestId("approved-remove-post-b"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "remove",
        postId: "post-b",
      });
    });
  });

  // Unapprove: an approved post exposes an Unapprove control that sends the
  // 'unapprove' action (returns the post to the moderation queue as pending) and
  // optimistically drops it from the approved feed.
  it("renders an unapprove control for approved posts and calls the moderation action", async () => {
    // First poll: post-a is approved. After unapprove, the follow-up poll returns
    // post-a back in the moderation queue as pending and gone from the approved
    // feed — mirroring the server recompute (the background refresh).
    const approvedResponse = mockStatsResponse();
    const afterUnapproveResponse = mockStatsResponse({
      // Different ETag so the poll returns 200 (not 304) and re-renders.
      // (headers overridden below.)
    });
    // post-a leaves the feed and joins the moderation queue as pending.
    afterUnapproveResponse.headers = { etag: 'W/"social-wall-v2"' };
    afterUnapproveResponse.data.data.feed = afterUnapproveResponse.data.data.feed.filter(
      (p) => p.postId !== "post-a"
    );
    afterUnapproveResponse.data.data.moderationQueue = [
      ...afterUnapproveResponse.data.data.moderationQueue,
      {
        postId: "post-a",
        text: "Loving the main stage vibes",
        mediaReference: "https://cdn.example.com/social/post-a.jpg",
        createdAt: "2024-06-01T18:30:00.000Z",
      },
    ];
    afterUnapproveResponse.data.data.postsByStatus = {
      pending: 6,
      approved: 11,
      hidden: 2,
      removed: 1,
    };

    getLiveStats
      .mockResolvedValueOnce(approvedResponse) // initial load
      .mockResolvedValue(afterUnapproveResponse); // the refresh after unapprove (and later polls)

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("approved-item-post-a")).toBeInTheDocument();
    });

    expect(screen.getByTestId("unapprove-post-a")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("unapprove-post-a"));
    await waitFor(() => {
      expect(transitionState).toHaveBeenCalledWith(EVENT_ID, EXPERIENCE_ID, {
        action: "unapprove",
        postId: "post-a",
      });
    });

    // Removed from the approved feed (moved back to pending)...
    await waitFor(() => {
      expect(screen.queryByTestId("approved-item-post-a")).not.toBeInTheDocument();
    });

    // ...and the background refresh brings it into the moderation queue, where it
    // renders (the optimistic 'pending' override is reconciled/cleared once the
    // server payload lists it there).
    await waitFor(() => {
      expect(screen.getByTestId("moderation-item-post-a")).toBeInTheDocument();
    });
  });

  // 13.5 — provided metrics render total posts, per-status counts, and total
  // reactions.
  it("renders total posts, per-status counts, and total reactions", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-posts")).toBeInTheDocument();
    });

    expect(screen.getByTestId("total-posts")).toHaveTextContent("20");
    expect(screen.getByTestId("total-reactions")).toHaveTextContent("88");
    expect(screen.getByTestId("unique-posters")).toHaveTextContent("14");
    expect(screen.getByTestId("status-pending")).toHaveTextContent("5");
    expect(screen.getByTestId("status-approved")).toHaveTextContent("12");
    expect(screen.getByTestId("status-hidden")).toHaveTextContent("2");
    expect(screen.getByTestId("status-removed")).toHaveTextContent("1");
  });

  // 13.6 — activating big-screen mode renders the projection showing only
  // approved posts and auto-advances every 5s.
  it("renders the big-screen projection of approved posts and auto-advances every 5 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("big-screen-toggle")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("big-screen-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("big-screen")).toBeInTheDocument();
    });
    // First approved post is shown.
    expect(screen.getByTestId("big-screen-text")).toHaveTextContent(
      "Loving the main stage vibes"
    );

    // Advancing 5s auto-advances to the next approved post.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => {
      expect(screen.getByTestId("big-screen-text")).toHaveTextContent(
        "Best food trucks ever"
      );
    });
  });

  // 13.7 — a failed refresh shows an error and the interval keeps running so a
  // subsequent tick retries.
  it("shows a refresh error on failed refresh and retries on a later tick", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-posts")).toBeInTheDocument();
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

  // 13.8 — zero approved posts renders the empty-state indicator.
  it("shows an empty-state indicator when there are zero approved posts", async () => {
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        postsByStatus: { pending: 0, approved: 0, hidden: 0, removed: 0 },
        totalReactions: 0,
        uniquePosters: 0,
        uniqueReactors: 0,
        feed: [],
      })
    );
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No approved posts yet.");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SocialWallLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
