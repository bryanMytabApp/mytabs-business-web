import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PredictionConfig from "./PredictionConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors TriviaConfig.test.jsx mocking). jest.mock is
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
          element={<PredictionConfig />}
        />
      </Routes>
    </MemoryRouter>
  );

// Navigate directly to a step via the step indicator.
const goToStep = (label) => fireEvent.click(screen.getByText(label));

// A future datetime-local value (~1 day out) formatted YYYY-MM-DDTHH:mm.
function futureLocalValue() {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Fill the minimum valid prediction market: a question, two distinct outcome
// labels, and a future close deadline (pointValue defaults valid).
function fillValidPrediction() {
  goToStep("1. Markets");
  fireEvent.change(screen.getByLabelText("Question"), {
    target: { value: "Who will win the final?" },
  });
  fireEvent.change(screen.getByLabelText("Outcome 1"), { target: { value: "Falcons" } });
  fireEvent.change(screen.getByLabelText("Outcome 2"), { target: { value: "Vipers" } });
  fireEvent.change(screen.getByLabelText("Close Deadline"), {
    target: { value: futureLocalValue() },
  });
}

async function goToReview() {
  goToStep("2. Review");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("PredictionConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 9.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Prediction Challenges")).toBeInTheDocument();
    // The default market editor is present.
    expect(screen.getByTestId("market-editor-0")).toBeInTheDocument();
  });

  // 9.2 — adding a market shows question / outcomes / close-deadline / point-value controls.
  it("shows question, outcomes, close-deadline, and point-value controls per market", async () => {
    renderComponent();
    goToStep("1. Markets");

    // The default market exposes all controls.
    expect(screen.getByLabelText("Question")).toBeInTheDocument();
    expect(screen.getByLabelText("Outcome 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Outcome 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Close Deadline")).toBeInTheDocument();
    expect(screen.getByLabelText("Point Value")).toBeInTheDocument();

    // Adding a second market exposes a second full editor.
    fireEvent.click(screen.getByRole("button", { name: /Add Market/i }));
    await waitFor(() => {
      expect(screen.getByTestId("market-editor-1")).toBeInTheDocument();
    });
    const editor1 = screen.getByTestId("market-editor-1");
    expect(within(editor1).getByLabelText("Question")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Outcome 1")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Close Deadline")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Point Value")).toBeInTheDocument();
  });

  // 9.3 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave question/outcomes blank (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Markets step.
    goToStep("1. Markets");
    await waitFor(() => {
      expect(screen.getByText("Market question is required.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Outcome label is required.").length).toBeGreaterThanOrEqual(1);
  });

  // 9.3 — an out-of-range point value is rejected.
  it("rejects an out-of-range point value", async () => {
    renderComponent();
    fillValidPrediction();
    fireEvent.change(screen.getByLabelText("Point Value"), { target: { value: "0" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Markets");
    await waitFor(() => {
      expect(
        screen.getByText("Point value must be an integer between 1 and 10000.")
      ).toBeInTheDocument();
    });
  });

  // 9.3 — a past close deadline is rejected.
  it("rejects a past close deadline", async () => {
    renderComponent();
    fillValidPrediction();
    // Set the deadline to the past.
    fireEvent.change(screen.getByLabelText("Close Deadline"), {
      target: { value: "2000-01-01T10:00" },
    });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).not.toHaveBeenCalled();
    });

    goToStep("1. Markets");
    await waitFor(() => {
      expect(screen.getByText("Close deadline must be in the future.")).toBeInTheDocument();
    });
  });

  // 9.4 — saving valid data calls updateInstance and shows a confirmation.
  it("saves valid data via updateInstance and shows a confirmation", async () => {
    renderComponent();
    fillValidPrediction();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.markets).toHaveLength(1);
    const m = payload.config.markets[0];
    expect(m.question).toBe("Who will win the final?");
    expect(m.options.map((o) => o.label)).toEqual(["Falcons", "Vipers"]);
    // A future ISO close deadline is persisted.
    expect(typeof m.closeDeadline).toBe("string");
    expect(new Date(m.closeDeadline).getTime()).toBeGreaterThan(Date.now());
    expect(m.pointValue).toBe(50);
    // No correct-answer / speed-bonus fields exist on a prediction config.
    expect(m.correctOptionId).toBeUndefined();
    expect(payload.config.speedBonus).toBeUndefined();

    await waitFor(() => {
      expect(screen.getByText("Prediction configuration saved.")).toBeInTheDocument();
    });
  });

  // 9.5 — add/remove outcome respects the 2-10 limit.
  it("respects the 2-10 outcome limit when adding and removing outcomes", async () => {
    renderComponent();
    goToStep("1. Markets");

    // At the 2-outcome minimum, remove is disabled.
    expect(screen.getByLabelText("Remove outcome 1 of market 1")).toBeDisabled();

    // Add outcomes up to the max of 10, then Add Outcome is disabled.
    const addOutcome = () => screen.getByRole("button", { name: /Add Outcome/i });
    for (let i = 0; i < 8; i++) {
      fireEvent.click(addOutcome());
    }
    await waitFor(() => {
      expect(screen.getByLabelText("Outcome 10")).toBeInTheDocument();
    });
    expect(addOutcome()).toBeDisabled();
    // Now above the minimum, remove is enabled.
    expect(screen.getByLabelText("Remove outcome 1 of market 1")).not.toBeDisabled();
  });

  // 9.5 — add/remove/reorder market controls respect the 1-50 limit.
  it("respects the 1-50 market limit and reorders markets", async () => {
    renderComponent();
    goToStep("1. Markets");

    // With one market, its remove + move controls are disabled (minimum of 1).
    expect(screen.getByLabelText("Remove market 1")).toBeDisabled();
    expect(screen.getByLabelText("Move market 1 up")).toBeDisabled();
    expect(screen.getByLabelText("Move market 1 down")).toBeDisabled();

    // Add a second market → removal + reorder become available.
    fireEvent.change(screen.getByLabelText("Question"), { target: { value: "First" } });
    fireEvent.click(screen.getByRole("button", { name: /Add Market/i }));
    await waitFor(() => {
      expect(screen.getByTestId("market-editor-1")).toBeInTheDocument();
    });
    fireEvent.change(within(screen.getByTestId("market-editor-1")).getByLabelText("Question"), {
      target: { value: "Second" },
    });

    expect(screen.getByLabelText("Remove market 1")).not.toBeDisabled();

    // Reorder: move market 1 down → "Second" question should now be in editor 0.
    fireEvent.click(screen.getByLabelText("Move market 1 down"));
    await waitFor(() => {
      const editor0 = screen.getByTestId("market-editor-0");
      expect(within(editor0).getByLabelText("Question")).toHaveValue("Second");
    });
    const editor1 = screen.getByTestId("market-editor-1");
    expect(within(editor1).getByLabelText("Question")).toHaveValue("First");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PredictionConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
