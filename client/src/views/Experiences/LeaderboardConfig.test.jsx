import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LeaderboardConfig, { validateAll } from "./LeaderboardConfig";
import { getInstance, updateInstance, listInstances } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
// LeaderboardConfig loads existing config via getInstance, saves via
// updateInstance, and loads the other point-emitting sources in the event via
// listInstances.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(() => Promise.resolve({ data: {} })),
  updateInstance: jest.fn(() => Promise.resolve({ data: {} })),
  listInstances: jest.fn(() => Promise.resolve({ data: {} })),
}));

// Two other point-emitting instances in the same event (distinct experienceIds
// from the exp1 under test) so the source selector has options. A non-point-
// emitting instance (social-wall) and the instance under test are included to
// confirm the component filters them out.
const AVAILABLE_INSTANCES = [
  { experienceId: "loy1", name: "Loyalty Rewards", experienceType: "loyalty-rewards" },
  { experienceId: "triv1", name: "Trivia Challenge", experienceType: "trivia-challenges" },
  { experienceId: "wall1", name: "Social Wall", experienceType: "social-wall" },
  { experienceId: "exp1", name: "This Leaderboard", experienceType: "leaderboards" },
];

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/config"
          element={<LeaderboardConfig />}
        />
        <Route
          path="/admin/my-events/:eventId/experiences"
          element={<div>Engagements Dashboard</div>}
        />
      </Routes>
    </MemoryRouter>
  );

// The shell renders steps as buttons labeled by their step text (prefixed with
// "✓ " once completed). Navigate directly to a step by its label.
const STEP_LABELS = ["Sources", "Scoring & Display", "Review & Save"];
const goToStep = (index) => {
  const target = STEP_LABELS[index];
  const btn = screen
    .getAllByRole("button")
    .find((b) => b.textContent.trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};

// The shell footer's Save on the last step is a plain button labeled
// "Save Configuration".
const clickSave = () =>
  fireEvent.click(screen.getByRole("button", { name: /Save Configuration/i }));

// Matches the innermost element whose text contains the needle, tolerant of the
// shell's "⚠ " error-banner prefix.
const matchText = (needle) =>
  screen.getByText((_content, node) => {
    const text = node?.textContent || "";
    const hasNeedle = text.replace(/^⚠\s*/, "").includes(needle);
    const childHasNeedle = Array.from(node?.children || []).some((c) =>
      (c.textContent || "").replace(/^⚠\s*/, "").includes(needle)
    );
    return hasNeedle && !childHasNeedle;
  });

// Set an MUI Select (rendered as a listbox) to the option with the given text.
async function selectOption(labelText, optionText) {
  fireEvent.mouseDown(screen.getByLabelText(labelText));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText(optionText));
}

// A fully-valid form object for direct validateAll unit tests.
const validForm = () => ({
  sources: [],
  aggregationMode: "sum",
  displaySize: 10,
  tieBreak: "shared-rank",
});

describe("LeaderboardConfig — render + interaction (Requirement 8)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
    listInstances.mockResolvedValue({ data: { data: { instances: AVAILABLE_INSTANCES } } });
  });

  // 8.1 — renders default state without crashing; getInstance + listInstances
  // invoked on mount.
  it("renders the config form in its default state without crashing", async () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Leaderboard")).toBeInTheDocument();

    await waitFor(() => {
      expect(getInstance).toHaveBeenCalledWith("evt1", "exp1");
    });
    expect(listInstances).toHaveBeenCalledWith("evt1");
  });

  // 8.2 — shows the source selector listing other point-emitting instances in
  // the same event and a weight input per selected source.
  it("shows a source selector listing other point-emitting instances and a weight input per source", async () => {
    renderComponent();
    goToStep(0);

    // Wait until the available sources have loaded from listInstances.
    await waitFor(() => {
      expect(listInstances).toHaveBeenCalledWith("evt1");
    });

    // No source rows before adding.
    expect(screen.queryByTestId("source-row-0")).not.toBeInTheDocument();

    // Add a source → the select and weight input for row 0 appear.
    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });
    expect(screen.getByTestId("source-select-0")).toBeInTheDocument();
    expect(screen.getByTestId("source-weight-0")).toBeInTheDocument();

    // The select lists the mocked point-emitting instances but not the
    // non-point-emitting social wall nor the leaderboard under test.
    fireEvent.mouseDown(screen.getByLabelText("Source experience for source 1"));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Loyalty Rewards")).toBeInTheDocument();
    expect(within(listbox).getByText("Trivia Challenge")).toBeInTheDocument();
    expect(within(listbox).queryByText("Social Wall")).not.toBeInTheDocument();
    expect(within(listbox).queryByText("This Leaderboard")).not.toBeInTheDocument();
  });

  // 8.3 — shows aggregation-mode, display-size, and tie-break controls.
  it("shows aggregation-mode, display-size, and tie-break controls on the scoring step", () => {
    renderComponent();
    goToStep(1);
    expect(screen.getByTestId("aggregation-mode")).toBeInTheDocument();
    expect(screen.getByTestId("display-size-input")).toBeInTheDocument();
    expect(screen.getByTestId("tie-break-input")).toBeInTheDocument();
  });

  // 8.4 — with zero sources selected, shows the Manual_Mode indicator; adding a
  // source removes it.
  it("shows the Manual Mode indicator with zero sources and hides it once a source is added", async () => {
    renderComponent();
    goToStep(0);

    expect(screen.getByTestId("manual-mode-indicator")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("manual-mode-indicator")).not.toBeInTheDocument();
  });

  // 8.5 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows a field error", async () => {
    renderComponent();
    goToStep(0);
    await waitFor(() => {
      expect(listInstances).toHaveBeenCalledWith("evt1");
    });

    // Add a source but leave its sourceExperienceId unselected → invalid.
    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });

    goToStep(2);
    clickSave();

    await waitFor(() => {
      expect(matchText("Please fix the highlighted fields before saving.")).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level error surfaces on the Sources step.
    goToStep(0);
    await waitFor(() => {
      expect(screen.getByText("Select a source experience.")).toBeInTheDocument();
    });
  });

  // 8.6 — saving valid data calls updateInstance and shows confirmation. The
  // simplest reliable valid path is zero sources (Manual Mode) with default
  // displaySize/tieBreak.
  it("saves valid manual-mode data via updateInstance and shows the confirmation", async () => {
    renderComponent();

    goToStep(2);
    clickSave();

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });

    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");

    const { config } = payload;
    expect(config).toEqual(expect.any(Object));
    expect(config.sources).toEqual([]);
    expect(config.aggregationMode).toBe("sum");
    expect(config.displaySize).toBe(10);
    expect(config.tieBreak).toBe("shared-rank");
    expect(typeof config.accentColor).toBe("string");

    // On success, the organizer is redirected to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 8.6 — saving with one source picked from the available list persists it.
  it("saves an aggregation-mode config with a selected source and its weight", async () => {
    renderComponent();
    goToStep(0);
    await waitFor(() => {
      expect(listInstances).toHaveBeenCalledWith("evt1");
    });

    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });

    await selectOption("Source experience for source 1", "Loyalty Rewards");
    fireEvent.change(screen.getByTestId("source-weight-0"), { target: { value: "5" } });

    goToStep(2);
    clickSave();

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });

    const config = updateInstance.mock.calls[0][2].config;
    expect(config.sources).toEqual([{ sourceExperienceId: "loy1", weight: 5 }]);
    expect(config.aggregationMode).toBe("sum");
    expect(typeof config.accentColor).toBe("string");

    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 8.7 — add/remove source respects the count; remove-source removes a row.
  it("removes a source row via remove-source", async () => {
    renderComponent();
    goToStep(0);

    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("remove-source-0"));
    await waitFor(() => {
      expect(screen.queryByTestId("source-row-0")).not.toBeInTheDocument();
    });
    // Back to Manual Mode with zero sources.
    expect(screen.getByTestId("manual-mode-indicator")).toBeInTheDocument();
  });

  // 8.7 — the add-source button becomes disabled at the 20-source maximum.
  it("disables the add-source button at the 20-source maximum", async () => {
    renderComponent();
    goToStep(0);

    const addButton = screen.getByTestId("add-source-button");
    for (let i = 0; i < 20; i += 1) {
      fireEvent.click(addButton);
    }

    await waitFor(() => {
      expect(screen.getByTestId("source-row-19")).toBeInTheDocument();
    });
    expect(screen.getByTestId("add-source-button")).toBeDisabled();
    expect(screen.queryByTestId("source-row-20")).not.toBeInTheDocument();
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LeaderboardConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  // Duplicate/identically-named sources (e.g. several raffles all named
  // "Raffles") must render as distinguishable options so the organizer can tell
  // them apart. Distinct-name sources keep their plain name.
  it("disambiguates identically-named sources in the selector", async () => {
    listInstances.mockResolvedValue({
      data: {
        data: {
          instances: [
            { experienceId: "raf-aaaaaa", name: "Raffles", experienceType: "raffles" },
            { experienceId: "raf-bbbbbb", name: "Raffles", experienceType: "raffles" },
            { experienceId: "loy1", name: "Loyalty Rewards", experienceType: "loyalty-rewards" },
            { experienceId: "exp1", name: "This Leaderboard", experienceType: "leaderboards" },
          ],
        },
      },
    });

    renderComponent();
    goToStep(0);
    await waitFor(() => {
      expect(listInstances).toHaveBeenCalledWith("evt1");
    });

    fireEvent.click(screen.getByTestId("add-source-button"));
    await waitFor(() => {
      expect(screen.getByTestId("source-row-0")).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByLabelText("Source experience for source 1"));
    const listbox = await screen.findByRole("listbox");

    // The two identically-named raffles each get a short-id suffix so they are
    // no longer identical, and there is no bare "Raffles" option.
    expect(within(listbox).getByText(/Raffles.*#aaaaaa/)).toBeInTheDocument();
    expect(within(listbox).getByText(/Raffles.*#bbbbbb/)).toBeInTheDocument();
    expect(within(listbox).queryByText("Raffles")).not.toBeInTheDocument();

    // A source with a unique name is left untouched.
    expect(within(listbox).getByText("Loyalty Rewards")).toBeInTheDocument();
  });
});

describe("validateAll — plugin rules 1.2–1.9", () => {
  it("returns no errors for a fully valid (manual-mode) form", () => {
    expect(validateAll(validForm())).toEqual({});
  });

  it("accepts a single valid source (aggregation mode)", () => {
    const errors = validateAll({
      ...validForm(),
      sources: [{ sourceExperienceId: "loy1", weight: 5 }],
    });
    expect(errors).toEqual({});
  });

  // Rule 1.2 — source count 0–20.
  it("accepts zero sources (Manual Mode) and up to 20 sources", () => {
    expect(validateAll({ ...validForm(), sources: [] })["sources"]).toBeUndefined();

    const twenty = Array.from({ length: 20 }, (_, i) => ({
      sourceExperienceId: `s${i}`,
      weight: 1,
    }));
    expect(validateAll({ ...validForm(), sources: twenty })["sources"]).toBeUndefined();
  });

  it("rejects more than 20 sources (1.2)", () => {
    const twentyOne = Array.from({ length: 21 }, (_, i) => ({
      sourceExperienceId: `s${i}`,
      weight: 1,
    }));
    expect(validateAll({ ...validForm(), sources: twentyOne })["sources"]).toMatch(
      /between 0 and 20/
    );
  });

  // Rule 1.3 — weight is a number in [0, 1000].
  it("rejects a source weight below 0 or above 1000 (1.3)", () => {
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: -1 }] })[
        "sources[0].weight"
      ]
    ).toMatch(/between 0 and 1000/);
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: 1001 }] })[
        "sources[0].weight"
      ]
    ).toMatch(/between 0 and 1000/);
  });

  it("accepts the 0 and 1000 weight boundaries (1.3)", () => {
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: 0 }] })[
        "sources[0].weight"
      ]
    ).toBeUndefined();
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: 1000 }] })[
        "sources[0].weight"
      ]
    ).toBeUndefined();
  });

  it("rejects a blank or non-numeric weight (1.3)", () => {
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: "" }] })[
        "sources[0].weight"
      ]
    ).toBeDefined();
    expect(
      validateAll({ ...validForm(), sources: [{ sourceExperienceId: "s0", weight: "abc" }] })[
        "sources[0].weight"
      ]
    ).toBeDefined();
  });

  // Rule 1.4 — sourceExperienceId non-empty, then same-event membership.
  it("rejects an empty sourceExperienceId (1.4)", () => {
    const errors = validateAll({
      ...validForm(),
      sources: [{ sourceExperienceId: "", weight: 1 }],
    });
    expect(errors["sources[0].sourceExperienceId"]).toBe("Select a source experience.");
  });

  it("enforces same-event membership when availableSourceIds is supplied (1.4)", () => {
    const available = ["loy1", "triv1"];
    // A source not in the same-event set is rejected.
    expect(
      validateAll(
        { ...validForm(), sources: [{ sourceExperienceId: "ghost", weight: 1 }] },
        available
      )["sources[0].sourceExperienceId"]
    ).toBe("Source experience must reference an experience in the same event.");
    // A member of the set passes.
    expect(
      validateAll(
        { ...validForm(), sources: [{ sourceExperienceId: "loy1", weight: 1 }] },
        available
      )["sources[0].sourceExperienceId"]
    ).toBeUndefined();
  });

  it("accepts a Set for availableSourceIds (1.4)", () => {
    const errors = validateAll(
      { ...validForm(), sources: [{ sourceExperienceId: "loy1", weight: 1 }] },
      new Set(["loy1"])
    );
    expect(errors["sources[0].sourceExperienceId"]).toBeUndefined();
  });

  // Rule 1.5 — duplicate source id flagged at the later index.
  it("rejects a duplicate source id at the later index (1.5)", () => {
    const errors = validateAll({
      ...validForm(),
      sources: [
        { sourceExperienceId: "loy1", weight: 1 },
        { sourceExperienceId: "loy1", weight: 2 },
      ],
    });
    expect(errors["sources[0].sourceExperienceId"]).toBeUndefined();
    expect(errors["sources[1].sourceExperienceId"]).toMatch(/Duplicate source/);
  });

  // Rule 1.7 — displaySize integer 1–1000.
  it("rejects a display size outside 1–1000 (1.7)", () => {
    expect(validateAll({ ...validForm(), displaySize: 0 })["displaySize"]).toMatch(
      /between 1 and 1000/
    );
    expect(validateAll({ ...validForm(), displaySize: 1001 })["displaySize"]).toMatch(
      /between 1 and 1000/
    );
  });

  it("rejects a non-integer display size (1.7)", () => {
    expect(validateAll({ ...validForm(), displaySize: 2.5 })["displaySize"]).toBeDefined();
  });

  it("accepts the 1 and 1000 display-size boundaries (1.7)", () => {
    expect(validateAll({ ...validForm(), displaySize: 1 })["displaySize"]).toBeUndefined();
    expect(validateAll({ ...validForm(), displaySize: 1000 })["displaySize"]).toBeUndefined();
  });

  // Rule 1.8 — tieBreak membership.
  it("rejects an invalid tie-break rule (1.8)", () => {
    expect(validateAll({ ...validForm(), tieBreak: "nope" })["tieBreak"]).toBe(
      "Select a valid tie-break rule."
    );
  });

  it("accepts both valid tie-break rules (1.8)", () => {
    expect(validateAll({ ...validForm(), tieBreak: "shared-rank" })["tieBreak"]).toBeUndefined();
    expect(
      validateAll({ ...validForm(), tieBreak: "earliest-contribution" })["tieBreak"]
    ).toBeUndefined();
  });

  it("skips same-event membership when availableSourceIds is omitted (structural-only)", () => {
    const errors = validateAll({
      ...validForm(),
      sources: [{ sourceExperienceId: "any-id", weight: 1 }],
    });
    expect(errors["sources[0].sourceExperienceId"]).toBeUndefined();
  });
});
