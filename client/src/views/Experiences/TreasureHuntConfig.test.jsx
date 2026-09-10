import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TreasureHuntConfig from "./TreasureHuntConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors CheckInChallengeConfig.test.jsx mocking).
// jest.mock is hoisted above the imports at runtime, so this keeps import/first
// satisfied.
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
          element={<TreasureHuntConfig />}
        />
      </Routes>
    </MemoryRouter>
  );

// Navigate directly to a step via the step indicator.
const goToStep = (label) => fireEvent.click(screen.getByText(label));

// Fill both default checkpoints with a valid hint + associated QR code so the
// form validates (pointValue defaults valid at 100, positions default to 1..2).
function fillValidCheckpoints() {
  goToStep("1. Checkpoints");
  const hints = screen.getAllByLabelText("Location Hint");
  fireEvent.change(hints[0], { target: { value: "Find the mural by the door" } });
  fireEvent.change(hints[1], { target: { value: "Locate the oldest tree" } });
  fireEvent.click(screen.getByRole("button", { name: /Associate QR code for checkpoint 1/i }));
  fireEvent.click(screen.getByRole("button", { name: /Associate QR code for checkpoint 2/i }));
}

async function goToReview() {
  goToStep("2. Hunt Settings & Review");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("TreasureHuntConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 10.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Treasure Hunt")).toBeInTheDocument();
    // Two default checkpoint editors are present (2..100 lower bound).
    expect(screen.getByTestId("checkpoint-editor-0")).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-editor-1")).toBeInTheDocument();
  });

  // 10.2 — a checkpoint shows hint / point-value / checkpoint-code controls, plus
  // a sequence-position control when the mode is sequential.
  it("shows hint, point-value, checkpoint-code, and sequence-position controls", async () => {
    renderComponent();
    goToStep("1. Checkpoints");

    // The default checkpoint exposes all controls (default mode is sequential).
    expect(screen.getAllByLabelText("Location Hint")[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText("Point Value")[0]).toBeInTheDocument();
    // QR association control (button + code display), never a free-typed field.
    expect(
      screen.getByRole("button", { name: /Associate QR code for checkpoint 1/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-code-empty-0")).toBeInTheDocument();
    // Sequence-position control shows in sequential mode.
    expect(screen.getByLabelText("Sequence position for checkpoint 1")).toBeInTheDocument();

    // Associating a QR code replaces the empty indicator with a code chip.
    fireEvent.click(screen.getByRole("button", { name: /Associate QR code for checkpoint 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("checkpoint-code-0")).toBeInTheDocument();
    });
  });

  // 10.2 — switching to free-roam hides the sequence-position control.
  it("hides the sequence-position control in free-roam mode", async () => {
    renderComponent();
    // Default (sequential) shows the control.
    goToStep("1. Checkpoints");
    expect(screen.getByLabelText("Sequence position for checkpoint 1")).toBeInTheDocument();

    // Switch to free-roam on the settings step.
    await goToReview();
    fireEvent.mouseDown(screen.getByLabelText("Hunt mode"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Free-roam (any order)"));

    // Back to checkpoints — the sequence-position control is gone.
    goToStep("1. Checkpoints");
    await waitFor(() => {
      expect(
        screen.queryByLabelText("Sequence position for checkpoint 1")
      ).not.toBeInTheDocument();
    });
  });

  // 10.3 — hunt-mode, completion-threshold, completion-bonus, and time-limit
  // controls are present on the settings step.
  it("renders hunt-mode, completion-threshold, completion-bonus, and time-limit controls", async () => {
    renderComponent();
    await goToReview();

    expect(screen.getByLabelText("Hunt mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Completion threshold")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable completion bonus")).toBeInTheDocument();
    expect(screen.getByLabelText("Enable time limit")).toBeInTheDocument();

    // Enabling the completion bonus reveals its amount field.
    fireEvent.click(screen.getByLabelText("Enable completion bonus"));
    await waitFor(() => {
      expect(screen.getByLabelText("Completion bonus amount")).toBeInTheDocument();
    });

    // Enabling the time limit reveals its minutes field.
    fireEvent.click(screen.getByLabelText("Enable time limit"));
    await waitFor(() => {
      expect(screen.getByLabelText("Time limit minutes")).toBeInTheDocument();
    });
  });

  // 10.4 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave hints blank and no QR codes associated (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Checkpoints step.
    goToStep("1. Checkpoints");
    await waitFor(() => {
      expect(screen.getAllByText("A location hint is required.").length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText("Associate a QR checkpoint code for this checkpoint.").length
    ).toBeGreaterThan(0);
  });

  // 10.4 — an out-of-range point value is rejected.
  it("rejects an out-of-range point value", async () => {
    renderComponent();
    fillValidCheckpoints();
    fireEvent.change(screen.getAllByLabelText("Point Value")[0], { target: { value: "0" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Checkpoints");
    await waitFor(() => {
      expect(
        screen.getByText("Point value must be an integer between 1 and 10000.")
      ).toBeInTheDocument();
    });
  });

  // 10.5 — saving valid data calls updateInstance and shows a confirmation.
  it("saves valid data via updateInstance and shows a confirmation", async () => {
    renderComponent();
    fillValidCheckpoints();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.checkpoints).toHaveLength(2);
    const cp = payload.config.checkpoints[0];
    expect(cp.hint).toBe("Find the mural by the door");
    expect(cp.pointValue).toBe(100);
    expect(cp.sequencePosition).toBe(1);
    // The checkpoint code is populated from the QR system (a non-empty string).
    expect(typeof cp.checkpointCode).toBe("string");
    expect(cp.checkpointCode.length).toBeGreaterThan(0);
    expect(payload.config.huntMode).toBe("sequential");

    await waitFor(() => {
      expect(screen.getByText("Treasure hunt configuration saved.")).toBeInTheDocument();
    });
  });

  // 10.5 — a valid completion bonus persists with its amount.
  it("persists an enabled completion bonus with its amount", async () => {
    renderComponent();
    fillValidCheckpoints();
    await goToReview();

    fireEvent.click(screen.getByLabelText("Enable completion bonus"));
    await waitFor(() => {
      expect(screen.getByLabelText("Completion bonus amount")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Completion bonus amount"), {
      target: { value: "250" },
    });

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const payload = updateInstance.mock.calls[0][2];
    expect(payload.config.completionBonus).toEqual({ enabled: true, amount: 250 });
  });

  // 10.6 — add/remove checkpoint respects the 2-100 limit.
  it("respects the checkpoint minimum of 2 when removing", async () => {
    renderComponent();
    goToStep("1. Checkpoints");

    // At the 2-checkpoint minimum, remove is disabled on both.
    expect(screen.getByLabelText("Remove checkpoint 1")).toBeDisabled();
    expect(screen.getByLabelText("Remove checkpoint 2")).toBeDisabled();

    // Add a third checkpoint → removal becomes available.
    fireEvent.click(screen.getByRole("button", { name: /Add Checkpoint/i }));
    await waitFor(() => {
      expect(screen.getByTestId("checkpoint-editor-2")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove checkpoint 1")).not.toBeDisabled();

    // Remove it back down to two → remove disabled again.
    fireEvent.click(screen.getByLabelText("Remove checkpoint 3"));
    await waitFor(() => {
      expect(screen.queryByTestId("checkpoint-editor-2")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove checkpoint 1")).toBeDisabled();
  });

  // 10.6 — reorder controls move a checkpoint and renumber positions contiguously.
  it("reorders checkpoints and renumbers sequence positions contiguously", async () => {
    renderComponent();
    goToStep("1. Checkpoints");
    // Distinguish the two checkpoints by hint so we can verify the swap.
    const hints = screen.getAllByLabelText("Location Hint");
    fireEvent.change(hints[0], { target: { value: "Alpha" } });
    fireEvent.change(hints[1], { target: { value: "Beta" } });

    // At the top, "move up" is disabled for checkpoint 1; "move down" enabled.
    expect(screen.getByLabelText("Move checkpoint 1 up")).toBeDisabled();
    expect(screen.getByLabelText("Move checkpoint 2 down")).toBeDisabled();

    // Move checkpoint 1 down → Beta becomes first, Alpha second.
    fireEvent.click(screen.getByLabelText("Move checkpoint 1 down"));
    await waitFor(() => {
      expect(screen.getAllByLabelText("Location Hint")[0].value).toBe("Beta");
    });
    expect(screen.getAllByLabelText("Location Hint")[1].value).toBe("Alpha");
    // Positions renumbered contiguously 1..2 in array order.
    const positions = screen.getAllByLabelText(/Sequence position for checkpoint/);
    expect(positions[0].value).toBe("1");
    expect(positions[1].value).toBe("2");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./TreasureHuntConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
