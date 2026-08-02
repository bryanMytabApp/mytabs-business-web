import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock services
jest.mock("../../services/entitlementService", () => ({
  getMyServices: jest.fn(),
}));

import AiAgentCheckoutSuccess from "./AiAgentCheckoutSuccess";
import { getMyServices } from "../../services/entitlementService";

const renderComponent = (searchParams = "") =>
  render(
    <MemoryRouter initialEntries={[`/checkout/success${searchParams}`]}>
      <AiAgentCheckoutSuccess />
    </MemoryRouter>
  );

describe("AiAgentCheckoutSuccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getMyServices.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders 'Subscription Active!' after loading", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Subscription Active!")).toBeInTheDocument();
    });
  });

  it("displays the active tier name", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_starter", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("AI Agent Starter Plan")).toBeInTheDocument();
    });
  });

  it("shows next steps with 'Create your first AI Sourcing Agent'", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_pro", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Next Steps")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Create your first AI Sourcing Agent")
    ).toBeInTheDocument();
  });

  it("shows 'Create Your First Agent' CTA button", async () => {
    getMyServices.mockResolvedValue([
      { id: "ai_agent_enterprise", status: "active" },
    ]);
    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Create Your First Agent" })
      ).toBeInTheDocument();
    });
  });

  it("handles case where no active AI service is found", async () => {
    getMyServices.mockResolvedValue([]);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Subscription Active!")).toBeInTheDocument();
    });
    // Tier name is not displayed when no service is found
    expect(screen.queryByText(/AI Agent .* Plan/)).not.toBeInTheDocument();
  });

  it("handles service fetch error gracefully", async () => {
    getMyServices.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Subscription Active!")).toBeInTheDocument();
    });
  });
});
