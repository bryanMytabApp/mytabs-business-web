import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SurveyResultsDashboard from "./SurveyResultsDashboard";
import { getLiveStats, exportSurveyResults } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  exportSurveyResults: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<SurveyResultsDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A surveys live-stats payload with one question of each type populated.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "surveys",
      state: "Live",
      title: "Post-Event Feedback",
      summary: {
        title: "Post-Event Feedback",
        totalResponses: 90,
        questions: [
          {
            questionId: "q1",
            type: "single_choice",
            prompt: "How did you hear about this event?",
            answerCount: 80,
            options: [
              { id: "opt-a", label: "Social media", count: 50, percentage: 62.5 },
              { id: "opt-b", label: "A friend", count: 30, percentage: 37.5 },
            ],
          },
          {
            questionId: "q3",
            type: "rating",
            prompt: "How would you rate the venue?",
            answerCount: 90,
            average: 4.1,
            distribution: { 1: 2, 2: 5, 3: 18, 4: 33, 5: 32 },
          },
          {
            questionId: "q4",
            type: "free_text",
            prompt: "Any additional comments?",
            answerCount: 2,
            texts: ["Great event", "More parking next time"],
          },
        ],
      },
      ...overrides,
    },
  },
});

// A zero-response payload: every question present with empty aggregates.
const mockZeroResponse = () =>
  mockStatsResponse({
    summary: {
      title: "Post-Event Feedback",
      totalResponses: 0,
      questions: [
        {
          questionId: "q1",
          type: "single_choice",
          prompt: "How did you hear about this event?",
          answerCount: 0,
          options: [
            { id: "opt-a", label: "Social media", count: 0, percentage: 0 },
            { id: "opt-b", label: "A friend", count: 0, percentage: 0 },
          ],
        },
        {
          questionId: "q3",
          type: "rating",
          prompt: "How would you rate the venue?",
          answerCount: 0,
          average: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
        {
          questionId: "q4",
          type: "free_text",
          prompt: "Any additional comments?",
          answerCount: 0,
          texts: [],
        },
      ],
    },
  });

describe("SurveyResultsDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  // 8.1 — renders without crashing and shows the total response count.
  it("renders the survey title and total response count", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("survey-title")).toHaveTextContent("Post-Event Feedback");
    });
    expect(screen.getByTestId("total-responses")).toHaveTextContent("90 total responses");
    expect(screen.getByTestId("availability-chip")).toHaveTextContent("OPEN");
  });

  // 8.2 — advancing 30s triggers another getLiveStats call.
  it("polls getLiveStats every 30 seconds", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(1);
    });

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 8.3 — choice aggregates render proportional bars with counts + percentages.
  it("renders choice bars with counts and percentages", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Social media")).toBeInTheDocument();
    });
    expect(screen.getByTestId("opt-bar-q1-opt-a")).toHaveStyle("width: 62.5%");
    expect(screen.getByTestId("opt-bar-q1-opt-b")).toHaveStyle("width: 37.5%");
    expect(screen.getByTestId("opt-stat-q1-opt-a")).toHaveTextContent("50 · 62.5%");
    expect(screen.getByTestId("opt-stat-q1-opt-b")).toHaveTextContent("30 · 37.5%");
  });

  // 8.4 — rating aggregates render the average + distribution.
  it("renders the rating average and distribution", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("avg-q3")).toHaveTextContent("4.1");
    });
    expect(screen.getByTestId("distribution-q3")).toBeInTheDocument();
    expect(screen.getByTestId("dist-count-q3-4")).toHaveTextContent("33");
    expect(screen.getByTestId("dist-count-q3-5")).toHaveTextContent("32");
    // Distribution buckets span the full scale 1..5.
    ["1", "2", "3", "4", "5"].forEach((v) => {
      expect(screen.getByTestId(`dist-bar-q3-${v}`)).toBeInTheDocument();
    });
  });

  // 8.5 — free-text aggregates render the list of submitted texts.
  it("renders the free-text answer list", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("texts-q4")).toBeInTheDocument();
    });
    expect(screen.getByTestId("text-q4-0")).toHaveTextContent("Great event");
    expect(screen.getByTestId("text-q4-1")).toHaveTextContent("More parking next time");
  });

  // 8.6 — the export control calls exportSurveyResults.
  it("calls the export action when the export control is clicked", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    exportSurveyResults.mockResolvedValue({
      data: {
        data: {
          experienceType: "surveys",
          state: "Live",
          export: { surveyTitle: "Post-Event Feedback", totalResponses: 90, questions: [] },
        },
      },
    });
    // jsdom does not implement these; assign stubs so the Blob download path
    // doesn't throw (jest.spyOn can't stub a property that doesn't exist).
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = jest.fn(() => "blob:mock");
    URL.revokeObjectURL = jest.fn();

    renderComponent();
    await waitFor(() => {
      expect(screen.getByTestId("export-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("export-button"));

    await waitFor(() => {
      expect(exportSurveyResults).toHaveBeenCalledTimes(1);
    });
    expect(exportSurveyResults).toHaveBeenCalledWith("evt-123", "exp-456");

    URL.createObjectURL = origCreate;
    URL.revokeObjectURL = origRevoke;
  });

  // 8.7 — a failed refresh shows an error and keeps polling.
  it("shows an error on a failed refresh and retries next tick", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("survey-title")).toBeInTheDocument();
    });

    // Second tick fails.
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // Third tick retries (interval still running) and clears the error.
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(3);
    });
    await waitFor(() => {
      expect(screen.queryByText("Server error")).not.toBeInTheDocument();
    });
  });

  // 8.8 — zero responses show a per-type zero-count indicator per question.
  it("shows a zero-count indicator per question when there are no responses", async () => {
    getLiveStats.mockResolvedValue(mockZeroResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("total-responses")).toHaveTextContent("0 total responses");
    });
    // Choice: bars at 0 + zero indicator.
    expect(screen.getByTestId("opt-bar-q1-opt-a")).toHaveStyle("width: 0%");
    expect(screen.getByTestId("zero-q1")).toBeInTheDocument();
    // Rating: average 0 + zero indicator.
    expect(screen.getByTestId("avg-q3")).toHaveTextContent("0");
    expect(screen.getByTestId("zero-q3")).toBeInTheDocument();
    // Free-text: empty list → zero indicator.
    expect(screen.getByTestId("zero-q4")).toBeInTheDocument();
    expect(screen.queryByTestId("texts-q4")).not.toBeInTheDocument();
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
      expect(screen.getByTestId("survey-title")).toBeInTheDocument();
    });

    act(() => {
      jest.advanceTimersByTime(30000);
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
    expect(screen.getByTestId("survey-title")).toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SurveyResultsDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
