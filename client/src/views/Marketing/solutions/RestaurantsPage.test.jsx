import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import RestaurantsPage from "./RestaurantsPage";
import usePlanData from "../hooks/usePlanData";

// The mini pricing cards must pull their price from the subscription API via
// usePlanData. Mock the hook so the smoke tests control the API state (success
// vs empty) without any real HTTP request.
jest.mock("../hooks/usePlanData");

// useDocumentMeta just sets document title/meta; stub it to keep the test focused.
jest.mock("../hooks/useDocumentMeta", () => () => {});

const renderPage = () =>
  render(
    <MemoryRouter>
      <RestaurantsPage />
    </MemoryRouter>
  );

describe("RestaurantsPage — mini pricing", () => {
  it("renders without crashing and shows the pricing section heading", () => {
    usePlanData.mockReturnValue({ status: "loading", plans: [], addons: [], reload: () => {} });
    renderPage();
    expect(screen.getByText("Where restaurants usually start.")).toBeInTheDocument();
  });

  it("shows LIVE prices from the subscription API (not the hardcoded fallback)", () => {
    usePlanData.mockReturnValue({
      status: "success",
      plans: [
        { name: "Starter", price: "$199", priceSuffix: "/mo", level: 1, popular: false },
        { name: "Growth", price: "$599", priceSuffix: "/mo", level: 2, popular: true },
      ],
      addons: [],
      reload: () => {},
    });
    renderPage();
    // API-driven amounts render...
    expect(screen.getByText("$199")).toBeInTheDocument();
    expect(screen.getByText("$599")).toBeInTheDocument();
    // ...and the hardcoded fallbacks do NOT.
    expect(screen.queryByText("$187")).not.toBeInTheDocument();
    expect(screen.queryByText("$563")).not.toBeInTheDocument();
  });

  it("falls back to reference prices when the API returns no plans", () => {
    usePlanData.mockReturnValue({ status: "empty", plans: [], addons: [], reload: () => {} });
    renderPage();
    expect(screen.getByText("$187")).toBeInTheDocument();
    expect(screen.getByText("$563")).toBeInTheDocument();
  });

  it("links the pricing buttons to the /pricing page", () => {
    usePlanData.mockReturnValue({ status: "empty", plans: [], addons: [], reload: () => {} });
    renderPage();
    const pricingLinks = screen
      .getAllByRole("link")
      .filter((a) => a.getAttribute("href") === "/pricing");
    // Both the hero "See pricing" and the pricing-section "See full pricing".
    expect(pricingLinks.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("See full pricing")).toBeInTheDocument();
  });
});
