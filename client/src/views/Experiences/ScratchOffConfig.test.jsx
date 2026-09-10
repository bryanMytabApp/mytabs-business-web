import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ScratchOffConfig from "./ScratchOffConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
// Mirrors SurveyConfig.test.jsx mocking style.
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
          element={<ScratchOffConfig />}
        />
        {/* Landing route so the post-save redirect to the dashboard is observable. */}
        <Route
          path="/admin/my-events/:eventId/experiences"
          element={<div>Engagements Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  );

// Substring text matcher tolerant of the shell's banner prefix ("⚠ ") and split nodes.
const matchText = (needle) => (content, node) => {
  const has = (el) => (el?.textContent || "").includes(needle);
  if (!has(node)) return false;
  const childHasIt = Array.from(node?.children || []).some((c) => has(c));
  return !childHasIt;
};

// Navigate to a step via the shell's step bar (tolerating a "✓ " completed prefix
// and any legacy "N. " numeric prefix).
const goToStep = (label) => {
  const target = String(label).replace(/^\d+\.\s*/, "");
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// Fill the minimum valid scratch-off: one tier with a label, a valid quantity,
// and a valid probability; the defaults for cards-per-attendee (1) are valid.
function fillValidConfig() {
  goToStep("1. Prize Pool");
  fireEvent.change(screen.getByLabelText("Prize Label"), {
    target: { value: "Free Drink" },
  });
  fireEvent.change(screen.getByLabelText("Quantity"), { target: { value: "100" } });
  fireEvent.change(screen.getByLabelText("Win Probability"), { target: { value: "0.1" } });
}

async function goToReview() {
  goToStep("2. Rules & Review");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("ScratchOffConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 10.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Digital Scratch-Offs")).toBeInTheDocument();
    expect(screen.getByLabelText("Prize Label")).toBeInTheDocument();
  });

  // 10.2 — adding a tier shows label/quantity/win-probability inputs.
  it("shows label, quantity, and win-probability inputs for each prize tier", async () => {
    renderComponent();
    goToStep("1. Prize Pool");

    // The default tier exposes all three controls.
    expect(screen.getByLabelText("Prize Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Quantity")).toBeInTheDocument();
    expect(screen.getByLabelText("Win Probability")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Prize Tier/i }));
    await waitFor(() => {
      expect(screen.getByTestId("prize-tier-1")).toBeInTheDocument();
    });
    // Two tiers now expose label/quantity/probability controls.
    expect(screen.getAllByLabelText("Prize Label").length).toBe(2);
    expect(screen.getAllByLabelText("Quantity").length).toBe(2);
    expect(screen.getAllByLabelText("Win Probability").length).toBe(2);
  });

  // 10.3 — add/remove tier controls respect the 1-50 count limit.
  it("respects the 1-50 tier count limit", async () => {
    renderComponent();
    goToStep("1. Prize Pool");

    // With one tier, its remove control is disabled (minimum of 1).
    expect(screen.getByLabelText("Remove prize tier 1")).toBeDisabled();

    // Add a second tier → removal becomes available.
    fireEvent.click(screen.getByRole("button", { name: /Add Prize Tier/i }));
    await waitFor(() => {
      expect(screen.getByTestId("prize-tier-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove prize tier 1")).not.toBeDisabled();

    // Remove it → back to one tier, remove disabled again.
    fireEvent.click(screen.getByLabelText("Remove prize tier 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("prize-tier-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove prize tier 1")).toBeDisabled();
  });

  // 10.4 — the cards-per-attendee-limit and no-win-message controls are present.
  it("shows the cards-per-attendee-limit and no-win-message controls", async () => {
    renderComponent();
    await goToReview();

    expect(screen.getByLabelText("Cards Per Attendee")).toBeInTheDocument();
    expect(screen.getByLabelText("No-Win Message")).toBeInTheDocument();
    // Default cards-per-attendee limit is 1.
    expect(screen.getByLabelText("Cards Per Attendee")).toHaveValue(1);
  });

  // 10.5 — editing probabilities updates the displayed Total_Win_Probability.
  it("updates the displayed total win probability as tiers are edited", async () => {
    renderComponent();
    goToStep("1. Prize Pool");

    // Default single tier probability is 0.1.
    expect(screen.getByTestId("total-win-probability")).toHaveTextContent("0.1000");

    fireEvent.change(screen.getByLabelText("Win Probability"), { target: { value: "0.25" } });
    await waitFor(() => {
      expect(screen.getByTestId("total-win-probability")).toHaveTextContent("0.2500");
    });

    // Add a second tier and push the total above 1 → warning appears.
    fireEvent.click(screen.getByRole("button", { name: /Add Prize Tier/i }));
    await waitFor(() => {
      expect(screen.getByTestId("prize-tier-1")).toBeInTheDocument();
    });
    const secondTier = screen.getByTestId("prize-tier-1");
    fireEvent.change(within(secondTier).getByLabelText("Win Probability"), {
      target: { value: "0.9" },
    });
    await waitFor(() => {
      expect(screen.getByTestId("total-win-probability")).toHaveTextContent("1.1500");
    });
    expect(screen.getByTestId("total-win-probability-warning")).toBeInTheDocument();
  });

  // 10.6 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Clear the label and set an out-of-range probability → invalid.
    goToStep("1. Prize Pool");
    fireEvent.change(screen.getByLabelText("Prize Label"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Win Probability"), { target: { value: "5" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Prize Pool step.
    goToStep("1. Prize Pool");
    await waitFor(() => {
      expect(screen.getByText("Prize label is required.")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Win probability must be a number between 0 and 1.")
    ).toBeInTheDocument();
  });

  // 10.7 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidConfig();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.prizePool).toHaveLength(1);
    expect(payload.config.prizePool[0].prizeLabel).toBe("Free Drink");
    expect(payload.config.prizePool[0].prizeQuantity).toBe(100);
    expect(payload.config.prizePool[0].winProbability).toBe(0.1);
    expect(typeof payload.config.prizePool[0].tierId).toBe("string");
    expect(payload.config.cardsPerAttendeeLimit).toBe(1);
    expect(typeof payload.config.noWinMessage).toBe("string");
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./ScratchOffConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
