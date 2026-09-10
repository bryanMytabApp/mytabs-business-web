import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PulseFeedbackLiveDashboard from "./PulseFeedbackLiveDashboard";
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
          element={<PulseFeedbackLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A pulse live-stats payload with a populated aggregate and an ascending trend.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "pulse-feedback",
      state: "Live",
      prompt: "How's it going right now?",
      reactionType: "mood",
      aggregate: {
        totalReactions: 100,
        uniqueReactors: 63,
        averageSentiment: 3.12,
        options: [
          { id: "bad", label: "Not great", count: 4, percentage: 4.0 },
          { id: "meh", label: "It was okay", count: 12, percentage: 12.0 },
          { id: "good", label: "Pretty good", count: 46, percentage: 46.0 },
          { id: "great", label: "Loved it!", count: 38, percentage: 38.0 },
        ],
      },
      trend: {
        intervalSeconds: 60,
        liveStartedAt: "2025-01-01T12:00:00.000Z",
        intervals: [
          { startTime: "2025-01-01T12:00:00.000Z", count: 18, averageSentiment: 2.94 },
          { startTime: "2025-01-01T12:01:00.000Z", count: 25, averageSentiment: 3.08 },
          { startTime: "2025-01-01T12:03:00.000Z", count: 57, averageSentiment: 3.21 },
        ],
      },
      ...overrides,
    },
  },
});

// A zero-reaction payload.
const mockZeroResponse = () =>
  mockStatsResponse({
    aggregate: {
      totalReactions: 0,
      uniqueReactors: 0,
      averageSentiment: 0,
      options: [
        { id: "bad", label: "Not great", count: 0, percentage: 0 },
        { id: "great", label: "Loved it!", count: 0, percentage: 0 },
      ],
    },
    trend: { intervalSeconds: 60, liveStartedAt: null, intervals: [] },
  });

describe("PulseFeedbackLiveDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // 8.1 — renders without crashing and shows the prompt + configured options.
  it("renders the prompt and configured reaction options", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("pulse-prompt")).toHaveTextContent("How's it going right now?");
    });
    expect(screen.getByText("Not great")).toBeInTheDocument();
    expect(screen.getByText("Loved it!")).toBeInTheDocument();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 8.2 — advancing 5s triggers another getLiveStats.
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

  // 8.3 — aggregate renders proportional bars with counts + percentages.
  it("renders proportional bars with counts and percentages", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Pretty good")).toBeInTheDocument();
    });

    expect(screen.getByTestId("opt-bar-good")).toHaveStyle("width: 46%");
    expect(screen.getByTestId("opt-bar-great")).toHaveStyle("width: 38%");
    expect(screen.getByTestId("opt-stat-good")).toHaveTextContent("46 · 46%");
    expect(screen.getByTestId("opt-stat-bad")).toHaveTextContent("4 · 4%");
  });

  // 8.4 — shows the average sentiment and unique reactor count.
  it("shows the average sentiment and unique reactor count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("avg-sentiment")).toHaveTextContent("3.12");
    });
    expect(screen.getByTestId("unique-reactors")).toHaveTextContent("63");
  });

  // 8.5 — trend data renders an ascending-ordered time-series.
  it("renders the trend time-series ordered ascending by interval start", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("trend-chart")).toBeInTheDocument();
    });

    const points = screen.getAllByTestId(/^trend-point-/);
    expect(points).toHaveLength(3);
    const starts = points.map((p) => p.getAttribute("data-start"));
    expect(starts).toEqual([
      "2025-01-01T12:00:00.000Z",
      "2025-01-01T12:01:00.000Z",
      "2025-01-01T12:03:00.000Z",
    ]);
    // Confirms ascending order.
    const asc = [...starts].sort();
    expect(starts).toEqual(asc);
  });

  // 8.6 — failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("pulse-prompt")).toBeInTheDocument();
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

  // 8.7 — zero reactions show zero indicators and a trend empty state.
  it("shows zero indicators and a trend empty state when there are no reactions", async () => {
    getLiveStats.mockResolvedValue(mockZeroResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("aggregate-empty")).toBeInTheDocument();
    });
    expect(screen.getByTestId("opt-stat-bad")).toHaveTextContent("0 · 0%");
    expect(screen.getByTestId("opt-stat-great")).toHaveTextContent("0 · 0%");
    expect(screen.getByTestId("opt-bar-bad")).toHaveStyle("width: 0%");
    expect(screen.getByTestId("avg-sentiment")).toHaveTextContent("0");
    // Trend empty state.
    expect(screen.getByTestId("trend-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("trend-chart")).not.toBeInTheDocument();
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
      expect(screen.getByTestId("pulse-prompt")).toBeInTheDocument();
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
    expect(screen.getByTestId("pulse-prompt")).toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PulseFeedbackLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
