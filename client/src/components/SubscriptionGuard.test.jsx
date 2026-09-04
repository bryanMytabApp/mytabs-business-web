import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("../services/paymentService", () => ({
  getCustomerSubscription: jest.fn(),
  getUserPremiumSubscription: jest.fn(),
}));
jest.mock("../services/organizationService", () => ({
  getMyOrganizations: jest.fn(),
}));
jest.mock("../utils/authUtils", () => ({
  getCurrentUserId: jest.fn(() => "user-1"),
  isSuperAdmin: jest.fn(() => false),
}));

import SubscriptionGuard from "./SubscriptionGuard";
import { getCustomerSubscription, getUserPremiumSubscription } from "../services/paymentService";
import { getMyOrganizations } from "../services/organizationService";
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

// Default: no access anywhere.
const denyAll = () => {
  isSuperAdmin.mockReturnValue(false);
  getCurrentUserId.mockReturnValue("user-1");
  getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: false, priceId: null } });
  getMyOrganizations.mockResolvedValue({ data: [] });
  getUserPremiumSubscription.mockResolvedValue({ data: null });
};

describe("SubscriptionGuard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    denyAll();
  });

  it("shows a spinner while the checks are in flight", () => {
    getCustomerSubscription.mockReturnValue(new Promise(() => {})); // never resolves
    renderGuard();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });

  it("REDIRECTS to /subscription when there is no subscription, org, or exempt row", async () => {
    renderGuard();
    await waitFor(() => expect(screen.getByText("Subscription Page")).toBeInTheDocument());
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });

  it("allows a super admin straight through", async () => {
    isSuperAdmin.mockReturnValue(true);
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("allows an account WITH a live Stripe subscription", async () => {
    getCustomerSubscription.mockResolvedValue({ data: { hasSubscription: true, priceId: "price_1" } });
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("allows an ORG member (rides the org plan)", async () => {
    getMyOrganizations.mockResolvedValue({ data: [{ id: "org-1", name: "Urban HTX" }] });
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("allows an EXEMPT account (billingMode='exempt' DynamoDB row, no Stripe sub)", async () => {
    getUserPremiumSubscription.mockResolvedValue({
      data: { isActive: true, billingMode: "exempt", planId: "2026-09-01Enterprise" },
    });
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("allows an account with an active (paid) DynamoDB subscription row", async () => {
    getUserPremiumSubscription.mockResolvedValue({
      data: { isActive: true, billingMode: "paid", planId: "2026-09-01Growth" },
    });
    renderGuard();
    await waitFor(() => expect(screen.getByText("Protected App")).toBeInTheDocument());
  });

  it("REDIRECTS when every check errors (fails closed)", async () => {
    getCustomerSubscription.mockRejectedValue(new Error("net"));
    getMyOrganizations.mockRejectedValue(new Error("net"));
    getUserPremiumSubscription.mockRejectedValue(new Error("net"));
    renderGuard();
    await waitFor(() => expect(screen.getByText("Subscription Page")).toBeInTheDocument());
    expect(screen.queryByText("Protected App")).not.toBeInTheDocument();
  });
});
