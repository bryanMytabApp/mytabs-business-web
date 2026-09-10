import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PulseFeedbackConfig from "./PulseFeedbackConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors LivePollConfig.test.jsx mocking). jest.mock is
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
          element={<PulseFeedbackConfig />}
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

// Click a step in the shell's step bar by its label (tolerating the "✓ " prefix
// the shell adds to completed steps and any legacy "N. " numeric prefix).
const goToStep = (label) => {
  const target = String(label).replace(/^\d+\.\s*/, "");
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// Select a reaction type through the MUI Select.
async function selectReactionType(name) {
  fireEvent.mouseDown(screen.getByLabelText("Reaction Type"));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText(name));
}

// Fill a valid two-option mood set (default reaction type).
function fillValidMood() {
  fireEvent.change(screen.getByLabelText(/Pulse Prompt/i), {
    target: { value: "How's it going right now?" },
  });
  fireEvent.change(screen.getByLabelText("Option 1 label"), { target: { value: "Not great" } });
  fireEvent.change(screen.getByLabelText("Option 2 label"), { target: { value: "Great" } });
}

// Advance from the Prompt step to the Review & Save step.
async function goToReview() {
  fireEvent.click(screen.getByText(/Next →/));
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("PulseFeedbackConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 7.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Pulse Feedback")).toBeInTheDocument();
  });

  // 7.2 — shows the prompt input and the reaction-type selector.
  it("displays the prompt input and reaction-type selector", () => {
    renderComponent();
    expect(screen.getByLabelText(/Pulse Prompt/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Reaction Type")).toBeInTheDocument();
  });

  // 7.3 — selecting mood reveals editable add/remove option controls with
  // label + sentiment, respecting the 2–7 limits.
  it("reveals editable option controls with label and sentiment when mood is selected", async () => {
    renderComponent();
    // Mood is the default; label + sentiment fields are present.
    expect(screen.getByLabelText("Option 1 label")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2 label")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Sentiment").length).toBe(2);

    // Two options → remove buttons disabled at the minimum.
    expect(screen.getAllByLabelText("Remove option 1")[0]).toBeDisabled();

    // Add an option → removal is now enabled and a third option appears.
    fireEvent.click(screen.getByRole("button", { name: /Add Option/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Option 3 label")).toBeInTheDocument();
    });
    expect(screen.getAllByLabelText("Remove option 1")[0]).not.toBeDisabled();
  });

  it("disables add option at the 7-option maximum", async () => {
    renderComponent();
    const addBtn = () => screen.getByRole("button", { name: /Add Option/i });
    // Start with 2, add up to 7.
    for (let i = 0; i < 5; i++) {
      fireEvent.click(addBtn());
    }
    await waitFor(() => {
      expect(screen.getByLabelText("Option 7 label")).toBeInTheDocument();
    });
    expect(addBtn()).toBeDisabled();
  });

  // 7.4 — selecting thumbs renders a fixed, read-only 2-option set.
  it("renders the fixed thumbs option set read-only", async () => {
    renderComponent();
    await selectReactionType("Thumbs");

    await waitFor(() => {
      expect(screen.getByText("Thumbs options (fixed)")).toBeInTheDocument();
    });
    // No editable option label fields for a fixed type.
    expect(screen.queryByLabelText("Option 1 label")).not.toBeInTheDocument();
    // Two read-only fixed options rendered.
    const opt1 = screen.getByTestId("fixed-option-down");
    const opt2 = screen.getByTestId("fixed-option-up");
    expect(opt1).toHaveAttribute("readonly");
    expect(opt2).toHaveAttribute("readonly");
  });

  // 7.4 — selecting rating renders a fixed, read-only 5-option set.
  it("renders the fixed rating option set read-only", async () => {
    renderComponent();
    await selectReactionType("Rating (1–5)");

    await waitFor(() => {
      expect(screen.getByText("Rating options (fixed)")).toBeInTheDocument();
    });
    ["r1", "r2", "r3", "r4", "r5"].forEach((id) => {
      expect(screen.getByTestId(`fixed-option-${id}`)).toHaveAttribute("readonly");
    });
    // No add-option control for a fixed type.
    expect(screen.queryByRole("button", { name: /Add Option/i })).not.toBeInTheDocument();
  });

  // 7.5 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave the prompt and option labels blank (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface back on the Prompt step.
    goToStep("1. Prompt & Reaction Type");
    await waitFor(() => {
      expect(screen.getByText("Prompt is required.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Option label is required.").length).toBeGreaterThanOrEqual(1);
  });

  // 7.6 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidMood();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.prompt).toBe("How's it going right now?");
    expect(payload.config.reactionType).toBe("mood");
    expect(payload.config.options.map((o) => o.label)).toEqual(["Not great", "Great"]);
    expect(payload.config.options.every((o) => Number.isInteger(o.sentimentValue))).toBe(true);
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    // After a successful save the form redirects to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 7.6 — selecting a fixed type persists a valid config on save.
  it("persists a valid fixed rating config on save", async () => {
    renderComponent();
    fireEvent.change(screen.getByLabelText(/Pulse Prompt/i), {
      target: { value: "Rate this session" },
    });
    await selectReactionType("Rating (1–5)");
    await waitFor(() => {
      expect(screen.getByText("Rating options (fixed)")).toBeInTheDocument();
    });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const payload = updateInstance.mock.calls[0][2];
    expect(payload.config.reactionType).toBe("rating");
    expect(payload.config.options).toHaveLength(5);
    expect(payload.config.options.map((o) => o.sentimentValue).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PulseFeedbackConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
