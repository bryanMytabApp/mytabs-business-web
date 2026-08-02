import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock services
jest.mock("../../services/entitlementService", () => ({
  getMyServices: jest.fn(),
  deactivateService: jest.fn(),
}));

jest.mock("../../services/paymentService", () => ({
  getCustomerInvoices: jest.fn(),
}));

import AiAgentBilling from "./AiAgentBilling";
import { getMyServices, deactivateService } from "../../services/entitlementService";
import { getCustomerInvoices } from "../../services/paymentService";

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AiAgentBilling />
    </MemoryRouter>
  );

describe("AiAgentBilling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getMyServices.mockReturnValue(new Promise(() => {}));
    getCustomerInvoices.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows 'No active AI Agent subscription' when no tier is active", async () => {
    getMyServices.mockResolvedValue([]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("No active AI Agent subscription.")
      ).toBeInTheDocument();
    });
  });

  it("displays the current tier name and price", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active", usage: { tokensUsed: 500000 } },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/Pro/)).toBeInTheDocument();
    });
    expect(screen.getByText(/\$299\/mo/)).toBeInTheDocument();
  });

  it("shows token usage progress bar", async () => {
    getMyServices.mockResolvedValue([
      {
        id: "ai_agent_starter",
        status: "active",
        usage: { tokensUsed: 250000 },
      },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Token Usage")).toBeInTheDocument();
    });
    expect(screen.getByText("250K / 500K")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("shows next billing date when available", async () => {
    const nextDate = new Date("2025-02-15").toISOString();
    getMyServices.mockResolvedValue([
      {
        id: "ai_agent_pro",
        status: "active",
        usage: { tokensUsed: 0 },
        nextBillingDate: nextDate,
      },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Next Billing Date")).toBeInTheDocument();
    });
    // Date may render differently depending on timezone; just verify it contains "2025"
    expect(screen.getByText(/February \d+, 2025/)).toBeInTheDocument();
  });

  it("displays Cancel AI Agent button", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_enterprise", status: "active", usage: { tokensUsed: 0 } },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel AI Agent" })
      ).toBeInTheDocument();
    });
  });

  it("opens confirmation dialog when cancel is clicked", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active", usage: { tokensUsed: 0 } },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel AI Agent" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel AI Agent" }));

    expect(
      screen.getByText("Cancel AI Agent Subscription?")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirm Cancellation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep Subscription" })
    ).toBeInTheDocument();
  });

  it("calls deactivateService on confirm cancellation", async () => {
    deactivateService.mockResolvedValue({ success: true });
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active", usage: { tokensUsed: 0 } },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel AI Agent" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel AI Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));

    await waitFor(() => {
      expect(deactivateService).toHaveBeenCalledWith("ai_agent_pro");
    });
  });

  it("shows cancelled state after successful cancellation", async () => {
    deactivateService.mockResolvedValue({ success: true });
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active", usage: { tokensUsed: 0 } },
    ]);
    getCustomerInvoices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Cancel AI Agent" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel AI Agent" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm Cancellation" }));

    await waitFor(() => {
      expect(
        screen.getByText("Your AI Agent subscription has been cancelled.")
      ).toBeInTheDocument();
    });
  });

  it("displays invoices table when invoices exist", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active", usage: { tokensUsed: 100000 } },
    ]);
    getCustomerInvoices.mockResolvedValue([
      { id: "inv_1", date: 1700000000, amount_due: 29900, status: "paid" },
      { id: "inv_2", date: 1697400000, amount_due: 29900, status: "paid" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Invoice History")).toBeInTheDocument();
    });
    const amountCells = screen.getAllByText("$299.00");
    expect(amountCells.length).toBeGreaterThanOrEqual(1);
  });

  it("handles error from services gracefully", async () => {
    getMyServices.mockRejectedValue(new Error("Network failure"));
    getCustomerInvoices.mockRejectedValue(new Error("Network failure"));
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load billing information. Please try again.")
      ).toBeInTheDocument();
    });
  });
});
