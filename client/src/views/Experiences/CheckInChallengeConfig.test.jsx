import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CheckInChallengeConfig from "./CheckInChallengeConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors PredictionConfig.test.jsx mocking). jest.mock
// is hoisted above the imports at runtime, so this keeps import/first satisfied.
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
          element={<CheckInChallengeConfig />}
        />
      </Routes>
    </MemoryRouter>
  );

// Navigate directly to a step via the step indicator.
const goToStep = (label) => fireEvent.click(screen.getByText(label));

// Fill the minimum valid check-in point: a label + an associated QR code
// (pointValue defaults valid at 100).
function fillValidPoint() {
  goToStep("1. Check-In Points");
  fireEvent.change(screen.getByLabelText("Point Label"), {
    target: { value: "Main Stage" },
  });
  // Associate a QR code via the QR-system control (never free-typed).
  fireEvent.click(screen.getByRole("button", { name: /Associate QR code for check-in point 1/i }));
}

async function goToReview() {
  goToStep("3. Settings & Review");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("CheckInChallengeConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 11.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Check-In Challenges")).toBeInTheDocument();
    // The default point editor is present.
    expect(screen.getByTestId("point-editor-0")).toBeInTheDocument();
  });

  // 11.2 — adding a point shows label / point-value / QR-association / time-window controls.
  it("shows label, point-value, QR-association, and time-window controls per point", async () => {
    renderComponent();
    goToStep("1. Check-In Points");

    // The default point exposes all controls.
    expect(screen.getByLabelText("Point Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Point Value")).toBeInTheDocument();
    // QR association control (button + code display), never a free-typed field.
    expect(
      screen.getByRole("button", { name: /Associate QR code for check-in point 1/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("checkin-code-empty-0")).toBeInTheDocument();
    // The optional time-window toggle is present.
    expect(
      screen.getByLabelText("Enable time window for check-in point 1")
    ).toBeInTheDocument();

    // Enabling the window reveals start/end date-time pickers.
    fireEvent.click(screen.getByLabelText("Enable time window for check-in point 1"));
    await waitFor(() => {
      expect(screen.getByLabelText("Window Start")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Window End")).toBeInTheDocument();

    // Associating a QR code replaces the empty indicator with a code chip.
    fireEvent.click(screen.getByRole("button", { name: /Associate QR code for check-in point 1/i }));
    await waitFor(() => {
      expect(screen.getByTestId("checkin-code-0")).toBeInTheDocument();
    });

    // Adding a second point exposes a second full editor.
    fireEvent.click(screen.getByRole("button", { name: /Add Check-In Point/i }));
    await waitFor(() => {
      expect(screen.getByTestId("point-editor-1")).toBeInTheDocument();
    });
    const editor1 = screen.getByTestId("point-editor-1");
    expect(within(editor1).getByLabelText("Point Label")).toBeInTheDocument();
    expect(within(editor1).getByLabelText("Point Value")).toBeInTheDocument();
  });

  // 11.3 — adding a milestone shows type / reward-label / reward-points and the
  // threshold-count or required-set control for the selected type.
  it("shows milestone type, reward-label, reward-points, and the per-type condition control", async () => {
    renderComponent();
    goToStep("2. Milestone Rewards");

    // No milestones by default.
    fireEvent.click(screen.getByRole("button", { name: /Add Milestone Reward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("milestone-editor-0")).toBeInTheDocument();
    });

    const editor = screen.getByTestId("milestone-editor-0");
    expect(within(editor).getByLabelText("Milestone type for milestone 1")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Reward Label")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Reward Points (optional)")).toBeInTheDocument();
    // Default type is threshold → threshold-count control shows.
    expect(within(editor).getByLabelText("Threshold Count")).toBeInTheDocument();

    // Switch type to required-set → the required-set multi-select shows instead.
    fireEvent.mouseDown(within(editor).getByLabelText("Milestone type for milestone 1"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Required set of points"));

    await waitFor(() => {
      expect(within(editor).getByLabelText("Required set for milestone 1")).toBeInTheDocument();
    });
    expect(within(editor).queryByLabelText("Threshold Count")).not.toBeInTheDocument();
  });

  // 11.4 — the leaderboard control is present.
  it("renders a leaderboard control on the settings step", async () => {
    renderComponent();
    await goToReview();
    expect(screen.getByLabelText("Enable leaderboard")).toBeInTheDocument();
  });

  // 11.5 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave label blank and no QR code associated (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Check-In Points step.
    goToStep("1. Check-In Points");
    await waitFor(() => {
      expect(screen.getByText("Point label is required.")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Associate a QR check-in code for this point.")
    ).toBeInTheDocument();
  });

  // 11.5 — an out-of-range point value is rejected.
  it("rejects an out-of-range point value", async () => {
    renderComponent();
    fillValidPoint();
    fireEvent.change(screen.getByLabelText("Point Value"), { target: { value: "0" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText("Please fix the highlighted fields before saving.")
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Check-In Points");
    await waitFor(() => {
      expect(
        screen.getByText("Point value must be an integer between 1 and 10000.")
      ).toBeInTheDocument();
    });
  });

  // 11.6 — saving valid data calls updateInstance and shows a confirmation.
  it("saves valid data via updateInstance and shows a confirmation", async () => {
    renderComponent();
    fillValidPoint();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.checkInPoints).toHaveLength(1);
    const pt = payload.config.checkInPoints[0];
    expect(pt.label).toBe("Main Stage");
    expect(pt.pointValue).toBe(100);
    // The check-in code is populated from the QR system (a non-empty string).
    expect(typeof pt.checkInCode).toBe("string");
    expect(pt.checkInCode.length).toBeGreaterThan(0);
    // Leaderboard defaults enabled.
    expect(payload.config.leaderboardEnabled).toBe(true);

    await waitFor(() => {
      expect(screen.getByText("Check-in challenge configuration saved.")).toBeInTheDocument();
    });
  });

  // 11.6 — a valid threshold milestone persists with its threshold count.
  it("persists a valid threshold milestone", async () => {
    renderComponent();
    fillValidPoint();

    goToStep("2. Milestone Rewards");
    fireEvent.click(screen.getByRole("button", { name: /Add Milestone Reward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("milestone-editor-0")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Reward Label"), {
      target: { value: "Event Explorer" },
    });
    fireEvent.change(screen.getByLabelText("Threshold Count"), { target: { value: "1" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const payload = updateInstance.mock.calls[0][2];
    expect(payload.config.milestoneRewards).toHaveLength(1);
    const ms = payload.config.milestoneRewards[0];
    expect(ms.type).toBe("threshold");
    expect(ms.rewardLabel).toBe("Event Explorer");
    expect(ms.thresholdCount).toBe(1);
  });

  // 11.7 — add/remove point respects the 1-200 limit.
  it("respects the check-in point minimum when removing", async () => {
    renderComponent();
    goToStep("1. Check-In Points");

    // At the 1-point minimum, remove is disabled.
    expect(screen.getByLabelText("Remove check-in point 1")).toBeDisabled();

    // Add a second point → removal becomes available.
    fireEvent.click(screen.getByRole("button", { name: /Add Check-In Point/i }));
    await waitFor(() => {
      expect(screen.getByTestId("point-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove check-in point 1")).not.toBeDisabled();

    // Remove it back down to one → remove disabled again.
    fireEvent.click(screen.getByLabelText("Remove check-in point 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("point-editor-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove check-in point 1")).toBeDisabled();
  });

  // 11.7 — add/remove milestone respects the 0-20 limit (removal down to 0 allowed).
  it("allows adding and removing milestones down to zero", async () => {
    renderComponent();
    goToStep("2. Milestone Rewards");

    // Add a milestone, then remove it back to zero (allowed).
    fireEvent.click(screen.getByRole("button", { name: /Add Milestone Reward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("milestone-editor-0")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Remove milestone 1"));
    await waitFor(() => {
      expect(screen.queryByTestId("milestone-editor-0")).not.toBeInTheDocument();
    });
    expect(screen.getByText("No milestone rewards configured.")).toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./CheckInChallengeConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
