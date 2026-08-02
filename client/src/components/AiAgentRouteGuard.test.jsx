import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mock the hook
jest.mock("../hooks/useAiAgentEntitlement", () => jest.fn());

import AiAgentRouteGuard from "./AiAgentRouteGuard";
import useAiAgentEntitlement from "../hooks/useAiAgentEntitlement";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const renderGuard = (children = <div>Protected Content</div>) =>
  render(
    <MemoryRouter>
      <AiAgentRouteGuard>{children}</AiAgentRouteGuard>
    </MemoryRouter>
  );

describe("AiAgentRouteGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner while checking entitlement", () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: false,
      tier: null,
      limits: null,
      isLoading: true,
      error: null,
    });

    renderGuard();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows error alert when entitlement check fails", () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: false,
      tier: null,
      limits: null,
      isLoading: false,
      error: new Error("Network failure"),
    });

    renderGuard();
    expect(screen.getByText(/unable to verify subscription status/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows subscribe CTA when no subscription exists", () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: false,
      tier: null,
      limits: null,
      isLoading: false,
      error: null,
    });

    renderGuard();
    expect(screen.getByText("AI Event Discovery Agents")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view plans & subscribe/i })).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("navigates to subscribe page when CTA is clicked", async () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: false,
      tier: null,
      limits: null,
      isLoading: false,
      error: null,
    });

    renderGuard();
    const button = screen.getByRole("button", { name: /view plans & subscribe/i });
    await userEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/ai-agents/subscribe");
  });

  it("shows renewal prompt when subscription is lapsed", () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: true,
      tier: "pro",
      limits: { sourcingAgents: 5, creationAgents: 15, tokenPool: 2000000 },
      isLoading: false,
      error: null,
    });

    renderGuard();
    expect(screen.getByText("Subscription Expired")).toBeInTheDocument();
    expect(screen.getByText(/agent operations are blocked/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /renew subscription/i })).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("navigates to subscribe page when renewal CTA is clicked", async () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: false,
      isLapsed: true,
      tier: "starter",
      limits: null,
      isLoading: false,
      error: null,
    });

    renderGuard();
    const button = screen.getByRole("button", { name: /renew subscription/i });
    await userEvent.click(button);
    expect(mockNavigate).toHaveBeenCalledWith("/admin/ai-agents/subscribe");
  });

  it("renders children when subscription is active", () => {
    useAiAgentEntitlement.mockReturnValue({
      hasSubscription: true,
      isLapsed: false,
      tier: "pro",
      limits: { sourcingAgents: 5, creationAgents: 15, tokenPool: 2000000 },
      isLoading: false,
      error: null,
    });

    renderGuard();
    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Subscribe")).not.toBeInTheDocument();
  });
});
