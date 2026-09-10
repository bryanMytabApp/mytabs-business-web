import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import dayjs from "dayjs";
import SocialWallConfig, { validateAll } from "./SocialWallConfig";
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
          element={<SocialWallConfig />}
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
const STEP_LABELS = ["Window & Moderation", "Content Rules & Media", "Review & Save"];
const goToStep = (index) => {
  const target = STEP_LABELS[index];
  const btn = screen
    .getAllByRole("button")
    .find((b) => (b.textContent || "").trim().replace(/^✓\s*/, "") === target);
  fireEvent.click(btn);
};
// The shell's footer Save button (last step) + its text.
const clickSave = () => fireEvent.click(screen.getByRole("button", { name: /Save Configuration/i }));

// Fill the post window with a valid ordering: start strictly before end.
function fillValidWindow() {
  goToStep(0);
  fireEvent.change(screen.getByLabelText("Post window start"), {
    target: { value: "2025-01-01T09:00" },
  });
  fireEvent.change(screen.getByLabelText("Post window end"), {
    target: { value: "2025-01-05T09:00" },
  });
}

// A fully-valid form object for direct validateAll unit tests.
const validForm = () => ({
  postWindow: { start: dayjs("2025-01-01T09:00"), end: dayjs("2025-01-05T09:00") },
  moderationMode: "pre_moderation",
  keywordFilter: { keywords: [] },
  allowPhotos: true,
  postRateLimit: 10,
  textLengthLimit: 280,
  allowedMediaConstraints: {
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSize: 10485760,
  },
  feedSortMode: "chronological",
});

describe("SocialWallConfig — render + interaction (Requirement 12)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 12.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", async () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Social Wall")).toBeInTheDocument();
    // getInstance is invoked on mount to load any existing config.
    await waitFor(() => {
      expect(getInstance).toHaveBeenCalledWith("evt1", "exp1");
    });
  });

  // 12.2 — shows the post-window, moderation, keyword, allow-photos, rate-limit,
  // text-length, media, and sort controls (across the stepped form).
  it("shows window, moderation, content-rule, keyword, and media controls", () => {
    renderComponent();

    // Step 0 — Window & Moderation.
    goToStep(0);
    expect(screen.getByLabelText("Post window start")).toBeInTheDocument();
    expect(screen.getByLabelText("Post window end")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-mode")).toBeInTheDocument();

    // Step 1 — Content Rules & Media.
    goToStep(1);
    expect(screen.getByTestId("post-rate-limit-input")).toBeInTheDocument();
    expect(screen.getByTestId("text-length-limit-input")).toBeInTheDocument();
    expect(screen.getByTestId("feed-sort-mode-input")).toBeInTheDocument();
    expect(screen.getByTestId("keyword-filter")).toBeInTheDocument();
    expect(screen.getByTestId("allow-photos-switch")).toBeInTheDocument();
    // Media constraints are visible while photos are allowed (the default).
    expect(screen.getByTestId("media-constraints")).toBeInTheDocument();
    expect(screen.getByTestId("allowed-file-types-input")).toBeInTheDocument();
    expect(screen.getByTestId("max-file-size-input")).toBeInTheDocument();
  });

  // 12.3 — moderation mode selector presents auto_approve, pre_moderation, AND
  // post_moderation.
  it("presents auto_approve, pre_moderation, and post_moderation moderation modes", () => {
    renderComponent();
    goToStep(0);
    expect(screen.getByTestId("moderation-mode-auto_approve")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-mode-pre_moderation")).toBeInTheDocument();
    expect(screen.getByTestId("moderation-mode-post_moderation")).toBeInTheDocument();

    // Default is pre_moderation; selecting auto_approve updates the choice.
    const autoRadio = within(screen.getByTestId("moderation-mode-auto_approve")).getByRole("radio");
    const preRadio = within(
      screen.getByTestId("moderation-mode-pre_moderation")
    ).getByRole("radio");
    const postRadio = within(
      screen.getByTestId("moderation-mode-post_moderation")
    ).getByRole("radio");
    expect(preRadio).toBeChecked();
    expect(autoRadio).not.toBeChecked();
    expect(postRadio).not.toBeChecked();

    fireEvent.click(autoRadio);
    expect(autoRadio).toBeChecked();
  });

  // 12.4 — toggling allowPhotos OFF hides the media-constraints controls; back
  // ON restores them.
  it("hides the media constraints when photos are turned off and restores them when on", () => {
    renderComponent();
    goToStep(1);

    // Media constraints present by default (photos allowed).
    expect(screen.getByTestId("media-constraints")).toBeInTheDocument();

    // Turn photos off → media constraints disappear.
    const photosSwitch = screen.getByTestId("allow-photos-switch");
    fireEvent.click(photosSwitch);
    expect(screen.queryByTestId("media-constraints")).not.toBeInTheDocument();

    // Turn photos back on → media constraints return.
    fireEvent.click(photosSwitch);
    expect(screen.getByTestId("media-constraints")).toBeInTheDocument();
  });

  // 12.5 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();

    // Default form has an empty post window → invalid. Also push a limit out of range.
    goToStep(1);
    fireEvent.change(screen.getByTestId("post-rate-limit-input"), { target: { value: "0" } });

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
      expect(screen.getByText("Post window start is required.")).toBeInTheDocument();
    });
    expect(screen.getByText("Post window end is required.")).toBeInTheDocument();

    goToStep(1);
    expect(
      screen.getByText(
        "Post rate limit must be an integer between 1 and 60."
      )
    ).toBeInTheDocument();
  });

  // 12.6 — saving valid data calls updateInstance once with the shaped config
  // and shows the confirmation.
  it("saves valid data via updateInstance with the shaped config and confirms", async () => {
    renderComponent();
    fillValidWindow();

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
    // Window persisted as ISO strings.
    expect(config.postWindow.start).toBe(dayjs("2025-01-01T09:00").toISOString());
    expect(config.postWindow.end).toBe(dayjs("2025-01-05T09:00").toISOString());
    // Defaults carried through unchanged.
    expect(config.moderationMode).toBe("pre_moderation");
    expect(config.feedSortMode).toBe("chronological");
    expect(config.postRateLimit).toBe(10);
    expect(config.textLengthLimit).toBe(280);
    expect(config.allowPhotos).toBe(true);
    expect(config.keywordFilter).toEqual({ keywords: [] });
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

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SocialWallConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});

describe("validateAll — plugin rules 1.2–1.10", () => {
  it("returns no errors for a fully valid form", () => {
    expect(validateAll(validForm())).toEqual({});
  });

  it("requires the post window start and end when absent", () => {
    const errors = validateAll({
      ...validForm(),
      postWindow: { start: null, end: null },
    });
    expect(errors["postWindow.start"]).toBe("Post window start is required.");
    expect(errors["postWindow.end"]).toBe("Post window end is required.");
  });

  it("rejects a post window whose end is not after its start (1.2)", () => {
    const errors = validateAll({
      ...validForm(),
      postWindow: { start: dayjs("2025-01-05T09:00"), end: dayjs("2025-01-01T09:00") },
    });
    expect(errors["postWindow.end"]).toBe("Post window end must be after its start.");
  });

  it("rejects an invalid moderation mode (1.3)", () => {
    const errors = validateAll({ ...validForm(), moderationMode: "nope" });
    expect(errors["moderationMode"]).toBe("Select a valid moderation mode.");
  });

  it("rejects an invalid feed sort mode (1.4)", () => {
    const errors = validateAll({ ...validForm(), feedSortMode: "nope" });
    expect(errors["feedSortMode"]).toBe("Select a valid feed sort mode.");
  });

  it("rejects an out-of-range post rate limit (1.5)", () => {
    expect(validateAll({ ...validForm(), postRateLimit: 0 })["postRateLimit"]).toMatch(
      /between 1 and 60/
    );
    expect(validateAll({ ...validForm(), postRateLimit: 61 })["postRateLimit"]).toMatch(
      /between 1 and 60/
    );
  });

  it("rejects an out-of-range text length limit (1.6)", () => {
    expect(validateAll({ ...validForm(), textLengthLimit: 0 })["textLengthLimit"]).toBeDefined();
    expect(
      validateAll({ ...validForm(), textLengthLimit: 1001 })["textLengthLimit"]
    ).toBeDefined();
  });

  it("rejects a non-boolean allow-photos flag (1.7)", () => {
    const errors = validateAll({ ...validForm(), allowPhotos: "yes" });
    expect(errors["allowPhotos"]).toBe("Allow-photos must be on or off.");
  });

  it("rejects an empty allowed file types list when photos allowed (1.8)", () => {
    const errors = validateAll({
      ...validForm(),
      allowPhotos: true,
      allowedMediaConstraints: { allowedFileTypes: [], maxFileSize: 10485760 },
    });
    expect(errors["allowedMediaConstraints.allowedFileTypes"]).toBe(
      "Select at least one allowed image type."
    );
  });

  it("rejects allowed file types outside the permitted set (1.8)", () => {
    const errors = validateAll({
      ...validForm(),
      allowPhotos: true,
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
        allowPhotos: true,
        allowedMediaConstraints: { allowedFileTypes: ["image/png"], maxFileSize: 0 },
      })["allowedMediaConstraints.maxFileSize"]
    ).toBeDefined();
    expect(
      validateAll({
        ...validForm(),
        allowPhotos: true,
        allowedMediaConstraints: { allowedFileTypes: ["image/png"], maxFileSize: 26214401 },
      })["allowedMediaConstraints.maxFileSize"]
    ).toBeDefined();
  });

  it("skips media constraints validation when photos are not allowed", () => {
    const errors = validateAll({
      ...validForm(),
      allowPhotos: false,
      allowedMediaConstraints: { allowedFileTypes: [], maxFileSize: 0 },
    });
    expect(errors["allowedMediaConstraints.allowedFileTypes"]).toBeUndefined();
    expect(errors["allowedMediaConstraints.maxFileSize"]).toBeUndefined();
  });

  it("rejects keyword terms that are empty when keywords are provided (1.10)", () => {
    const errors = validateAll({
      ...validForm(),
      keywordFilter: { keywords: ["spam", "   "] },
    });
    expect(errors["keywordFilter.keywords"]).toBe("Keyword terms must be non-empty text.");
  });

  it("accepts an empty keyword list (filter disabled)", () => {
    const errors = validateAll({ ...validForm(), keywordFilter: { keywords: [] } });
    expect(errors["keywordFilter.keywords"]).toBeUndefined();
  });

  it("rejects non-integer numeric fields", () => {
    const errors = validateAll({
      ...validForm(),
      postRateLimit: 2.5,
      textLengthLimit: 1.5,
    });
    expect(errors["postRateLimit"]).toBeDefined();
    expect(errors["textLengthLimit"]).toBeDefined();
  });
});
