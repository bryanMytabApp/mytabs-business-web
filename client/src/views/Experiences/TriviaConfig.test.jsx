import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TriviaConfig from "./TriviaConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors SurveyConfig.test.jsx mocking). jest.mock is
// hoisted above the imports at runtime, so this keeps import/first satisfied.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(() => Promise.resolve({ data: {} })),
  updateInstance: jest.fn(() => Promise.resolve({ data: {} })),
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/config"
          element={<TriviaConfig />}
        />
        {/* Landing route so the post-save redirect to the dashboard is observable. */}
        <Route
          path="/admin/my-events/:eventId/experiences"
          element={<div>Engagements Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  );

// Substring text matcher tolerant of the shell's banner prefix ("⚠ ") and text
// split across nodes; matches only the innermost element containing the text.
const matchText = (needle) => (content, node) => {
  const has = (el) => (el?.textContent || "").includes(needle);
  if (!has(node)) return false;
  const childHasIt = Array.from(node?.children || []).some((c) => has(c));
  return !childHasIt;
};

// Navigate to a step via the shell's step bar, matching the label (tolerating a
// "✓ " completed prefix and any legacy "N. " numeric prefix).
const goToStep = (label) => {
  const target = String(label).replace(/^\d+\.\s*/, "");
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// Fill the minimum valid trivia: one question with a prompt, two distinct
// option labels, a correct answer, a valid time limit, and a valid point value.
function fillValidTrivia() {
  goToStep("1. Questions");
  fireEvent.change(screen.getByLabelText("Prompt"), {
    target: { value: "What year was the festival founded?" },
  });
  fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "1998" } });
  fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "2004" } });
  // The first option is the default correct answer; timeLimit/pointValue default valid.
}

async function goToReview() {
  goToStep("2. Scoring & Review");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("TriviaConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 8.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Trivia Challenges")).toBeInTheDocument();
    // The default question editor is present.
    expect(screen.getByTestId("question-editor-0")).toBeInTheDocument();
  });

  // 8.2 — adding a question shows prompt / options / correct selector / time-limit / point-value controls.
  it("shows prompt, options, correct-answer selector, time limit, and point value controls per question", async () => {
    renderComponent();
    goToStep("1. Questions");

    // The default question exposes all controls.
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Mark option 1 of question 1 correct")).toBeInTheDocument();
    expect(screen.getByLabelText("Time Limit (s)")).toBeInTheDocument();
    expect(screen.getByLabelText("Point Value")).toBeInTheDocument();

    // Adding a second question exposes a second full editor.
    fireEvent.click(screen.getByRole("button", { name: /Add Question/i }));
    await waitFor(() => {
      expect(screen.getByTestId("question-editor-1")).toBeInTheDocument();
    });
    const editor1 = screen.getByTestId("question-editor-1");
    expect(within(editor1).getByLabelText("Prompt")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Option 1")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Mark option 1 of question 2 correct")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Time Limit (s)")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Point Value")).toBeInTheDocument();
  });

  // 8.3 — the speed-bonus control is present.
  it("shows the speed-bonus control", async () => {
    renderComponent();
    await goToReview();
    expect(screen.getByLabelText("Speed Bonus")).toBeInTheDocument();
  });

  // 8.4 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave prompt/options blank (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Questions step.
    goToStep("1. Questions");
    await waitFor(() => {
      expect(screen.getByText("Question prompt is required.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Option label is required.").length).toBeGreaterThanOrEqual(1);
  });

  // 8.4 — an out-of-range time limit is rejected.
  it("rejects an out-of-range time limit", async () => {
    renderComponent();
    fillValidTrivia();
    fireEvent.change(screen.getByLabelText("Time Limit (s)"), { target: { value: "2" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Questions");
    await waitFor(() => {
      expect(
        screen.getByText("Time limit must be an integer between 5 and 300 seconds.")
      ).toBeInTheDocument();
    });
  });

  // 8.5 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidTrivia();
    // Turn the speed bonus on to verify it round-trips.
    goToStep("2. Scoring & Review");
    fireEvent.mouseDown(screen.getByLabelText("Speed Bonus"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText(/faster correct answers earn more/i));

    await waitFor(() => {
      expect(screen.getByText("Save Configuration")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.speedBonus).toBe("on");
    expect(payload.config.questions).toHaveLength(1);
    const q = payload.config.questions[0];
    expect(q.prompt).toBe("What year was the festival founded?");
    expect(q.options.map((o) => o.label)).toEqual(["1998", "2004"]);
    // Exactly one correct option, matching an existing option id.
    expect(q.options.some((o) => o.id === q.correctOptionId)).toBe(true);
    expect(q.timeLimit).toBe(20);
    expect(q.pointValue).toBe(100);
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    // After a successful save the form redirects to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 8.6 — add/remove option respects the 2-6 limit.
  it("respects the 2-6 option limit when adding and removing options", async () => {
    renderComponent();
    goToStep("1. Questions");

    // At the 2-option minimum, remove is disabled.
    expect(screen.getByLabelText("Remove option 1 of question 1")).toBeDisabled();

    // Add options up to the max of 6, then Add Option is disabled.
    const addOption = () => screen.getByRole("button", { name: /Add Option/i });
    for (let i = 0; i < 4; i++) {
      fireEvent.click(addOption());
    }
    await waitFor(() => {
      expect(screen.getByLabelText("Option 6")).toBeInTheDocument();
    });
    expect(addOption()).toBeDisabled();
    // Now above the minimum, remove is enabled.
    expect(screen.getByLabelText("Remove option 1 of question 1")).not.toBeDisabled();
  });

  // 8.6 — add/remove/reorder question controls respect the 1-50 limit.
  it("respects the 1-50 question limit and reorders questions", async () => {
    renderComponent();
    goToStep("1. Questions");

    // With one question, its remove + move controls are disabled (minimum of 1).
    expect(screen.getByLabelText("Remove question 1")).toBeDisabled();
    expect(screen.getByLabelText("Move question 1 up")).toBeDisabled();
    expect(screen.getByLabelText("Move question 1 down")).toBeDisabled();

    // Add a second question → removal + reorder become available.
    fireEvent.change(screen.getByLabelText("Prompt"), { target: { value: "First" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Question/i }));
    await waitFor(() => {
      expect(screen.getByTestId("question-editor-1")).toBeInTheDocument();
    });
    fireEvent.change(within(screen.getByTestId("question-editor-1")).getByLabelText("Prompt"), {
      target: { value: "Second" },
    });

    expect(screen.getByLabelText("Remove question 1")).not.toBeDisabled();

    // Reorder: move question 1 down → "Second" prompt should now be in editor 0.
    fireEvent.click(screen.getByLabelText("Move question 1 down"));
    await waitFor(() => {
      const editor0 = screen.getByTestId("question-editor-0");
      expect(within(editor0).getByLabelText("Prompt")).toHaveValue("Second");
    });
    const editor1 = screen.getByTestId("question-editor-1");
    expect(within(editor1).getByLabelText("Prompt")).toHaveValue("First");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./TriviaConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
