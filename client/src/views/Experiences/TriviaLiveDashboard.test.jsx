import React from "react";
import { render, screen, waitFor, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TriviaLiveDashboard from "./TriviaLiveDashboard";
import { getLiveStats, setQuestionState } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  setQuestionState: jest.fn(),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/live"
          element={<TriviaLiveDashboard />}
        />
      </Routes>
    </MemoryRouter>
  );

// A trivia live-stats payload. By default q1 is active (so the 2s poll runs),
// q2 is pending, q3 is locked; q1 has a distribution and a leaderboard.
const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      experienceType: "trivia-challenges",
      state: "Live",
      speedBonus: "on",
      questions: [
        {
          id: "q1",
          prompt: "Capital of France?",
          options: [
            { id: "a", label: "Paris" },
            { id: "b", label: "Lyon" },
          ],
          correctOptionId: "a",
          timeLimit: 20,
          pointValue: 100,
          questionState: "active",
          revealedAt: new Date().toISOString(),
          lockedAt: null,
        },
        {
          id: "q2",
          prompt: "Largest planet?",
          options: [
            { id: "c", label: "Jupiter" },
            { id: "d", label: "Mars" },
          ],
          correctOptionId: "c",
          timeLimit: 30,
          pointValue: 200,
          questionState: "pending",
          revealedAt: null,
          lockedAt: null,
        },
        {
          id: "q3",
          prompt: "Chemical symbol for gold?",
          options: [
            { id: "e", label: "Au" },
            { id: "f", label: "Ag" },
          ],
          correctOptionId: "e",
          timeLimit: 15,
          pointValue: 150,
          questionState: "locked",
          revealedAt: new Date().toISOString(),
          lockedAt: new Date().toISOString(),
        },
      ],
      leaderboard: {
        entries: [
          { attendeeId: "user-2", totalScore: 140, rank: 3 },
          { attendeeId: "user-1", totalScore: 285, rank: 1 },
          { attendeeId: "user-3", totalScore: 285, rank: 1 },
        ],
      },
      distributions: [
        {
          questionId: "q1",
          correctOptionId: "a",
          totalAnswers: 100,
          options: [
            { id: "a", label: "Paris", count: 72, percentage: 72.0, correct: true },
            { id: "b", label: "Lyon", count: 28, percentage: 28.0, correct: false },
          ],
        },
        {
          questionId: "q2",
          correctOptionId: "c",
          totalAnswers: 0,
          options: [
            { id: "c", label: "Jupiter", count: 0, percentage: 0, correct: true },
            { id: "d", label: "Mars", count: 0, percentage: 0, correct: false },
          ],
        },
        {
          questionId: "q3",
          correctOptionId: "e",
          totalAnswers: 50,
          options: [
            { id: "e", label: "Au", count: 40, percentage: 80.0, correct: true },
            { id: "f", label: "Ag", count: 10, percentage: 20.0, correct: false },
          ],
        },
      ],
      totalAnswers: 150,
      uniqueAttendees: 120,
      ...overrides,
    },
  },
});

describe("TriviaLiveDashboard", () => {
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

  // 9.1 — renders without crashing and shows each question's state.
  it("renders each question with its current state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    });
    expect(screen.getByText("Largest planet?")).toBeInTheDocument();
    expect(screen.getByTestId("question-state-q1")).toHaveTextContent("ACTIVE");
    expect(screen.getByTestId("question-state-q2")).toHaveTextContent("PENDING");
    expect(screen.getByTestId("question-state-q3")).toHaveTextContent("LOCKED");
    // Header LIVE chip.
    expect(screen.getByText("LIVE")).toBeInTheDocument();
  });

  // 9.2 — an active question renders its prompt, options, and countdown.
  it("renders the active question prompt, options, and countdown", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    });
    // Options render (via the distribution rows).
    const card = screen.getByTestId("question-card-q1");
    expect(within(card).getByText("Paris")).toBeInTheDocument();
    expect(within(card).getByText("Lyon")).toBeInTheDocument();
    // Countdown bar present for the active question.
    expect(screen.getByTestId("countdown-q1")).toBeInTheDocument();
  });

  // 9.3 — advancing 2s during an active/revealed question triggers another getLiveStats.
  it("polls getLiveStats every 2 seconds while a question is active", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    // Wait for the initial load to render an active question, so the polling
    // gate is open before we advance the clock.
    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    });
    expect(getLiveStats).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });
  });

  // 9.4 — reveal-next reflects active.
  it("reveals the next pending question and optimistically reflects the active state", async () => {
    // Start with no active question so reveal is enabled for q2 (pending).
    getLiveStats.mockResolvedValue(
      mockStatsResponse({
        questions: [
          {
            id: "q2",
            prompt: "Largest planet?",
            options: [
              { id: "c", label: "Jupiter" },
              { id: "d", label: "Mars" },
            ],
            correctOptionId: "c",
            timeLimit: 30,
            pointValue: 200,
            questionState: "pending",
            revealedAt: null,
            lockedAt: null,
          },
        ],
        distributions: [],
        leaderboard: { entries: [] },
      })
    );
    setQuestionState.mockResolvedValue({
      data: { data: { questionId: "q2", question: { id: "q2", questionState: "active", revealedAt: new Date().toISOString() } } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Largest planet?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("question-card-q2");
    fireEvent.click(within(card).getByRole("button", { name: /Reveal Question/i }));

    await waitFor(() => {
      expect(setQuestionState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "reveal_question",
        questionId: "q2",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("question-state-q2")).toHaveTextContent("ACTIVE");
    });
  });

  // 9.5 — lock reflects locked.
  it("locks an active question and optimistically reflects the locked state", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setQuestionState.mockResolvedValue({
      data: { data: { questionId: "q1", question: { id: "q1", questionState: "locked", lockedAt: new Date().toISOString() } } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("question-card-q1");
    fireEvent.click(within(card).getByRole("button", { name: /Lock/i }));

    await waitFor(() => {
      expect(setQuestionState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "lock_question",
        questionId: "q1",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("question-state-q1")).toHaveTextContent("LOCKED");
    });
  });

  // 9.6 — reveal-answer displays the correct option, distribution, and updated leaderboard.
  it("reveals the answer and shows the correct option, distribution, and leaderboard", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    setQuestionState.mockResolvedValue({
      data: { data: { questionId: "q3", question: { id: "q3", questionState: "revealed" } } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Chemical symbol for gold?")).toBeInTheDocument();
    });

    const card = screen.getByTestId("question-card-q3");
    fireEvent.click(within(card).getByRole("button", { name: /Reveal Answer/i }));

    await waitFor(() => {
      expect(setQuestionState).toHaveBeenCalledWith("evt-123", "exp-456", {
        action: "reveal_answer",
        questionId: "q3",
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId("question-state-q3")).toHaveTextContent("REVEALED");
    });
    // Correct option (Au) is highlighted with a checkmark after reveal.
    const revealedCard = screen.getByTestId("question-card-q3");
    expect(within(revealedCard).getByText(/Au ✓/)).toBeInTheDocument();
    // Distribution counts render for q3.
    expect(screen.getByTestId("opt-stat-q3-e")).toHaveTextContent("40 · 80%");
    // Leaderboard is present.
    expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
  });

  // 9.7 — provided distribution data renders proportional bars with counts/percentages.
  it("renders proportional distribution bars with counts and percentages", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
    });

    const bar = screen.getByTestId("opt-bar-q1-a");
    expect(bar).toHaveStyle("width: 72%");
    expect(screen.getByTestId("opt-stat-q1-a")).toHaveTextContent("72 · 72%");
    expect(screen.getByTestId("opt-stat-q1-b")).toHaveTextContent("28 · 28%");
  });

  // 9.8 — leaderboard rows render ordered by ascending rank with rank + total.
  it("renders leaderboard rows ordered by ascending rank with rank and total", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("leaderboard")).toBeInTheDocument();
    });

    const rows = screen.getAllByTestId(/^leaderboard-row-/);
    // Ordered by ascending rank: rank 1 (user-1), rank 1 (user-3), rank 3 (user-2).
    expect(rows[0]).toHaveTextContent("#1");
    expect(rows[0]).toHaveTextContent("285 pts");
    expect(rows[1]).toHaveTextContent("#1");
    expect(rows[2]).toHaveTextContent("#3");
    expect(rows[2]).toHaveTextContent("140 pts");
  });

  // 9.9 — a failed refresh shows an error and retries next tick.
  it("shows an error on failed refresh and keeps polling", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse())
      .mockRejectedValueOnce({ response: { data: { message: "Server error" } } })
      .mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Capital of France?")).toBeInTheDocument();
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

  // 9.10 — zero-answer questions show zero indicators.
  it("shows a zero-count indicator for zero-answer questions", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Largest planet?")).toBeInTheDocument();
    });

    const zeroCard = screen.getByTestId("question-card-q2");
    expect(within(zeroCard).getByText("No answers yet")).toBeInTheDocument();
    expect(within(zeroCard).getByTestId("opt-stat-q2-c")).toHaveTextContent("0 · 0%");
    expect(within(zeroCard).getByTestId("opt-stat-q2-d")).toHaveTextContent("0 · 0%");
    // Bars render at 0% width.
    expect(within(zeroCard).getByTestId("opt-bar-q2-c")).toHaveStyle("width: 0%");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./TriviaLiveDashboard");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
