import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("../utils/resolveAccountEntitlement", () => ({
  resolveAccountEntitlement: jest.fn(),
}));
jest.mock("../utils/authUtils", () => ({
  getCurrentUserId: jest.fn(() => "user-1"),
  isSuperAdmin: jest.fn(() => false),
}));

import SubscriptionGuard from "./SubscriptionGuard";
import { resolveAccountEntitlement } from "../utils/resolveAccountEntitlement";
import { getCurrentUserId, isSuperAdmin } from "../utils/authUtils";

const renderGuard = () =>
  render(
    <MemoryRouter initialEntries={["/admin/home"]}>
      <Routes>
        <Route
          path="/admin/home"
          element={
            <SubscriptionGuard>
              <div>Protected App</div>
            </SubscriptionGuard>
          }
        />
        <Route path="/subscription" element={<div>Subscription Page</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("SubscriptionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    isSuperAdmin.mockReturnValue(false);
    getCurrentUserId.mockReturnValue("user-1");
    resolveAccountEntitlement.mockResolvedValue(false);
  });

  it("shows a spinner while the entitlement check is in flight", () => {
    resolveAccountEntitlement.mockReturnValue(new Promise(() => {})); // never resolves
    renderGuard();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });

  it("REDIRECTS to /subscription when the account is not entitled", async () => {
    resolveAccountEntitlement.mockResolvedValue(false);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Subscription Page")).toBeInTheDocument());
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });

  it("allows a super admin straight through (no entitlement lookup needed)", async () => {
    isSuperAdmin.mockReturnValue(true);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
    expect(resolveAccountEntitlement).not.toHaveBeenCalled();
  });

  it("allows an entitled account (paid | org | active/exempt, resolved by the shared resolver)", async () => {
    resolveAccountEntitlement.mockResolvedValue(true);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("REDIRECTS (fails closed) when the entitlement resolver throws", async () => {
    resolveAccountEntitlement.mockRejectedValue(new Error("net"));
    renderGuard();
    await waitFor(() => expect(screen.getByText("Subscription Page")).toBeInTheDocument());
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });
});
