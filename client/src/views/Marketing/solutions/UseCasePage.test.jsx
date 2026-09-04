// Feature: tabs-homepage-redesign
//
// Smoke tests for the bespoke UseCasePage (task 8.6).
//
// UseCasePage reads the `:useCaseSlug` route param, resolves it against
// `useCaseContent`, and renders that segment's authored content. Unknown slugs
// delegate to the in-layout `MarketingNotFound` page (Req 19.10).
//
// These tests wrap the component in a `<MemoryRouter>` + `<Routes>`/`<Route>`
// harness so `useParams()` resolves `:useCaseSlug` from the URL, matching the
// production route (`/solutions/:useCaseSlug`).
//
// _Requirements: 20.1, 20.2, 21.1, 21.2_

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import UseCasePage from "./UseCasePage";
import { useCaseContent, useCaseSlugs } from "./useCaseContent";

/**
 * Render UseCasePage under the same route shape used in production so
 * `useParams().useCaseSlug` resolves from the URL.
 *
 * @param {string} slug value substituted for `:useCaseSlug`
 * @returns {import("@testing-library/react").RenderResult}
 */
const renderUseCasePage = (slug) =>
  render(
    <MemoryRouter initialEntries={[`/solutions/${slug}`]}>
      <Routes>
        <Route path="/solutions/:useCaseSlug" element={<UseCasePage />} />
      </Routes>
    </MemoryRouter>
  );

describe("UseCasePage", () => {
  describe("known use-case slugs", () => {
    it.each(useCaseSlugs)(
      "renders the segment name in the page title for slug '%s' without crashing",
      (slug) => {
        const { segmentName } = useCaseContent[slug];
        renderUseCasePage(slug);

        // Title renders as "Tabs for {segmentName}".
        expect(
          screen.getByRole("heading", {
            level: 1,
            name: `Tabs for ${segmentName}`,
          })
        ).toBeInTheDocument();

        // Not the not-found state.
        expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
      }
    );

    it("exposes a Join Tabs action and a path back to the homepage", () => {
      renderUseCasePage(useCaseSlugs[0]);

      // Hero + closing bands both render a "Join Tabs" link.
      expect(
        screen.getAllByRole("link", { name: "Join Tabs" }).length
      ).toBeGreaterThan(0);
      const homeLinks = screen.getAllByRole("link", {
        name: "Back to homepage",
      });
      expect(homeLinks.length).toBeGreaterThan(0);
      homeLinks.forEach((link) => expect(link).toHaveAttribute("href", "/"));
    });
  });

  describe("unknown use-case slug", () => {
    it("renders the MarketingNotFound content for an unknown slug", () => {
      renderUseCasePage("does-not-exist");

      expect(
        screen.getByRole("heading", { level: 1, name: "Page not found" })
      ).toBeInTheDocument();
      // Not-found still offers a path back to the homepage.
      expect(
        screen.getByRole("link", { name: "Back to homepage" })
      ).toHaveAttribute("href", "/");
    });
  });
});
