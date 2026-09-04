// Feature: tabs-homepage-redesign — Task 5.6
//
// Smoke tests for each Homepage section component in
// `src/views/Marketing/sections/`. Each test asserts the component renders
// without crashing and shows its required literal content.
//
// Router-aware sections (they render react-router <Link>s) are wrapped in
// <MemoryRouter>: Hero, ProductsSection, PlatformSection, Segments, CtaBand.
//
// PricingSection is covered by task 5.7; CareersBand's property test is 5.8.
//
// _Requirements: 2.1, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2,
//  6.3, 7.1, 8.1, 9.1, 9.2, 12.1, 12.2_

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Hero, { HERO_HEADLINE } from "./Hero";
import StatBand from "./StatBand";
import ProductsSection from "./ProductsSection";
import PlatformSection from "./PlatformSection";
import ProofSection from "./ProofSection";
import RevenueEngines from "./RevenueEngines";
import Segments from "./Segments";
import Company from "./Company";
import CtaBand from "./CtaBand";

import { PRODUCT_SLUGS, productContent } from "../products/productContent";

/** Render a router-aware component inside a MemoryRouter. */
function renderWithRouter(ui) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Homepage section smoke tests", () => {
  describe("Hero", () => {
    it("renders without crashing and shows the exact headline (Req 2.1)", () => {
      renderWithRouter(<Hero />);
      expect(
        screen.getByText(HERO_HEADLINE)
      ).toBeInTheDocument();
    });
  });

  describe("StatBand", () => {
    it("renders the four stats with their values and labels (Req 3.1-3.4)", () => {
      render(<StatBand />);

      // City / region counts trace to config/urbanhtx-regions.json (65 cities
      // across 8 coverage regions).
      const expected = [
        ["7", "connected products"],
        ["5", "revenue engines"],
        ["65", "cities covered"],
        ["8", "regions nationwide"],
      ];

      expected.forEach(([value, label]) => {
        expect(screen.getByText(value)).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });
  });

  describe("ProductsSection", () => {
    it("renders the seven product names and the advertising card (Req 4.1, 4.2)", () => {
      renderWithRouter(<ProductsSection />);

      // The seven product names come from the shared content model.
      const productNames = PRODUCT_SLUGS.map(
        (slug) => productContent[slug].productName
      );
      expect(productNames).toHaveLength(7);

      productNames.forEach((name) => {
        // Use getAllByText: some names (e.g. "Market Intelligence") may also
        // appear inside descriptive copy on the card.
        expect(screen.getAllByText(name).length).toBeGreaterThan(0);
      });

      // Advertising / sponsorships / managed-experiences card (Req 4.2).
      expect(
        screen.getByText(/Advertising, sponsorships & managed experiences/i)
      ).toBeInTheDocument();
    });
  });

  describe("PlatformSection", () => {
    it("renders the three platforms and iOS/Android availability (Req 5.1-5.3)", () => {
      renderWithRouter(<PlatformSection />);

      expect(screen.getByText("Web dashboard")).toBeInTheDocument();
      expect(screen.getByText("Tabs mobile app")).toBeInTheDocument();
      expect(
        screen.getByText(/Available for iOS and Android/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Organizations console")).toBeInTheDocument();
    });
  });

  describe("ProofSection", () => {
    it("renders the two headline result metrics (Req 6.1-6.3)", () => {
      render(<ProofSection />);

      expect(
        screen.getByText("84.7% RSVP-to-attendance")
      ).toBeInTheDocument();
      expect(screen.getByText("$1,270 revenue")).toBeInTheDocument();
    });
  });

  describe("RevenueEngines", () => {
    it("renders the five engine names (Req 7.1)", () => {
      render(<RevenueEngines />);

      const engineNames = [
        "Subscriptions",
        "Ticketing",
        "Advertising",
        "Events & experiences",
        "Market Intelligence",
      ];

      engineNames.forEach((name) => {
        // Names may also appear inside descriptions; assert at least one match.
        expect(screen.getAllByText(name).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Segments", () => {
    it("renders the six segments (Req 8.1)", () => {
      renderWithRouter(<Segments />);

      const segmentNames = [
        "Promoters",
        "Venues",
        "Hospitality & nightlife",
        "Agencies",
        "Universities",
        "Tourism boards & cities",
      ];

      segmentNames.forEach((name) => {
        expect(screen.getAllByText(name).length).toBeGreaterThan(0);
      });
    });
  });

  describe("Company", () => {
    it("renders CEO and CTO leadership (Req 9.1, 9.2)", () => {
      render(<Company />);

      expect(screen.getByText("Bryan Dykes")).toBeInTheDocument();
      expect(screen.getByText("Michael Arnwine")).toBeInTheDocument();
      // Both leadership titles are present.
      expect(screen.getByText("CEO")).toBeInTheDocument();
      expect(screen.getByText("CTO")).toBeInTheDocument();
    });
  });

  describe("CtaBand", () => {
    it("renders a Join Tabs action (Req 12.1, 12.2)", () => {
      renderWithRouter(<CtaBand />);

      const talkToSales = screen.getByText("Join Tabs");
      expect(talkToSales).toBeInTheDocument();
      // It's an actionable link pointing at the contact target.
      expect(talkToSales.closest("a")).toHaveAttribute("href", "/register");
    });
  });
});
