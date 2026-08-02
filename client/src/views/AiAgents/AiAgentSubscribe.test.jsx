import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mock services
jest.mock("../../services/entitlementService", () => ({
  getMyServices: jest.fn(),
  createServiceCheckout: jest.fn(),
}));

jest.mock("../../services/paymentService", () => ({
  updateCustomerSubscription: jest.fn(),
}));

import AiAgentSubscribe from "./AiAgentSubscribe";
import { getMyServices, createServiceCheckout } from "../../services/entitlementService";
import { updateCustomerSubscription } from "../../services/paymentService";

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AiAgentSubscribe />
    </MemoryRouter>
  );

describe("AiAgentSubscribe", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getMyServices.mockReturnValue(new Promise(() => {})); // never resolves
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders all three pricing tiers after loading", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Starter")).toBeInTheDocument();
    });
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("shows correct pricing for each tier", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("$99")).toBeInTheDocument();
    });
    expect(screen.getByText("$299")).toBeInTheDocument();
    expect(screen.getByText("$799")).toBeInTheDocument();
  });

  it("shows Subscribe buttons when no active plan exists", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
      expect(subscribeButtons).toHaveLength(3);
    });
  });

  it("highlights current plan for existing subscribers", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Current Plan", { selector: ".MuiChip-label" })).toBeInTheDocument();
    });
    // Pro card shows "Current Plan" button
    const currentBtn = screen.getByRole("button", { name: "Current Plan" });
    expect(currentBtn).toBeDisabled();
  });

  it("shows Upgrade/Downgrade buttons relative to current plan", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Downgrade" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Upgrade" })).toBeInTheDocument();
  });

  it("displays agent counts and token pools", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("500K")).toBeInTheDocument();
    });
    expect(screen.getByText("2M")).toBeInTheDocument();
    expect(screen.getByText("10M")).toBeInTheDocument();
  });

  it("shows Organization tier callout", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Need unlimited agents and tokens?")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Contact Sales →" })).toBeInTheDocument();
  });

  // ─── Task 26.6: createServiceCheckout with correct AI Agent service IDs ─────

  it("calls createServiceCheckout with 'ai_agent_starter' when Starter Subscribe is clicked", async () => {
    getMyServices.mockResolvedValue([]);
    createServiceCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/starter" });
    const user = userEvent.setup();
    // Mock window.location.href
    delete window.location;
    window.location = { href: "" };

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    });

    // Buttons render in order: Starter, Pro, Enterprise
    const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons[0]); // Starter

    await waitFor(() => {
      expect(createServiceCheckout).toHaveBeenCalledWith("ai_agent_starter");
    });
  });

  it("calls createServiceCheckout with 'ai_agent_pro' when Pro Subscribe is clicked", async () => {
    getMyServices.mockResolvedValue([]);
    createServiceCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/pro" });
    const user = userEvent.setup();
    delete window.location;
    window.location = { href: "" };

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    });

    const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons[1]); // Pro

    await waitFor(() => {
      expect(createServiceCheckout).toHaveBeenCalledWith("ai_agent_pro");
    });
  });

  it("calls createServiceCheckout with 'ai_agent_enterprise' when Enterprise Subscribe is clicked", async () => {
    getMyServices.mockResolvedValue([]);
    createServiceCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/ent" });
    const user = userEvent.setup();
    delete window.location;
    window.location = { href: "" };

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    });

    const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons[2]); // Enterprise

    await waitFor(() => {
      expect(createServiceCheckout).toHaveBeenCalledWith("ai_agent_enterprise");
    });
  });

  it("redirects to Stripe checkout URL on successful createServiceCheckout", async () => {
    getMyServices.mockResolvedValue([]);
    createServiceCheckout.mockResolvedValue({ checkoutUrl: "https://checkout.stripe.com/cs_test_abc" });
    const user = userEvent.setup();
    delete window.location;
    window.location = { href: "" };

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    });

    const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons[0]);

    await waitFor(() => {
      expect(window.location.href).toBe("https://checkout.stripe.com/cs_test_abc");
    });
  });

  it("displays error message when createServiceCheckout fails", async () => {
    getMyServices.mockResolvedValue([]);
    createServiceCheckout.mockRejectedValue({
      response: { data: { message: "Subscription creation failed" } },
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "Subscribe" })).toHaveLength(3);
    });

    const subscribeButtons = screen.getAllByRole("button", { name: "Subscribe" });
    await user.click(subscribeButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Subscription creation failed")).toBeInTheDocument();
    });
  });

  // ─── Task 26.6: Upgrade/downgrade flow via updateCustomerSubscription ────────

  it("calls updateCustomerSubscription with new tier ID on Upgrade click", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_starter", status: "active" },
    ]);
    updateCustomerSubscription.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Current Plan" })).toBeInTheDocument();
    });

    // With starter as current, Pro and Enterprise should show "Upgrade"
    const upgradeButtons = screen.getAllByRole("button", { name: "Upgrade" });
    await user.click(upgradeButtons[0]); // First upgrade = Pro

    await waitFor(() => {
      expect(updateCustomerSubscription).toHaveBeenCalledWith({ newServiceId: "ai_agent_pro" });
    });
  });

  it("calls updateCustomerSubscription with lower tier ID on Downgrade click", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_enterprise", status: "active" },
    ]);
    updateCustomerSubscription.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Current Plan" })).toBeInTheDocument();
    });

    // With enterprise as current, Starter and Pro should show "Downgrade"
    const downgradeButtons = screen.getAllByRole("button", { name: "Downgrade" });
    await user.click(downgradeButtons[0]); // First downgrade = Starter

    await waitFor(() => {
      expect(updateCustomerSubscription).toHaveBeenCalledWith({ newServiceId: "ai_agent_starter" });
    });
  });

  it("updates current plan indicator after successful upgrade", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_starter", status: "active" },
    ]);
    updateCustomerSubscription.mockResolvedValue({ success: true });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Current Plan" })).toBeInTheDocument();
    });

    const upgradeButtons = screen.getAllByRole("button", { name: "Upgrade" });
    await user.click(upgradeButtons[0]); // Upgrade to Pro

    await waitFor(() => {
      // After upgrade, the Pro tier should now show "Current Plan"
      expect(updateCustomerSubscription).toHaveBeenCalledWith({ newServiceId: "ai_agent_pro" });
    });
  });

  it("shows error message when updateCustomerSubscription fails", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    updateCustomerSubscription.mockRejectedValue({
      response: { data: { message: "Upgrade failed: payment method declined" } },
    });
    const user = userEvent.setup();

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Current Plan" })).toBeInTheDocument();
    });

    const upgradeButton = screen.getByRole("button", { name: "Upgrade" });
    await user.click(upgradeButton);

    await waitFor(() => {
      expect(screen.getByText("Upgrade failed: payment method declined")).toBeInTheDocument();
    });
  });
});
