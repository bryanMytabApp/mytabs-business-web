import React from "react";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LivePollLiveDashboard from "./LivePollLiveDashboard";
import {
  getLiveStats,
  setPollState,
  getInstance,
  exportAnalytics,
} from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  setPollState: jest.fn(),
  getInstance: jest.fn(),
  exportAnalytics: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<LivePollLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A results payload with two polls in varied states.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "live-polls",
      state: "Live",
      totalVotes: 100,
      uniqueVoters: 80,
      results: [
        {
          pollId: "poll-1",
          question: "Best food truck?",
          state: "open",
          totalVotes: 100,
          options: [
            { id: "a", label: "Tacos", count: 42, percentage: 42.0 },
            { id: "b", label: "BBQ", count: 58, percentage: 58.0 },
          ],
        },
        {
          pollId: "poll-2",
          question: "Rate the venue",
          state: "draft",
          totalVotes: 0,
          options: [
            { id: "c", label: "Great", count: 0, percentage: 0 },
            { id: "d", label: "Okay", count: 0, percentage: 0 },
          ],
        },
      ],
      ...overrides,
    },
  },
});

describe("LivePollLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // 7.1 — renders without crashing and shows each poll's state.
  it("renders each poll with its current state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });
    expect(screen.getByText("Rate the venue")).toBeInTheDocument();
    expect(screen.getByTestId("poll-state-poll-1")).toHaveTextContent("OPEN");
    expect(screen.getByTestId("poll-state-poll-2")).toHaveTextContent("DRAFT");
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 7.2 — advancing 5s triggers another getLiveStats.
  it("polls getLiveStats every 5 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 7.3 — renders proportional bars with counts + percentages.
  it("renders proportional bars with counts and percentages", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    const bar = screen.getByTestId("opt-bar-poll-1-b");
    expect(bar).toHaveStyle("width: 58%");
    expect(screen.getByTestId("opt-stat-poll-1-a")).toHaveTextContent("42 · 42%");
    expect(screen.getByTestId("opt-stat-poll-1-b")).toHaveTextContent("58 · 58%");
  });

  // 7.4 — open control calls the action and reflects new state.
  it("opens a draft poll and optimistically reflects the open state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setPollState.mockResolvedValue({ data: { data: { pollId: "poll-2", state: "open" } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Rate the venue")).toBeInTheDocument();
    });

    const card = screen.getByTestId("poll-card-poll-2");
    fireEvent.click(within(card).getByRole("button", { name: /Open Poll/i }));

    await waitFor(() => {
      expect(setPollState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "open_poll",
        pollId: "poll-2",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("poll-state-poll-2")).toHaveTextContent("OPEN");
    });
  });

  // 7.5 — close control calls the action and reflects new state.
  it("closes an open poll and optimistically reflects the closed state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setPollState.mockResolvedValue({ data: { data: { pollId: "poll-1", state: "closed" } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("poll-card-poll-1");
    fireEvent.click(within(card).getByRole("button", { name: /Close Poll/i }));

    await waitFor(() => {
      expect(setPollState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "close_poll",
        pollId: "poll-1",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("poll-state-poll-1")).toHaveTextContent("CLOSED");
    });
  });

  // 7.6 — close control disabled for draft polls.
  it("disables the close control for draft polls", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Rate the venue")).toBeInTheDocument();
    });

    const draftCard = screen.getByTestId("poll-card-poll-2");
    expect(within(draftCard).getByRole("button", { name: /Close Poll/i })).toBeDisabled();
    // Open is enabled for a draft poll.
    expect(within(draftCard).getByRole("button", { name: /Open Poll/i })).not.toBeDisabled();

    // For an open poll, close is enabled and open is disabled.
    const openCard = screen.getByTestId("poll-card-poll-1");
    expect(within(openCard).getByRole("button", { name: /Close Poll/i })).not.toBeDisabled();
    expect(within(openCard).getByRole("button", { name: /Open Poll/i })).toBeDisabled();
  });

  // 7.7 — failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    // Second tick fails.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // Third tick retries (interval still running) and clears the error.
    act(() => {
      jest.advanceTimersByTime(5000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.queryByText("Server error")).not.toBeInTheDocument();
    });
  });

  // 7.8 — zero-vote polls show a zero indicator per option.
  it("shows a zero-count indicator for zero-vote polls", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Rate the venue")).toBeInTheDocument();
    });

    const zeroCard = screen.getByTestId("poll-card-poll-2");
    expect(within(zeroCard).getByText("No votes yet")).toBeInTheDocument();
    expect(within(zeroCard).getByTestId("opt-stat-poll-2-c")).toHaveTextContent("0 · 0%");
    expect(within(zeroCard).getByTestId("opt-stat-poll-2-d")).toHaveTextContent("0 · 0%");
    // Bars render at 0% width.
    expect(within(zeroCard).getByTestId("opt-bar-poll-2-c")).toHaveStyle("width: 0%");
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
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(5000);
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
    expect(screen.getByText("Best food truck?")).toBeInTheDocument();
  });

  // A stats payload where poll-1 carries a schedule window.
  const scheduledStatsResponse = () => {
    const base = mockStatsResponse();
    base.data.data.results[0] = {
      ...base.data.data.results[0],
      scheduled: true,
      scheduledOpenAt: "2025-06-01T12:00:00.000Z",
      scheduledCloseAt: "2025-06-01T14:00:00.000Z",
    };
    return base;
  };

  // 7.9 — a scheduled poll shows the SCHEDULED chip and its window.
  it("shows a scheduled chip and window for a scheduled poll", async () => {
    getLiveStats.mockResolvedValue(scheduledStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("poll-scheduled-poll-1")).toBeInTheDocument();
    });
    expect(screen.getByTestId("poll-schedule-poll-1")).toHaveTextContent(/Opens/);
    expect(screen.getByTestId("poll-schedule-poll-1")).toHaveTextContent(/Closes/);
    // A manual (unscheduled) poll shows no scheduled chip.
    expect(screen.queryByTestId("poll-scheduled-poll-2")).not.toBeInTheDocument();
  });

  // 7.10 — summary metrics reflect the aggregate totals.
  it("renders total votes and unique voters summary metrics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("poll-total-votes")).toHaveTextContent("100");
    });
    expect(screen.getByTestId("poll-unique-voters")).toHaveTextContent("80");
    expect(screen.getByTestId("poll-count")).toHaveTextContent("2");
  });

  // 7.11 — View Config opens a modal populated from getInstance.
  it("opens the View Config modal with instance config", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    getInstance.mockResolvedValue({
      data: {
        data: {
          name: "GOAT Poll",
          state: "Live",
          config: {
            polls: [
              {
                id: "poll-1",
                question: "Best food truck?",
                selectionMode: "single",
                options: [{ id: "a", label: "Tacos" }],
                scheduledOpenAt: "2025-06-01T12:00:00.000Z",
                scheduledCloseAt: "2025-06-01T14:00:00.000Z",
              },
            ],
          },
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /View Config/i }));

    await waitFor(() => {
      expect(getInstance).toHaveBeenCalledWith("evt-123", "exp-456");
    });
    // Wait for the loaded config content (name + schedule summary) to render.
    await waitFor(() => {
      expect(screen.getByText("GOAT Poll")).toBeInTheDocument();
    });
    const modal = screen.getByTestId("poll-config-modal");
    expect(within(modal).getByText(/Auto:/)).toBeInTheDocument();
  });

  // 7.12 — Export triggers a download via exportAnalytics.
  it("exports results via exportAnalytics", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    exportAnalytics.mockResolvedValue({ data: "col1,col2\n1,2", headers: { "content-type": "text/csv" } });
    // jsdom lacks URL.createObjectURL — stub it for the download flow.
    const createObjectURL = jest.fn(() => "blob:mock");
    const revokeObjectURL = jest.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    renderComponent();
    await waitFor(() => {
      expect(screen.getByText("Best food truck?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Export/i }));

    await waitFor(() => {
      expect(exportAnalytics).toHaveBeenCalledWith("evt-123", "exp-456", { format: "csv" });
    });
    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalled();
    });
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LivePollLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
