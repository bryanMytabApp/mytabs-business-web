import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import dayjs from "dayjs";
import PhotoContestConfig, { validateAll } from "./PhotoContestConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(() => Promise.resolve({ data: {} })),
  updateInstance: jest.fn(() => Promise.resolve({ data: {} })),
}));

// The real MUI x-date-pickers DateTimePicker renders a segmented, masked text
// field that is impractical to drive deterministically with fireEvent. Swap it
// for a lightweight native datetime-local input that preserves the component's
// contract: it reads `value` (a dayjs object or null), exposes the same
// aria-label/testid via slotProps.textField, and emits a dayjs object through
// onChange — so the component's state, validation, and ISO-string save path all
// exercise the real code.
jest.mock("@mui/x-date-pickers/DateTimePicker", () => {
  // Require dayjs lazily inside the factory — jest.mock factories may not
  // reference out-of-scope imports.
  const mockDayjs = require("dayjs");
  return {
    DateTimePicker: ({ label, value, onChange, slotProps }) => {
      const tf = (slotProps && slotProps.textField) || {};
      const ariaLabel = (tf.inputProps && tf.inputProps["aria-label"]) || label;
      const testId = tf["data-testid"];
      const helperText = tf.helperText;
      return (
        <span>
          <input
            type="datetime-local"
            aria-label={ariaLabel}
            data-testid={testId}
            value={value && value.format ? value.format("YYYY-MM-DDTHH:mm") : ""}
            onChange={(e) => onChange(e.target.value ? mockDayjs(e.target.value) : null)}
          />
          {helperText && helperText !== " " ? <span>{helperText}</span> : null}
        </span>
      );
    },
  };
});

// LocalizationProvider / AdapterDayjs just need to render their children.
jest.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: ({ children }) => <>{children}</>,
}));
jest.mock("@mui/x-date-pickers/AdapterDayjs", () => ({ AdapterDayjs: function AdapterDayjs() {} }));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/config"
          element={<PhotoContestConfig />}
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

// The shared shell renders step buttons by label (in STEPS order), optionally
// prefixed with "✓ " on completed steps. Navigate by the step's INDEX.
const STEP_LABELS = ["Windows & Moderation", "Limits & Media", "Review & Save"];
const goToStep = (index) => {
  const target = STEP_LABELS[index];
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};
const clickSave = () => fireEvent.click(screen.getByRole("button", { name: /Save Configuration/i }));

// Fill both windows with a valid ordering:
//   submissionStart < votingStart <= ... < submissionEnd, votingStart < votingEnd
function fillValidWindows() {
  goToStep(0);
  fireEvent.change(screen.getByLabelText("Submission start"), {
    target: { value: "2025-01-01T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Submission end"), {
    target: { value: "2025-01-05T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Voting start"), {
    target: { value: "2025-01-02T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Voting end"), {
    target: { value: "2025-01-06T09:00" },
  });
}

// A fully-valid form object for direct validateAll unit tests.
const validForm = () => ({
  submissionWindow: { start: dayjs("2025-01-01T09:00"), end: dayjs("2025-01-05T09:00") },
  votingWindow: { start: dayjs("2025-01-02T09:00"), end: dayjs("2025-01-06T09:00") },
  moderationMode: "require_approval",
  submissionsPerAttendeeLimit: 3,
  votesPerAttendeeLimit: 20,
  allowedMediaConstraints: {
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSize: 10485760,
  },
  winnerCount: 3,
});

describe("PhotoContestConfig — render + interaction (Requirement 10)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 10.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", async () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Photo Contest")).toBeInTheDocument();
    // getInstance is invoked on mount to load any existing config.
    await waitFor(() => {
      expect(getInstance).toHaveBeenCalledWith("evt1", "exp1");
    });
  });

  // 10.2 — shows controls for both windows, moderation, both limits, allowed
  // file types, max file size, and winner count (across the stepped form).
  it("shows window, moderation, limit, media, and winner controls", () => {
    renderComponent();

    // Step 0 — Windows & Moderation.
    goToStep(0);
    expect(screen.getByLabelText("Submission start")).toBeInTheDocument();
    expect(screen.getByLabelText("Submission end")).toBeInTheDocument();
    expect(screen.getByLabelText("Voting start")).toBeInTheDocument();
    expect(screen.getByLabelText("Voting end")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-mode")).toBeInTheDocument();

    // Step 1 — Limits & Media.
    goToStep(1);
    expect(screen.getByLabelText("Submissions per attendee")).toBeInTheDocument();
    expect(screen.getByLabelText("Votes per attendee")).toBeInTheDocument();
    expect(screen.getByLabelText("Winner count")).toBeInTheDocument();
    expect(screen.getByLabelText("Allowed file types")).toBeInTheDocument();
    expect(screen.getByLabelText("Max file size (bytes)")).toBeInTheDocument();
  });

  // 10.3 — moderation mode selector presents BOTH auto_approve and require_approval.
  it("presents both auto_approve and require_approval moderation modes", () => {
    renderComponent();
    goToStep(0);
    expect(screen.getByTestId("moderation-mode-auto_approve")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-mode-require_approval")).toBeInTheDocument();

    // Default is require_approval; selecting auto_approve updates the choice.
    const autoRadio = within(screen.getByTestId("moderation-mode-auto_approve")).getByRole("radio");
    const requireRadio = within(
      screen.getByTestId("moderation-mode-require_approval")
    ).getByRole("radio");
    expect(requireRadio).toBeChecked();
    expect(autoRadio).not.toBeChecked();

    fireEvent.click(autoRadio);
    expect(autoRadio).toBeChecked();
  });

  // 10.4 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();

    // Default form has empty windows → invalid. Also push a limit out of range.
    goToStep(1);
    fireEvent.change(screen.getByLabelText("Winner count"), { target: { value: "0" } });

    goToStep(2);
    clickSave();

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on their respective steps.
    goToStep(0);
    await waitFor(() => {
      expect(screen.getByText("Submission start is required.")).toBeInTheDocument();
    });
    expect(screen.getByText("Voting start is required.")).toBeInTheDocument();

    goToStep(1);
    expect(
      screen.getByText("Winner count must be an integer between 1 and 100.")
    ).toBeInTheDocument();
  });

  // 10.5 — saving valid data calls updateInstance once with the shaped config
  // and shows the confirmation.
  it("saves valid data via updateInstance with the shaped config and confirms", async () => {
    renderComponent();
    fillValidWindows();

    goToStep(2);
    clickSave();

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });

    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");

    const { config } = payload;
    // Windows persisted as ISO strings.
    expect(config.submissionWindow.start).toBe(dayjs("2025-01-01T09:00").toISOString());
    expect(config.submissionWindow.end).toBe(dayjs("2025-01-05T09:00").toISOString());
    expect(config.votingWindow.start).toBe(dayjs("2025-01-02T09:00").toISOString());
    expect(config.votingWindow.end).toBe(dayjs("2025-01-06T09:00").toISOString());
    // Defaults carried through unchanged.
    expect(config.moderationMode).toBe("require_approval");
    expect(config.submissionsPerAttendeeLimit).toBe(3);
    expect(config.votesPerAttendeeLimit).toBe(20);
    expect(config.winnerCount).toBe(3);
    // Self-voting defaults to OFF unless the organizer opts in.
    expect(config.allowSelfVote).toBe(false);
    expect(config.allowedMediaConstraints).toEqual({
      allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
      maxFileSize: 10485760,
    });
    // Theme color is persisted (defaults when unchanged).
    expect(typeof config.accentColor).toBe("string");

    // After a successful save the form redirects to the engagements dashboard.
    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  it("saves allowSelfVote:true when the organizer enables self-voting", async () => {
    renderComponent();
    fillValidWindows();

    // Toggle the Allow self-voting checkbox on (Windows & Moderation step).
    goToStep(0);
    const selfVote = within(screen.getByTestId("allow-self-vote")).getByRole("checkbox");
    fireEvent.click(selfVote);

    goToStep(2);
    clickSave();

    await waitFor(() => expect(updateInstance).toHaveBeenCalledTimes(1));
    const { config } = updateInstance.mock.calls[0][2];
    expect(config.allowSelfVote).toBe(true);
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./PhotoContestConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});

describe("validateAll — plugin rules 1.2–1.10", () => {
  it("returns no errors for a fully valid form", () => {
    expect(validateAll(validForm())).toEqual({});
  });

  it("requires the submission and voting windows when absent", () => {
    const errors = validateAll({
      ...validForm(),
      submissionWindow: { start: null, end: null },
      votingWindow: { start: null, end: null },
    });
    expect(errors["submissionWindow.start"]).toBe("Submission start is required.");
    expect(errors["submissionWindow.end"]).toBe("Submission end is required.");
    expect(errors["votingWindow.start"]).toBe("Voting start is required.");
    expect(errors["votingWindow.end"]).toBe("Voting end is required.");
  });

  it("rejects a submission window whose end is not after its start (1.2)", () => {
    const errors = validateAll({
      ...validForm(),
      submissionWindow: { start: dayjs("2025-01-05T09:00"), end: dayjs("2025-01-01T09:00") },
    });
    expect(errors["submissionWindow.end"]).toBe(
      "Submission end must be after submission start."
    );
  });

  it("rejects a voting window whose end is not after its start (1.3)", () => {
    const errors = validateAll({
      ...validForm(),
      votingWindow: { start: dayjs("2025-01-06T09:00"), end: dayjs("2025-01-02T09:00") },
    });
    expect(errors["votingWindow.end"]).toBe("Voting end must be after voting start.");
  });

  it("rejects a voting start earlier than the submission start (1.4)", () => {
    const errors = validateAll({
      ...validForm(),
      submissionWindow: { start: dayjs("2025-01-03T09:00"), end: dayjs("2025-01-10T09:00") },
      votingWindow: { start: dayjs("2025-01-01T09:00"), end: dayjs("2025-01-06T09:00") },
    });
    expect(errors["votingWindow.start"]).toBe(
      "Voting start must be at or after submission start."
    );
  });

  it("rejects an invalid moderation mode (1.5)", () => {
    const errors = validateAll({ ...validForm(), moderationMode: "nope" });
    expect(errors["moderationMode"]).toBe("Select a valid moderation mode.");
  });

  it("rejects an out-of-range submissions-per-attendee limit (1.6)", () => {
    expect(
      validateAll({ ...validForm(), submissionsPerAttendeeLimit: 0 })[
        "submissionsPerAttendeeLimit"
      ]
    ).toMatch(/between 1 and 100/);
    expect(
      validateAll({ ...validForm(), submissionsPerAttendeeLimit: 101 })[
        "submissionsPerAttendeeLimit"
      ]
    ).toMatch(/between 1 and 100/);
  });

  it("rejects an out-of-range votes-per-attendee limit (1.7)", () => {
    expect(
      validateAll({ ...validForm(), votesPerAttendeeLimit: 0 })["votesPerAttendeeLimit"]
    ).toBeDefined();
    expect(
      validateAll({ ...validForm(), votesPerAttendeeLimit: 1001 })["votesPerAttendeeLimit"]
    ).toBeDefined();
  });

  it("rejects an empty allowed file types list (1.8)", () => {
    const errors = validateAll({
      ...validForm(),
      allowedMediaConstraints: { allowedFileTypes: [], maxFileSize: 10485760 },
    });
    expect(errors["allowedMediaConstraints.allowedFileTypes"]).toBe(
      "Select at least one allowed image type."
    );
  });

  it("rejects allowed file types outside the permitted set (1.8)", () => {
    const errors = validateAll({
      ...validForm(),
      allowedMediaConstraints: { allowedFileTypes: ["image/gif"], maxFileSize: 10485760 },
    });
    expect(errors["allowedMediaConstraints.allowedFileTypes"]).toMatch(
      /JPEG, PNG, WebP, and HEIC/
    );
  });

  it("rejects a max file size outside the 1..26214400 byte bound (1.9)", () => {
    expect(
      validateAll({
        ...validForm(),
        allowedMediaConstraints: { allowedFileTypes: ["image/png"], maxFileSize: 0 },
      })["allowedMediaConstraints.maxFileSize"]
    ).toBeDefined();
    expect(
      validateAll({
        ...validForm(),
        allowedMediaConstraints: { allowedFileTypes: ["image/png"], maxFileSize: 26214401 },
      })["allowedMediaConstraints.maxFileSize"]
    ).toBeDefined();
  });

  it("rejects an out-of-range winner count (1.10)", () => {
    expect(validateAll({ ...validForm(), winnerCount: 0 })["winnerCount"]).toMatch(
      /between 1 and 100/
    );
    expect(validateAll({ ...validForm(), winnerCount: 101 })["winnerCount"]).toMatch(
      /between 1 and 100/
    );
  });

  it("rejects non-integer numeric fields", () => {
    const errors = validateAll({
      ...validForm(),
      submissionsPerAttendeeLimit: 2.5,
      winnerCount: 1.5,
    });
    expect(errors["submissionsPerAttendeeLimit"]).toBeDefined();
    expect(errors["winnerCount"]).toBeDefined();
  });
});
