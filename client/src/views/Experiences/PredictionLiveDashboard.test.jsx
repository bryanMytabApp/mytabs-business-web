import React from "react";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PredictionLiveDashboard from "./PredictionLiveDashboard";
import { getLiveStats, setMarketState } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  setMarketState: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<PredictionLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A prediction live-stats payload. By default m1 is open (with a future close
// deadline + distribution), m2 is open with zero predictions, m3 is locked.
const futureIso = () => new Date(Date.now() + 60 * 1000).toISOString();

const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "prediction-challenges",
      state: "Live",
      markets: [
        {
          id: "m1",
          question: "Who will win the final?",
          options: [
            { id: "a", label: "Falcons" },
            { id: "b", label: "Vipers" },
          ],
          closeDeadline: futureIso(),
          pointValue: 50,
          marketState: "open",
          lockedAt: null,
          resolvedAt: null,
          actualOutcomeId: null,
        },
        {
          id: "m2",
          question: "Total goals over 2.5?",
          options: [
            { id: "c", label: "Over" },
            { id: "d", label: "Under" },
          ],
          closeDeadline: futureIso(),
          pointValue: 30,
          marketState: "open",
          lockedAt: null,
          resolvedAt: null,
          actualOutcomeId: null,
        },
        {
          id: "m3",
          question: "First to score?",
          options: [
            { id: "e", label: "Home" },
            { id: "f", label: "Away" },
          ],
          closeDeadline: futureIso(),
          pointValue: 40,
          marketState: "locked",
          lockedAt: new Date().toISOString(),
          resolvedAt: null,
          actualOutcomeId: null,
        },
      ],
      leaderboard: {
        entries: [
          { attendeeId: "user-2", totalScore: 40, rank: 3 },
          { attendeeId: "user-1", totalScore: 90, rank: 1 },
          { attendeeId: "user-3", totalScore: 90, rank: 1 },
        ],
      },
      distributions: [
        {
          marketId: "m1",
          marketState: "open",
          actualOutcomeId: null,
          totalPredictions: 100,
          options: [
            { id: "a", label: "Falcons", count: 65, percentage: 65.0, actual: false },
            { id: "b", label: "Vipers", count: 35, percentage: 35.0, actual: false },
          ],
        },
        {
          marketId: "m2",
          marketState: "open",
          actualOutcomeId: null,
          totalPredictions: 0,
          options: [
            { id: "c", label: "Over", count: 0, percentage: 0, actual: false },
            { id: "d", label: "Under", count: 0, percentage: 0, actual: false },
          ],
        },
        {
          marketId: "m3",
          marketState: "locked",
          actualOutcomeId: null,
          totalPredictions: 50,
          options: [
            { id: "e", label: "Home", count: 30, percentage: 60.0, actual: false },
            { id: "f", label: "Away", count: 20, percentage: 40.0, actual: false },
          ],
        },
      ],
      totalPredictions: 150,
      uniqueAttendees: 120,
      ...overrides,
    },
  },
});

describe("PredictionLiveDashboard", () => {
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

  // 10.1 — renders without crashing and shows each market's state.
  it("renders each market with its current state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });
    expect(screen.getByText("Total goals over 2.5?")).toBeInTheDocument();
    expect(screen.getByTestId("market-state-m1")).toHaveTextContent("OPEN");
    expect(screen.getByTestId("market-state-m2")).toHaveTextContent("OPEN");
    expect(screen.getByTestId("market-state-m3")).toHaveTextContent("LOCKED");
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 10.2 — an open market renders its question, options, and close-deadline countdown.
  it("renders the open market question, options, and countdown", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });
    const card = screen.getByTestId("market-card-m1");
    // Outcome options render in the distribution rows. The labels also appear
    // in the resolve selector, so scope to the distribution stat rows to keep
    // the assertion unambiguous.
    expect(within(card).getAllByText("Falcons").length).toBeGreaterThanOrEqual(1);
    expect(within(card).getByTestId("opt-stat-m1-a")).toBeInTheDocument();
    expect(within(card).getByTestId("opt-stat-m1-b")).toBeInTheDocument();
    // Countdown bar present for the open market.
    expect(screen.getByTestId("countdown-m1")).toBeInTheDocument();
  });

  // 10.3 — advancing 2s triggers another getLiveStats call.
  it("polls getLiveStats every 2 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 10.4 — lock reflects locked.
  it("locks an open market and optimistically reflects the locked state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setMarketState.mockResolvedValue({
      data: { data: { marketId: "m1", market: { id: "m1", marketState: "locked", lockedAt: new Date().toISOString() } } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("market-card-m1");
    fireEvent.click(within(card).getByRole("button", { name: /Lock/i }));

    await waitFor(() => {
      expect(setMarketState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "lock_market",
        marketId: "m1",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("market-state-m1")).toHaveTextContent("LOCKED");
    });
  });

  // 10.5 — resolve on a locked market declares an actual outcome and displays it.
  it("resolves a locked market with an actual outcome and shows the distribution + leaderboard", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setMarketState.mockResolvedValue({
      data: { data: { marketId: "m3", market: { id: "m3", marketState: "resolved", actualOutcomeId: "e", resolvedAt: new Date().toISOString() } } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("First to score?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("market-card-m3");
    // Choose the actual outcome then resolve.
    fireEvent.mouseDown(within(card).getByLabelText(/Actual outcome for market m3/i));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Home"));
    fireEvent.click(within(card).getByRole("button", { name: /Resolve/i }));

    await waitFor(() => {
      expect(setMarketState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "resolve_market",
        marketId: "m3",
        outcomeId: "e",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("market-state-m3")).toHaveTextContent("RESOLVED");
    });
    // Actual outcome (Home) is highlighted with a checkmark after resolution.
    const resolvedCard = screen.getByTestId("market-card-m3");
    expect(within(resolvedCard).getByText(/Home ✓/)).toBeInTheDocument();
    // Distribution counts render for m3.
    expect(screen.getByTestId("opt-stat-m3-e")).toHaveTextContent("30 · 60%");
    // Leaderboard is present.
    expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
  });

  // 10.6 — resolve is disabled/rejected for an open market with a must-be-locked message.
  it("disables resolve for an open market and surfaces a must-be-locked message", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("market-card-m1");
    // The resolve control is disabled for an open market.
    const resolveBtn = within(card).getByRole("button", { name: /Resolve/i });
    expect(resolveBtn).toBeDisabled();

    // The server is never called for an open market.
    expect(setMarketState).not.toHaveBeenCalledWith(
      "evt-123",
      "exp-456",
      expect.objectContaining({ action: "resolve_market", marketId: "m1" })
    );
  });

  // 10.7 — provided distribution data renders proportional bars with counts/percentages.
  it("renders proportional distribution bars with counts and percentages", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
    });

    const bar = screen.getByTestId("opt-bar-m1-a");
    expect(bar).toHaveStyle("width: 65%");
    expect(screen.getByTestId("opt-stat-m1-a")).toHaveTextContent("65 · 65%");
    expect(screen.getByTestId("opt-stat-m1-b")).toHaveTextContent("35 · 35%");
  });

  // 10.8 — leaderboard rows render ordered by ascending rank with rank + total.
  it("renders leaderboard rows ordered by ascending rank with rank and total", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId(/^leaderboard-row-/);
    // Ordered by ascending rank: rank 1 (user-1), rank 1 (user-3), rank 3 (user-2).
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[0]).toHaveTextContent("90 pts");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("40 pts");
  });

  // 10.9 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Who will win the final?")).toBeInTheDocument();
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

  // 10.10 — zero-prediction markets show zero indicators.
  it("shows a zero-count indicator for zero-prediction markets", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Total goals over 2.5?")).toBeInTheDocument();
    });

    const zeroCard = screen.getByTestId("market-card-m2");
    expect(within(zeroCard).getByText("No predictions yet")).toBeInTheDocument();
    expect(within(zeroCard).getByTestId("opt-stat-m2-c")).toHaveTextContent("0 · 0%");
    expect(within(zeroCard).getByTestId("opt-stat-m2-d")).toHaveTextContent("0 · 0%");
    // Bars render at 0% width.
    expect(within(zeroCard).getByTestId("opt-bar-m2-c")).toHaveStyle("width: 0%");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PredictionLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
