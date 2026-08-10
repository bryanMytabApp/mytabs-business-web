import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// Mock the organization service
jest.mock("../services/organizationService", () => ({
  getMyOrganizations: jest.fn(),
}));

import AiAgentRouteGuard from "./AiAgentRouteGuard";
import { getMyOrganizations } from "../services/organizationService";

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

  it("shows loading spinner while checking org membership", () => {
    getMyOrganizations.mockReturnValue(new Promise(() => {})); // never resolves
    renderGuard();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("shows access restricted when user is not in UrbanHTX org", async () => {
    getMyOrganizations.mockResolvedValue({
      data: [{ name: "CommuniTSU", id: "org-123" }],
    });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(
      screen.getByText(/only available to UrbanHTX/i)
    ).toBeInTheDocument();
  });

  it("shows access restricted when user has no organizations", async () => {
    getMyOrganizations.mockResolvedValue({ data: [] });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("navigates to home when Go to Home button is clicked", async () => {
    getMyOrganizations.mockResolvedValue({ data: [] });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /go to home/i })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole("button", { name: /go to home/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/admin/home");
  });

  it("renders children when user belongs to UrbanHTX org", async () => {
    getMyOrganizations.mockResolvedValue({
      data: [{ name: "UrbanHTX", id: "org-urbanhtx" }],
    });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByText("Access Restricted")).not.toBeInTheDocument();
  });

  it("renders children when user belongs to a platformOwned org", async () => {
    getMyOrganizations.mockResolvedValue({
      data: [{ name: "Some Other Name", id: "org-123", platformOwned: true }],
    });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("shows access restricted when org API call fails", async () => {
    getMyOrganizations.mockRejectedValue(new Error("Network error"));

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    });
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("grants access when organizations are in nested data.organizations format", async () => {
    getMyOrganizations.mockResolvedValue({
      data: { organizations: [{ name: "UrbanHTX", id: "org-urbanhtx" }] },
    });

    renderGuard();
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
