import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CouponConfig from "./CouponConfig";
import { getInstance, updateInstance } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, so mocking after the
// import statements keeps them lint-clean (import/first) while still applying.
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
          element={<CouponConfig />}
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

// Fill the single default offer with valid values so the form validates.
function fillValidOffer() {
  goToStep("1. Coupon Offers");
  fireEvent.change(screen.getByLabelText("Offer Title"), {
    target: { value: "20% Off Any Order" },
  });
  fireEvent.change(screen.getByLabelText("Vendor Name"), {
    target: { value: "Smokehouse BBQ" },
  });
  fireEvent.change(screen.getByLabelText("Benefit Descriptor"), {
    target: { value: "20% OFF" },
  });
  fireEvent.change(screen.getByLabelText("Claim start for offer 1"), {
    target: { value: "2025-01-01T12:00" },
  });
  fireEvent.change(screen.getByLabelText("Claim end for offer 1"), {
    target: { value: "2025-01-01T20:00" },
  });
  fireEvent.change(screen.getByLabelText("Redemption expiry for offer 1"), {
    target: { value: "2025-01-04T20:00" },
  });
}

async function goToReview() {
  goToStep("2. Review & Save");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("CouponConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 9.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Digital Coupons")).toBeInTheDocument();
    // One default offer editor is present (1..50 lower bound).
    expect(screen.getByTestId("offer-editor-0")).toBeInTheDocument();
  });

  // 9.2 — an offer shows title/description/vendor/benefit/inventory/claim-limit/
  // window/redemption-method inputs.
  it("shows title, description, vendor, benefit, inventory, claim-limit, window, and redemption-method inputs", () => {
    renderComponent();
    goToStep("1. Coupon Offers");

    expect(screen.getByLabelText("Offer Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
    expect(screen.getByLabelText("Vendor Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Benefit Descriptor")).toBeInTheDocument();
    expect(screen.getByLabelText("Inventory for offer 1")).toBeInTheDocument();
    // Finite by default → total quantity control shown.
    expect(screen.getByLabelText("Total quantity for offer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Per-attendee claim limit for offer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Claim start for offer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Claim end for offer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Redemption expiry for offer 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Redemption method for offer 1")).toBeInTheDocument();
  });

  // 9.3 — add/remove offer respects the 1-50 count limit.
  it("respects the offer minimum of 1 when removing and adds up to more offers", async () => {
    renderComponent();
    goToStep("1. Coupon Offers");

    // At the 1-offer minimum, remove is disabled.
    expect(screen.getByLabelText("Remove offer 1")).toBeDisabled();

    // Add a second offer → removal becomes available.
    fireEvent.click(screen.getByRole("button", { name: /Add Coupon Offer/i }));
    await waitFor(() => {
      expect(screen.getByTestId("offer-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove offer 1")).not.toBeDisabled();

    // Remove it back down to one → remove disabled again.
    fireEvent.click(screen.getByLabelText("Remove offer 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("offer-editor-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove offer 1")).toBeDisabled();
  });

  // 9.4 — setting inventory to unlimited hides/disables the total-quantity input.
  it("hides the total-quantity input when inventory is unlimited", async () => {
    renderComponent();
    goToStep("1. Coupon Offers");

    // Finite by default → the total quantity control is present.
    expect(screen.getByLabelText("Total quantity for offer 1")).toBeInTheDocument();

    await selectOption("Inventory for offer 1", "Unlimited");

    await waitFor(() => {
      expect(screen.queryByLabelText("Total quantity for offer 1")).not.toBeInTheDocument();
    });
  });

  // 9.5 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave the default offer blank (no title/vendor/benefit/window) → invalid.
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level errors surface on the Coupon Offers step.
    goToStep("1. Coupon Offers");
    await waitFor(() => {
      expect(screen.getByText("An offer title is required.")).toBeInTheDocument();
    });
    expect(screen.getByText("A benefit descriptor is required.")).toBeInTheDocument();
    expect(screen.getByText("A vendor name is required.")).toBeInTheDocument();
  });

  // 9.5 — a window-ordering violation (expiry before claim end) is rejected.
  it("rejects a redemption expiry earlier than the claim end", async () => {
    renderComponent();
    fillValidOffer();
    // Push the expiry before the claim end.
    fireEvent.change(screen.getByLabelText("Redemption expiry for offer 1"), {
      target: { value: "2025-01-01T10:00" },
    });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    goToStep("1. Coupon Offers");
    await waitFor(() => {
      expect(
        screen.getByText("Redemption expiry must be at or after claim end.")
      ).toBeInTheDocument();
    });
  });

  // 9.6 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidOffer();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");
    expect(payload.config.offers).toHaveLength(1);
    const offer = payload.config.offers[0];
    expect(offer.title).toBe("20% Off Any Order");
    expect(offer.vendorName).toBe("Smokehouse BBQ");
    expect(offer.benefitDescriptor).toBe("20% OFF");
    // Finite inventory is shaped as { mode:'finite', totalQuantity }.
    expect(offer.inventory).toEqual({ mode: "finite", totalQuantity: 100 });
    expect(offer.perAttendeeClaimLimit).toBe(1);
    expect(offer.redemptionMethod).toBe("single-use-code");
    expect(typeof offer.offerId).toBe("string");
    expect(offer.offerId.length).toBeGreaterThan(0);
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 9.6 — an unlimited offer persists inventory as { mode:'unlimited' } with no quantity.
  it("persists an unlimited offer without a total quantity", async () => {
    renderComponent();
    fillValidOffer();
    await selectOption("Inventory for offer 1", "Unlimited");
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const offer = updateInstance.mock.calls[0][2].config.offers[0];
    expect(offer.inventory).toEqual({ mode: "unlimited" });
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./CouponConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
