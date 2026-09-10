import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import LoyaltyConfig from "./LoyaltyConfig";
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
          element={<LoyaltyConfig />}
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

// Fill the single default reward with a valid label so the form validates.
// (The default rule's pointsValue of 100 is already valid; the default reward
// is unlimited with a valid pointCost — only the label is blank.)
function fillValidReward() {
  goToStep("2. Rewards Catalog");
  fireEvent.change(screen.getByLabelText("Reward Label"), {
    target: { value: "Free T-Shirt" },
  });
}

async function goToReview() {
  goToStep("4. Review & Save");
  await waitFor(() => {
    expect(screen.getByText("Save Configuration")).toBeInTheDocument();
  });
}

describe("LoyaltyConfig", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getInstance.mockResolvedValue({ data: {} });
    updateInstance.mockResolvedValue({ data: {} });
  });

  // 10.1 — renders default state without crashing.
  it("renders the config form in its default state without crashing", () => {
    const { container } = renderComponent();
    expect(container).toBeTruthy();
    expect(screen.getByText("Configure Loyalty & Rewards")).toBeInTheDocument();
    // One default earning rule editor is present (1..50 lower bound).
    expect(screen.getByTestId("rule-editor-0")).toBeInTheDocument();
  });

  // 10.2 — adding an Earning_Rule shows action-type / points-value / optional
  // earn-cap inputs.
  it("shows action-type, points-value, and optional earn-cap inputs for an earning rule", async () => {
    renderComponent();
    goToStep("1. Earning Rules");

    // The default rule already exposes the three inputs.
    expect(screen.getByLabelText("Action type for earning rule 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Points value for earning rule 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Earn cap for earning rule 1")).toBeInTheDocument();

    // Adding a rule exposes a second set of the same inputs.
    fireEvent.click(screen.getByRole("button", { name: /Add Earning Rule/i }));
    await waitFor(() => {
      expect(screen.getByTestId("rule-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Action type for earning rule 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Points value for earning rule 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Earn cap for earning rule 2")).toBeInTheDocument();
  });

  // 10.3 — adding a Reward shows label / point-cost / inventory inputs.
  it("shows label, point-cost, and inventory inputs for a reward", async () => {
    renderComponent();
    goToStep("2. Rewards Catalog");

    expect(screen.getByLabelText("Reward Label")).toBeInTheDocument();
    expect(screen.getByLabelText("Point cost for reward 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Inventory for reward 1")).toBeInTheDocument();

    // Adding a reward exposes a second set of the inputs.
    fireEvent.click(screen.getByRole("button", { name: /Add Reward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("reward-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Point cost for reward 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Inventory for reward 2")).toBeInTheDocument();
  });

  // 10.4 — adding a Membership_Tier shows name / threshold / benefit inputs, and
  // zero tiers are allowed by default.
  it("allows zero tiers by default and shows name/threshold/benefit inputs once a tier is added", async () => {
    renderComponent();
    goToStep("3. Membership Tiers");

    // Zero tiers is allowed — no tier editor is present initially.
    expect(screen.queryByTestId("tier-editor-0")).not.toBeInTheDocument();
    expect(screen.getByText("No membership tiers configured.")).toBeInTheDocument();

    // Adding a tier reveals the name / threshold / benefit inputs.
    fireEvent.click(screen.getByRole("button", { name: /Add Membership Tier/i }));
    await waitFor(() => {
      expect(screen.getByTestId("tier-editor-0")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Tier name for membership tier 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Tier threshold for membership tier 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Tier benefit for membership tier 1")).toBeInTheDocument();
  });

  // 10.5 — add/remove controls respect the count limits. At the 1-rule / 1-reward
  // minimum the remove control is disabled; adding enables it again.
  it("disables the remove control at the earning-rule minimum of 1", async () => {
    renderComponent();
    goToStep("1. Earning Rules");

    expect(screen.getByLabelText("Remove earning rule 1")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Add Earning Rule/i }));
    await waitFor(() => {
      expect(screen.getByTestId("rule-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove earning rule 1")).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText("Remove earning rule 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("rule-editor-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove earning rule 1")).toBeDisabled();
  });

  it("disables the remove control at the reward minimum of 1", async () => {
    renderComponent();
    goToStep("2. Rewards Catalog");

    expect(screen.getByLabelText("Remove reward 1")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Add Reward/i }));
    await waitFor(() => {
      expect(screen.getByTestId("reward-editor-1")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove reward 1")).not.toBeDisabled();

    fireEvent.click(screen.getByLabelText("Remove reward 2"));
    await waitFor(() => {
      expect(screen.queryByTestId("reward-editor-1")).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Remove reward 1")).toBeDisabled();
  });

  // 10.6 — setting a Reward's inventory to `finite` shows the Total_Quantity
  // input, and switching back to `unlimited` hides/disables it.
  it("shows the total-quantity input only when the reward inventory is finite", async () => {
    renderComponent();
    goToStep("2. Rewards Catalog");

    // Unlimited by default → the total-quantity control is hidden.
    expect(screen.queryByLabelText("Total quantity for reward 1")).not.toBeInTheDocument();

    await selectOption("Inventory for reward 1", "Finite (limited quantity)");
    await waitFor(() => {
      expect(screen.getByLabelText("Total quantity for reward 1")).toBeInTheDocument();
    });

    // Switching back to Unlimited hides it again.
    await selectOption("Inventory for reward 1", "Unlimited");
    await waitFor(() => {
      expect(screen.queryByLabelText("Total quantity for reward 1")).not.toBeInTheDocument();
    });
  });

  // 10.7 — saving invalid data shows field errors and does NOT call updateInstance.
  it("blocks save on invalid data and shows field errors", async () => {
    renderComponent();
    // Leave the default reward's label blank → invalid.
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(
        screen.getByText(matchText("Please fix the highlighted fields before saving."))
      ).toBeInTheDocument();
    });
    expect(updateInstance).not.toHaveBeenCalled();

    // Field-level error surfaces on the Rewards Catalog step.
    goToStep("2. Rewards Catalog");
    await waitFor(() => {
      expect(screen.getByText("A reward label is required.")).toBeInTheDocument();
    });
  });

  // 10.8 — saving valid data calls updateInstance (incl. accentColor) and redirects.
  it("saves valid data via updateInstance and redirects to the dashboard", async () => {
    renderComponent();
    fillValidReward();
    await goToReview();

    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const [eventId, experienceId, payload] = updateInstance.mock.calls[0];
    expect(eventId).toBe("evt1");
    expect(experienceId).toBe("exp1");

    // One default earning rule persisted with its action type and points value.
    expect(payload.config.earningRules).toHaveLength(1);
    const rule = payload.config.earningRules[0];
    expect(rule.actionType).toBe("attend-event");
    expect(rule.pointsValue).toBe(100);
    expect(typeof rule.ruleId).toBe("string");

    // One reward persisted; unlimited inventory is shaped as the string 'unlimited'.
    expect(payload.config.rewards).toHaveLength(1);
    const reward = payload.config.rewards[0];
    expect(reward.rewardLabel).toBe("Free T-Shirt");
    expect(reward.pointCost).toBe(100);
    expect(reward.inventory).toBe("unlimited");
    expect(typeof reward.rewardId).toBe("string");

    // Zero membership tiers → the key is omitted entirely.
    expect(payload.config.membershipTiers).toBeUndefined();
    // Theme color is persisted (defaults when unchanged).
    expect(typeof payload.config.accentColor).toBe("string");

    await waitFor(() => {
      expect(screen.getByText("Engagements Dashboard")).toBeInTheDocument();
    });
  });

  // 10.8 — a finite reward persists inventory as { totalQuantity }.
  it("persists a finite reward with its total quantity", async () => {
    renderComponent();
    fillValidReward();
    await selectOption("Inventory for reward 1", "Finite (limited quantity)");
    await waitFor(() => {
      expect(screen.getByLabelText("Total quantity for reward 1")).toBeInTheDocument();
    });

    await goToReview();
    fireEvent.click(screen.getByText("Save Configuration"));

    await waitFor(() => {
      expect(updateInstance).toHaveBeenCalledTimes(1);
    });
    const reward = updateInstance.mock.calls[0][2].config.rewards[0];
    expect(reward.inventory).toEqual({ totalQuantity: 100 });
  });

  it("renders a default export for lazy loading", async () => {
    const module = await import("./LoyaltyConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});
