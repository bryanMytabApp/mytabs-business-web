import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

jest.mock("../utils/resolveAccountPlanLevel", () => ({
  resolveAccountPlanLevel: jest.fn(),
}));
jest.mock("../utils/authUtils", () => ({
  isSuperAdmin: jest.fn(() => false),
}));

import PlanLevelRouteGuard from "./PlanLevelRouteGuard";
import { resolveAccountPlanLevel } from "../utils/resolveAccountPlanLevel";
import { isSuperAdmin } from "../utils/authUtils";

const renderGuard = (minLevel = 2) =>
  render(
    <MemoryRouter initialEntries={["/admin/experiences"]}>
      <Routes>
        <Route
          path="/admin/experiences"
          element={
            <PlanLevelRouteGuard minLevel={minLevel} featureName="Engagements">
              <div>Engagements Content</div>
            </PlanLevelRouteGuard>
          }
        />
        <Route path="/admin/home" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );

describe("PlanLevelRouteGuard (Engagements = Growth+, level >= 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    isSuperAdmin.mockReturnValue(false);
    sessionStorage.clear();
  });

  it("ALLOWS a Growth (level 2) account — incl. exempt resolved via the shared resolver", async () => {
    resolveAccountPlanLevel.mockResolvedValue(2);
    renderGuard(2);
    await waitFor(() => expect(screen.getByText("Engagements Content")).toBeInTheDocument());
  });

  it("ALLOWS Pro (3) and Enterprise (4)", async () => {
    resolveAccountPlanLevel.mockResolvedValue(3);
    renderGuard(2);
    await waitFor(() => expect(screen.getByText("Engagements Content")).toBeInTheDocument());
  });

  it("BLOCKS a Starter (level 1) account with an upgrade prompt", async () => {
    resolveAccountPlanLevel.mockResolvedValue(1);
    renderGuard(2);
    await waitFor(() => expect(screen.getByText(/upgrade required/i)).toBeInTheDocument());
    expect(screen.queryByText("Engagements Content")).not.toBeInTheDocument();
  });

  it("allows a super admin regardless of level", async () => {
    isSuperAdmin.mockReturnValue(true);
    resolveAccountPlanLevel.mockResolvedValue(1);
    renderGuard(2);
    await waitFor(() => expect(screen.getByText("Engagements Content")).toBeInTheDocument());
  });

  it("fails closed (blocks) when the resolver errors", async () => {
    resolveAccountPlanLevel.mockRejectedValue(new Error("net"));
    renderGuard(2);
    await waitFor(() => expect(screen.getByText(/upgrade required/i)).toBeInTheDocument());
  });

  it("blocks when level is unknown (0)", async () => {
    resolveAccountPlanLevel.mockResolvedValue(0);
    renderGuard(2);
    await waitFor(() => expect(screen.getByText(/upgrade required/i)).toBeInTheDocument());
  });
});
