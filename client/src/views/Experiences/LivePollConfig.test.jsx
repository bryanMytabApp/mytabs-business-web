import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LivePollConfig from "./LivePollConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// Mock experienceService (mirrors RaffleConfig.test.jsx mocking). jest.mock is
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
          element={<LivePollConfig />}
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
// the shell adds to completed steps).
const goToStep = (label) => {
  const target = String(label).replace(/^\d+\.\s*/, "");
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// Build a single valid poll (question + two distinct option labels).
function fillValidPoll() {
  fireEvent.change(screen.getByLabelText(/Question/i), { target: { value: "Best food truck?" } });
  fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Tacos" } });
  fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "BBQ" } });
}

// Advance from the Polls step to the Review & Save step. The flow is now
// Polls → Schedule → Review, so this clicks Next twice.
async function goToReview() {
  fireEvent.click(screen.getByText(/Next →/)); // Polls → Schedule
  await waitFor(() => {
    expect(screen.getByText(/Schedule \(optional\)/)).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText(/Next →/)); // Schedule → Review
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("LivePollConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 6.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Live Polls")).toBeInTheDocument();
  });

  // 6.2 — a poll exposes question/mode/options controls by default, and adding
  // another poll exposes the same controls for it.
  it("displays question, selection mode, and option controls for each poll", async () => {
    renderComponent();
    expect(screen.getByLabelText(/Question/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Selection Mode")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Option 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add Poll/i }));
    await waitFor(() => {
      expect(screen.getByText("Poll 2")).toBeInTheDocument();
    });
    // Two questions now present.
    expect(screen.getAllByLabelText(/Question/i).length).toBe(2);
  });

  // 6.3 — setting mode to multiple reveals the max-selections control.
  it("reveals the max-selections control when mode is multiple", async () => {
    renderComponent();
    expect(screen.queryByLabelText("Max Selections")).not.toBeInTheDocument();

    // MUI Select renders a hidden native input keyed by its label.
    fireEvent.mouseDown(screen.getByLabelText("Selection Mode"));
    const listbox = await screen.findByRole("listbox");
    fireEvent.click(within(listbox).getByText("Multiple choice"));

    await waitFor(() => {
      expect(screen.getByLabelText("Max Selections")).toBeInTheDocument();
    });
  });

  // 6.4 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave the question/options blank (invalid).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface back on the Polls step.
    goToStep("1. Polls");
    await waitFor(() => {
      expect(screen.getByText("Question is required.")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Option label is required.").length).toBeGreaterThanOrEqual(1);
  });

  // 6.4 — duplicate option labels are rejected with a field error.
  it("rejects duplicate option labels", async () => {
    renderComponent();
    fireEvent.change(screen.getByLabelText(/Question/i), { target: { value: "Pick one" } });
    fireEvent.change(screen.getByLabelText("Option 1"), { target: { value: "Same" } });
    fireEvent.change(screen.getByLabelText("Option 2"), { target: { value: "Same" } });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Polls");
    await waitFor(() => {
      expect(screen.getByText("Duplicate option label.")).toBeInTheDocument();
    });
  });

  // 6.5 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidPoll();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.polls).toHaveLength(1);
    expect(payload.config.polls[0].question).toBe("Best food truck?");
    expect(payload.config.polls[0].options.map((o) => o.label)).toEqual(["Tacos", "BBQ"]);
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    // After a successful save the form redirects to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 6.6 — add/remove poll and option controls respect count limits.
  it("respects add/remove limits for polls and options", async () => {
    renderComponent();

    // Only one poll → its remove control is not rendered.
    expect(screen.queryByLabelText("Remove poll 1")).not.toBeInTheDocument();

    // Adding a poll enables removal of each.
    fireEvent.click(screen.getByRole("button", { name: /Add Poll/i }));
    await waitFor(() => {
      expect(screen.getByLabelText("Remove poll 2")).toBeInTheDocument();
    });

    // Two options → remove buttons are disabled at the minimum.
    expect(screen.getAllByLabelText("Remove option 1")[0]).toBeDisabled();

    // Add an option → now removal is enabled.
    fireEvent.click(screen.getAllByRole("button", { name: /Add Option/i })[0]);
    await waitFor(() => {
      expect(screen.getAllByLabelText("Remove option 1")[0]).not.toBeDisabled();
    });
  });

  // Navigate to the Schedule step (one Next from Polls).
  async function goToSchedule() {
    fireEvent.click(screen.getByText(/Next →/));
    await waitFor(() => {
      expect(screen.getByText(/Schedule \(optional\)/)).toBeInTheDocument();
    });
  }

  // 5.x — the Schedule step renders and defaults each poll to manual mode.
  it("renders the schedule step with polls in manual mode by default", async () => {
    renderComponent();
    await goToSchedule();
    expect(screen.getByText(/Manual mode/i)).toBeInTheDocument();
    // Toggling on scheduling reveals the open/close pickers.
    fireEvent.click(screen.getByLabelText("Schedule poll 1"));
    await waitFor(() => {
      expect(screen.getByLabelText(/Opens at/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Closes at/i)).toBeInTheDocument();
  });

  // 5.x — a valid schedule window is persisted as ISO strings on save.
  it("persists scheduledOpenAt/scheduledCloseAt as ISO when scheduling is enabled", async () => {
    renderComponent();
    fillValidPoll();
    await goToSchedule();

    // Enable scheduling — the component seeds now / now+1h defaults.
    fireEvent.click(screen.getByLabelText("Schedule poll 1"));
    await waitFor(() => {
      expect(screen.getByLabelText(/Opens at/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/Next →/)); // Schedule → Review
    await waitFor(() => {
      expect(screen.getByText("Save Configuration")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const payload = updateInstance.mock.calls[0][2];
    const poll = payload.config.polls[0];
    expect(typeof poll.scheduledOpenAt).toBe("string");
    expect(typeof poll.scheduledCloseAt).toBe("string");
    // Both parse as valid ISO and close is after open.
    expect(new Date(poll.scheduledCloseAt).getTime()).toBeGreaterThan(
      new Date(poll.scheduledOpenAt).getTime()
    );
  });

  // 5.x — a manual-mode poll omits the schedule fields entirely.
  it("omits schedule fields for a manual-mode poll", async () => {
    renderComponent();
    fillValidPoll();
    await goToReview(); // never enables scheduling
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const poll = updateInstance.mock.calls[0][2].config.polls[0];
    expect(poll).not.toHaveProperty("scheduledOpenAt");
    expect(poll).not.toHaveProperty("scheduledCloseAt");
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LivePollConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
