// Feature: tabs-homepage-redesign — Task 6.2
//
// Smoke test for the composed `Homepage` (default export). Verifies the page
// renders without crashing, exposes a single <main> landmark, surfaces
// representative section content, and applies its document title on mount.
//
// Homepage composes PricingSection, which consumes `usePlanData` →
// `paymentService.getSystemSubscriptions`. We mock that service to resolve to
// an empty catalog ({ data: [] }) so the pricing fetch settles cleanly (no
// unhandled async / act warnings). Sections render react-router <Link>s, so we
// wrap in <MemoryRouter>.
//
// This exercises the REAL Homepage and its section components end-to-end; only
// the network boundary is mocked. The component source is NOT modified — a
// failure here indicates a real defect.
//
// _Requirements: 15.1_

import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Mock the service the embedded PricingSection's hook consumes so its async
// fetch resolves deterministically to an empty catalog.
jest.mock("../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
}));

import { getSystemSubscriptions } from "../../services/paymentService";
import Homepage, { HOMEPAGE_TITLE } from "./Homepage";
import { HERO_HEADLINE } from "./sections/Hero";

const renderHomepage = () =>
  render(
    <MemoryRouter>
      <Homepage />
    </MemoryRouter>
  );

beforeEach(() => {
  getSystemSubscriptions.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("Homepage smoke test", () => {
  it("renders without crashing and exposes a single <main> landmark (Req 15.1)", async () => {
    renderHomepage();

    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main).toHaveClass("marketing-homepage");

  });

  it("renders representative section content (hero headline + proof metric)", async () => {
    renderHomepage();

    // Hero headline (Req 2.1) confirms the Hero section composed in.
    expect(
      screen.getByText(HERO_HEADLINE)
    ).toBeInTheDocument();

    // Proof metric (Req 6.3) confirms a later section composed in too.
    expect(screen.getByText("$1,270 revenue")).toBeInTheDocument();
  });

  it("sets document.title to HOMEPAGE_TITLE on mount (Req 17.1)", async () => {
    renderHomepage();

    await waitFor(() => {
      expect(document.title).toBe(HOMEPAGE_TITLE);
    });
  });
});
