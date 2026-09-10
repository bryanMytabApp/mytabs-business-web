import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SurveyConfig from "./SurveyConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors LivePollConfig.test.jsx / PulseFeedbackConfig.test.jsx
// mocking). jest.mock is hoisted above the imports at runtime, so this keeps
// import/first satisfied.
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
          element={<SurveyConfig />}
        />
        {/* Landing route so the post-save redirect to the dashboard is observable. */}
        <Route
          path="/admin/my-events/:eventId/experiences"
          element={<div>Engagements Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  );

// Substring text matcher — tolerant of a banner prefix (the shell prepends a
// warning glyph to the save-error text). Matches only the innermost element that
// contains the needle (not its ancestors) to avoid multiple-match errors.
const matchText = (needle) => (content, node) => {
  const has = (el) => (el?.textContent || "").includes(needle);
  if (!has(node)) return false;
  const childHasIt = Array.from(node?.children || []).some((c) => has(c));
  return !childHasIt;
};

// Change the type of the first question through its MUI Select.
async function selectQuestionType(name) {
  fireEvent.mouseDown(screen.getByLabelText("Question Type"));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText(name));
}

// Navigate directly to a step via the shared shell's step bar. The shell renders
// step labels without a numeric prefix and prepends "✓ " to completed steps, so
// match by the label text alone (tolerating the ✓ prefix on completed steps).
const STEP_LABEL = {
  "1. Survey Details": "Survey Details",
  "2. Questions": "Questions",
  "3. Availability": "Availability",
  "4. Review & Save": "Review & Save",
};
const goToStep = (label) => {
  const target = STEP_LABEL[label] || label;
  // Step buttons render the label (optionally with a "✓ " prefix on completed
  // steps) as adjacent text nodes, so match on the button's combined textContent.
  const buttons = screen.getAllByRole("button");
  const btn = buttons.find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// Fill the minimum valid survey: a title, one single_choice question with two
// distinct option labels, and a valid open time.
function fillValidSurvey() {
  goToStep("1. Survey Details");
  fireEvent.change(screen.getByLabelText(/Survey Title/i), {
    target: { value: "Post-Event Feedback" },
  });

  goToStep("2. Questions");
  fireEvent.change(screen.getByLabelText("Prompt"), {
    target: { value: "How did you hear about us?" },
  });
  fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Social" } });
  fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "Friend" } });

  goToStep("3. Availability");
  fireEvent.change(screen.getByLabelText(/Open Time/i), {
    target: { value: "2025-01-01T18:00" },
  });
}

async function goToReview() {
  goToStep("4. Review & Save");
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /Save Configuration/i })).toBeInTheDocument();
  });
}

describe("SurveyConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 7.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Surveys")).toBeInTheDocument();
    expect(screen.getByLabelText(/Survey Title/i)).toBeInTheDocument();
  });

  // 7.2 — adding a question shows prompt/type/required controls.
  it("shows prompt, type, and required controls for each question", async () => {
    renderComponent();
    goToStep("2. Questions");

    // The default question exposes prompt + type + required controls.
    expect(screen.getByLabelText("Prompt")).toBeInTheDocument();
    expect(screen.getByLabelText("Question Type")).toBeInTheDocument();
    expect(screen.getByLabelText("Required question 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Question/i }));
    await waitFor(() => {
      expect(screen.getByTestId("question-editor-1")).toBeInTheDocument();
    });
    // Two questions now expose prompt controls.
    expect(screen.getAllByLabelText("Prompt").length).toBe(2);
    expect(screen.getByLabelText("Required question 2")).toBeInTheDocument();
  });

  // 7.3 — a choice type reveals option add/edit/remove within limits.
  it("reveals option add/edit/remove controls for choice types within limits", async () => {
    renderComponent();
    goToStep("2. Questions");

    // single_choice is the default → two option fields present.
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();

    // At the 2-option minimum, remove is disabled.
    expect(screen.getByLabelText("Remove option 1 of question 1")).toBeDisabled();

    // Add options up to the max of 10, then Add Option is disabled.
    const addOption = () => screen.getByRole("button", { name: /Add Option/i });
    for (let i = 0; i < 8; i++) {
      fireEvent.click(addOption());
    }
    await waitFor(() => {
      expect(screen.getByLabelText("Option 10")).toBeInTheDocument();
    });
    expect(addOption()).toBeDisabled();
    // Now above the minimum, remove is enabled.
    expect(screen.getByLabelText("Remove option 1 of question 1")).not.toBeDisabled();

    // Switching to multiple_choice keeps the choice options.
    await selectQuestionType("Multiple choice");
    await waitFor(() => {
      expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    });
  });

  // 7.4 — a rating type reveals min/max controls.
  it("reveals rating min/max controls for the rating type", async () => {
    renderComponent();
    goToStep("2. Questions");

    expect(screen.queryByLabelText("Min")).not.toBeInTheDocument();

    await selectQuestionType("Rating");
    await waitFor(() => {
      expect(screen.getByLabelText("Min")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Max")).toBeInTheDocument();
    // No answer-option fields for a rating question.
    expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument();
  });

  // 7.4 (extension) — free_text has no option/rating controls.
  it("shows no option or rating controls for the free_text type", async () => {
    renderComponent();
    goToStep("2. Questions");
    await selectQuestionType("Free text");

    await waitFor(() => {
      expect(screen.queryByLabelText("Option 1")).not.toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Min")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Option/i })).not.toBeInTheDocument();
  });

  // 7.5 — availability step shows open and optional close controls.
  it("shows open time and an optional close time on the availability step", () => {
    renderComponent();
    goToStep("3. Availability");

    expect(screen.getByLabelText(/Open Time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Close Time/i)).toBeInTheDocument();

    // A close time can be cleared to leave the survey open indefinitely.
    fireEvent.change(screen.getByLabelText(/Close Time/i), {
      target: { value: "2025-01-08T18:00" },
    });
    expect(screen.getByLabelText("Clear close time")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Clear close time"));
    expect(screen.getByLabelText(/Close Time/i)).toHaveValue("");
  });

  // 7.6 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave title/prompt/options/open-time blank (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on their respective steps.
    goToStep("1. Survey Details");
    await waitFor(() => {
      expect(screen.getByText("Survey title is required.")).toBeInTheDocument();
    });

    goToStep("2. Questions");
    await waitFor(() => {
      expect(screen.getByText("Question prompt is required.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Option label is required.").length).toBeGreaterThanOrEqual(1);

    goToStep("3. Availability");
    await waitFor(() => {
      expect(screen.getByText("A valid open time is required.")).toBeInTheDocument();
    });
  });

  // 7.6 — a close time before the open time is rejected.
  it("rejects a close time that is not after the open time", async () => {
    renderComponent();
    fillValidSurvey();
    goToStep("3. Availability");
    fireEvent.change(screen.getByLabelText(/Close Time/i), {
      target: { value: "2024-12-31T18:00" },
    });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("3. Availability");
    await waitFor(() => {
      expect(screen.getByText("Close time must be after the open time.")).toBeInTheDocument();
    });
  });

  // 7.7 — saving valid data calls updateInstance (incl. accentColor) and then
  // redirects to the engagements dashboard.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidSurvey();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.title).toBe("Post-Event Feedback");
    expect(payload.config.questions).toHaveLength(1);
    expect(payload.config.questions[0].prompt).toBe("How did you hear about us?");
    expect(payload.config.questions[0].type).toBe("single_choice");
    expect(payload.config.questions[0].options.map((o) => o.label)).toEqual(["Social", "Friend"]);
    expect(typeof payload.config.availabilityWindow.openTime).toBe("string");
    // No close time was set → it must be omitted (open indefinitely).
    expect(payload.config.availabilityWindow.closeTime).toBeUndefined();
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    // After a successful save the form redirects to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 7.8 — add/remove/reorder question controls respect the 1–50 limit.
  it("respects the 1-50 limit and reorders questions", async () => {
    renderComponent();
    goToStep("2. Questions");

    // With one question, its remove control is disabled (minimum of 1).
    expect(screen.getByLabelText("Remove question 1")).toBeDisabled();
    // Move controls are disabled for a single question.
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

    // Reorder: move question 1 down → "First" prompt should now be in editor 1.
    fireEvent.click(screen.getByLabelText("Move question 1 down"));
    await waitFor(() => {
      const editor0 = screen.getByTestId("question-editor-0");
      expect(within(editor0).getByLabelText("Prompt")).toHaveValue("Second");
    });
    const editor1 = screen.getByTestId("question-editor-1");
    expect(within(editor1).getByLabelText("Prompt")).toHaveValue("First");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SurveyConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
