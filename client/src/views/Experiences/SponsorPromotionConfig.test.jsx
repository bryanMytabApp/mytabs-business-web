import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SponsorPromotionConfig, { normalizeSponsors, validateAll } from "./SponsorPromotionConfig";
import { getInstance, updateInstance, participate } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(() => Promise.resolve({ data: {} })),
  updateInstance: jest.fn(() => Promise.resolve({ data: {} })),
  participate: jest.fn(() => Promise.resolve({ data: {} })),
}));

// Two sponsors managed through Sponsor Management, returned on the instance.
const SPONSORS = [
  { sponsorId: "spn-1", displayName: "Acme Co" },
  { sponsorId: "spn-2", displayName: "Globex" },
];

// getInstance shape used across the suite: instance carries a sponsors array.
const instanceWithSponsors = (extra = {}) => ({
  data: { data: { sponsors: SPONSORS, ...extra } },
});

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/config"
          element={<SponsorPromotionConfig />}
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

// Set an MUI Select (rendered as a listbox) to the option with the given text.
async function selectOption(labelText, optionText) {
  fireEvent.mouseDown(screen.getByLabelText(labelText));
  const listbox = await screen.findByRole("listbox");
  fireEvent.click(within(listbox).getByText(optionText));
}

// Wait until the first promotion editor is on screen (getInstance has resolved).
async function waitForPromotionsLoaded() {
  goToStep("1. Promotions");
  await screen.findByTestId("promotion-editor-0");
}

// Fill the single default promotion with valid values so the form validates.
async function fillValidPromotion() {
  await waitForPromotionsLoaded();
  await selectOption("Sponsor for promotion 1", "Acme Co");
  fireEvent.change(screen.getByLabelText("Headline"), {
    target: { value: "Big Sponsor Offer" },
  });
  fireEvent.change(screen.getByLabelText("CTA label for promotion 1"), {
    target: { value: "Learn More" },
  });
  fireEvent.change(screen.getByLabelText("CTA target value for promotion 1"), {
    target: { value: "https://example.com/offer" },
  });
  fireEvent.change(screen.getByLabelText("Display start for promotion 1"), {
    target: { value: "2025-01-01T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Display end for promotion 1"), {
    target: { value: "2025-01-01T20:00" },
  });
  // A creative must be uploaded for a promotion to validate — inject one directly
  // through the file input's media-upload path.
  await uploadCreative(0);
}

async function goToReview() {
  goToStep("2. Review & Save");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

// Drive the creative upload flow for the promotion at `idx`: fires a file change,
// which requests an upload ticket via participate() then PUTs to the presigned URL.
async function uploadCreative(idx, { type = "image/png", size = 1024 } = {}) {
  const file = new File([new Uint8Array(size)], "creative.png", { type });
  // File.size is derived from the blob parts above; ensure it reflects `size`.
  Object.defineProperty(file, "size", { value: size });
  const input = screen.getByLabelText(`Creative for promotion ${idx + 1}`);
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => {
    expect(screen.getByAltText("Creative preview")).toBeInTheDocument();
  });
}

describe("SponsorPromotionConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue(instanceWithSponsors());
    updateInstance.mockResolvedValue({ data: {} });
    participate.mockResolvedValue({
      data: {
        data: {
          presignedUrl: "https://uploads.example.com/put/creative.png",
          creativeAssetUrl: "https://cdn.example.com/creative.png",
        },
      },
    });
    // Presigned PUT upload.
    global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
    // Object URL for the local preview.
    global.URL.createObjectURL = jest.fn(() => "blob:preview");
  });

  // 10.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", async () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Sponsor Promotions")).toBeInTheDocument();
    // One default promotion editor is present once sponsors load (1..50 lower bound).
    await screen.findByTestId("promotion-editor-0");
  });

  // 10.2 — a promotion editor shows linked-sponsor, creative, headline, description,
  // CTA, placement, display-window, and goal inputs.
  it("shows linked-sponsor, creative, headline, description, CTA, placement, window, and goal inputs", async () => {
    renderComponent();
    await waitForPromotionsLoaded();

    // Linked sponsor selector.
    expect(screen.getByLabelText("Sponsor for promotion 1")).toBeInTheDocument();
    // Creative upload input.
    expect(screen.getByLabelText("Creative for promotion 1")).toBeInTheDocument();
    // Headline + description.
    expect(screen.getByLabelText("Headline")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    // Call to action group.
    expect(screen.getByLabelText("CTA label for promotion 1")).toBeInTheDocument();
    expect(screen.getByLabelText("CTA target type for promotion 1")).toBeInTheDocument();
    expect(screen.getByLabelText("CTA target value for promotion 1")).toBeInTheDocument();
    // Placement + display window.
    expect(screen.getByLabelText("Placement for promotion 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Display start for promotion 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Display end for promotion 1")).toBeInTheDocument();
    // Optional goals.
    expect(screen.getByLabelText("Impression goal for promotion 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Engagement goal for promotion 1")).toBeInTheDocument();
  });

  // 10.3 — the sponsor selector lists sponsors from the loaded instance and setting
  // it updates the promotion's sponsorId (surfaced through the saved payload).
  it("lists sponsors from the loaded instance and setting one updates sponsorId", async () => {
    renderComponent();
    await waitForPromotionsLoaded();

    // Open the sponsor Select — both loaded sponsors are listed.
    fireEvent.mouseDown(screen.getByLabelText("Sponsor for promotion 1"));
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getByText("Acme Co")).toBeInTheDocument();
    expect(within(listbox).getByText("Globex")).toBeInTheDocument();

    // Choosing Globex sets the promotion's sponsorId; complete the rest and save
    // to observe the selected id in the persisted payload.
    fireEvent.click(within(listbox).getByText("Globex"));
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "Globex Promo" },
    });
    fireEvent.change(screen.getByLabelText("CTA label for promotion 1"), {
      target: { value: "Get Offer" },
    });
    fireEvent.change(screen.getByLabelText("CTA target value for promotion 1"), {
      target: { value: "https://globex.example.com" },
    });
    fireEvent.change(screen.getByLabelText("Display start for promotion 1"), {
      target: { value: "2025-01-01T12:00" },
    });
    fireEvent.change(screen.getByLabelText("Display end for promotion 1"), {
      target: { value: "2025-01-01T20:00" },
    });
    await uploadCreative(0);

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const payload = updateInstance.mock.calls[0][2];
    expect(payload.config.promotions[0].sponsorId).toBe("spn-2");
  });

  // 10.4 — with no sponsors defined, the screen prompts to create one through
  // Sponsor Management and blocks adding a promotion.
  it("prompts to create a sponsor and blocks adding a promotion when none exist", async () => {
    getInstance.mockResolvedValue({ data: { data: { sponsors: [] } } });
    renderComponent();
    goToStep("1. Promotions");

    await waitFor(() => {
      expect(
        screen.getByText(/Add a sponsor in Sponsor Management before creating promotions/i)
      ).toBeInTheDocument();
    });
    // The route-across control to Sponsor Management is present.
    expect(screen.getByRole("button", { name: /Manage Sponsors/i })).toBeInTheDocument();
    // No promotion editor and no "Add Promotion" control are rendered.
    expect(screen.queryByTestId("promotion-editor-0")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add Promotion/i })).not.toBeInTheDocument();
  });

  // 10.5 — add/remove promotion controls respect the 1-50 count limit.
  it("respects the promotion minimum of 1 when removing and adds more promotions", async () => {
    renderComponent();
    await waitForPromotionsLoaded();

    // At the 1-promotion minimum, remove is disabled.
    expect(screen.getByLabelText("Remove promotion 1")).toBeDisabled();

    // Add a second promotion → removal becomes available.
    fireEvent.click(screen.getByRole("button", { name: /Add Promotion/i }));
    await waitFor(() => {
      expect(screen.getByTestId("promotion-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove promotion 1")).not.toBeDisabled();

    // Remove it back down to one → remove disabled again.
    fireEvent.click(screen.getByLabelText("Remove promotion 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("promotion-editor-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove promotion 1")).toBeDisabled();
  });

  // 10.6 — uploading a creative uses the media-upload path (participate request_upload
  // + presigned PUT) and shows a preview.
  it("uploads a creative through the media-upload path and shows a preview", async () => {
    renderComponent();
    await waitForPromotionsLoaded();

    // A sponsor must be selected before an upload can be requested.
    await selectOption("Sponsor for promotion 1", "Acme Co");
    await uploadCreative(0);

    // The upload ticket was requested through participate() with request_upload.
    await waitFor(() => {
      expect(participate).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, body] = participate.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(body.submissionData.action).toBe("request_upload");
    expect(body.submissionData.sponsorId).toBe("spn-1");
    expect(body.submissionData.declaredType).toBe("image/png");

    // The presigned URL was PUT with the raw file.
    expect(global.fetch).toHaveBeenCalledWith(
      "https://uploads.example.com/put/creative.png",
      expect.objectContaining({ method: "PUT" })
    );

    // A preview of the uploaded creative is shown.
    expect(screen.getByAltText("Creative preview")).toBeInTheDocument();
  });

  // 10.7 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    await waitForPromotionsLoaded();
    // Leave the default promotion blank (no sponsor/headline/creative/CTA/window).
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Promotions step.
    goToStep("1. Promotions");
    await waitFor(() => {
      expect(screen.getByText("Select a sponsor for this promotion.")).toBeInTheDocument();
    });
    expect(screen.getByText("A headline is required.")).toBeInTheDocument();
    expect(screen.getByText("Upload a creative asset.")).toBeInTheDocument();
    expect(screen.getByText("A call-to-action label is required.")).toBeInTheDocument();
  });

  // 10.8 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    await fillValidPromotion();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.promotions).toHaveLength(1);
    const promo = payload.config.promotions[0];
    expect(promo.sponsorId).toBe("spn-1");
    expect(promo.headline).toBe("Big Sponsor Offer");
    expect(promo.cta.label).toBe("Learn More");
    expect(promo.cta.targetType).toBe("external-link");
    expect(promo.cta.targetValue).toBe("https://example.com/offer");
    expect(promo.placement).toBe("feed-card");
    expect(promo.creativeAssetUrl).toBe("https://cdn.example.com/creative.png");
    expect(typeof promo.promotionId).toBe("string");
    expect(promo.promotionId.length).toBeGreaterThan(0);
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./SponsorPromotionConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  // ── Exported helper unit tests ──────────────────────────────────────────────

  describe("normalizeSponsors", () => {
    it("de-duplicates by sponsorId across sponsors, sponsorBranding, and sponsor", () => {
      const result = normalizeSponsors({
        sponsors: [{ sponsorId: "a", displayName: "Alpha" }],
        sponsorBranding: { sponsorId: "a", displayName: "Alpha dup" },
        sponsor: { sponsorId: "b", name: "Beta" },
      });
      expect(result).toEqual([
        { sponsorId: "a", displayName: "Alpha" },
        { sponsorId: "b", displayName: "Beta" },
      ]);
    });

    it("returns an empty array when no sponsors are present", () => {
      expect(normalizeSponsors({})).toEqual([]);
      expect(normalizeSponsors(null)).toEqual([]);
    });
  });

  describe("validateAll", () => {
    const validPromotion = () => ({
      promotionId: "promo-1",
      sponsorId: "spn-1",
      creativeAssetUrl: "https://cdn.example.com/creative.png",
      creativeMediaType: "image/png",
      creativeSizeBytes: 2048,
      headline: "Headline",
      description: "",
      cta: { label: "Learn More", targetType: "external-link", targetValue: "https://x.example.com" },
      placement: "feed-card",
      displayWindow: { start: "2025-01-01T12:00", end: "2025-01-01T20:00" },
      impressionGoal: "",
      engagementGoal: "",
    });

    it("returns no errors for a fully valid promotion", () => {
      const errors = validateAll({ promotions: [validPromotion()] }, new Set(["spn-1"]));
      expect(errors).toEqual({});
    });

    it("flags an unknown sponsor id", () => {
      const errors = validateAll({ promotions: [validPromotion()] }, new Set(["other"]));
      expect(errors["promotions[0].sponsorId"]).toMatch(/Unknown sponsor/);
    });

    it("rejects an engagement goal greater than the impression goal", () => {
      const promo = { ...validPromotion(), impressionGoal: 100, engagementGoal: 200 };
      const errors = validateAll({ promotions: [promo] }, new Set(["spn-1"]));
      expect(errors["promotions[0].engagementGoal"]).toMatch(/cannot exceed the impression goal/);
    });

    it("rejects a display end that is not later than the start", () => {
      const promo = {
        ...validPromotion(),
        displayWindow: { start: "2025-01-01T20:00", end: "2025-01-01T12:00" },
      };
      const errors = validateAll({ promotions: [promo] }, new Set(["spn-1"]));
      expect(errors["promotions[0].displayWindow.end"]).toMatch(/later than start/);
    });
  });
});
