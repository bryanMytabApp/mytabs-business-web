// Feature: tabs-homepage-redesign
//
// Smoke + accessibility tests for the marketing Footer.
//
// Covers:
//   - Renders the five link columns: Product, Solutions, Platform, Company,
//     Resources (Req 13.1).
//   - Renders social links (Req 13.2).
//   - Renders legal links (Req 13.3).
//   - Renders the exact copyright text (Req 13.4).
//
// _Requirements: 13.1, 13.2, 13.3, 13.4_

import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Footer, { COPYRIGHT_TEXT } from "./Footer";

/** Render Footer inside a router so its internal `Link`s resolve. */
function renderFooter() {
  return render(
    <MemoryRouter>
      <Footer />
    </MemoryRouter>
  );
}

describe("Footer", () => {
  it("renders the footer landmark", () => {
    renderFooter();
    expect(
      screen.getByRole("contentinfo", { name: "Site footer" })
    ).toBeInTheDocument();
  });

  it("renders the five required link columns as headings", () => {
    renderFooter();
    ["Product", "Solutions", "Platform", "Company", "Resources"].forEach(
      (title) => {
        expect(
          screen.getByRole("heading", { name: title })
        ).toBeInTheDocument();
      }
    );
  });

  it("renders the social media links", () => {
    renderFooter();
    const social = screen.getByRole("navigation", { name: "Social media" });
    ["Instagram", "Facebook"].forEach((label) => {
      expect(within(social).getByRole("link", { name: label })).toBeInTheDocument();
    });
  });

  it("renders the legal links", () => {
    renderFooter();
    const legal = screen.getByRole("navigation", { name: "Legal" });
    expect(
      within(legal).getByRole("link", { name: "Privacy Policy" })
    ).toHaveAttribute("href", "https://www.mytabs.app/privacy");
    expect(
      within(legal).getByRole("link", { name: "Terms of Service" })
    ).toHaveAttribute("href", "https://www.mytabs.app/terms");
  });

  it("exports and renders the exact copyright text", () => {
    expect(COPYRIGHT_TEXT).toBe("© 2026 My Tabs LLC. Houston, Texas.");
    renderFooter();
    expect(screen.getByText(COPYRIGHT_TEXT)).toBeInTheDocument();
  });
});
