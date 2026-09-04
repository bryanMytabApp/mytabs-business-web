// Feature: tabs-homepage-redesign
//
// Smoke tests for the bespoke ProductPage (task 8.6).
//
// ProductPage reads the `:productSlug` route param, resolves it against
// `productContent`, and renders that product's authored content. Unknown slugs
// delegate to the in-layout `MarketingNotFound` page (Req 19.10).
//
// These tests wrap the component in a `<MemoryRouter>` + `<Routes>`/`<Route>`
// harness so `useParams()` resolves `:productSlug` from the URL, matching the
// production route (`/products/:productSlug`).
//
// _Requirements: 20.1, 20.2, 21.1, 21.2_

import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ProductPage from "./ProductPage";
import productContent, { PRODUCT_SLUGS } from "./productContent";

/**
 * Render ProductPage under the same route shape used in production so
 * `useParams().productSlug` resolves from the URL.
 *
 * @param {string} slug value substituted for `:productSlug`
 * @returns {import("@testing-library/react").RenderResult}
 */
const renderProductPage = (slug) =>
  render(
    <MemoryRouter initialEntries={[`/products/${slug}`]}>
      <Routes>
        <Route path="/products/:productSlug" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("ProductPage", () => {
  describe("known product slugs", () => {
    it.each(PRODUCT_SLUGS)(
      "renders the product's name and headline for slug '%s' without crashing",
      (slug) => {
        const product = productContent[slug];
        renderProductPage(slug);

        // The product name appears in the eyebrow, and the headline is the H1.
        expect(screen.getByText(product.productName)).toBeInTheDocument();
        expect(
          screen.getByRole("heading", { level: 1, name: product.headline })
        ).toBeInTheDocument();

        // Not the not-found state.
        expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
      }
    );

    it("exposes a Join Tabs action and a path back to the homepage", () => {
      renderProductPage(PRODUCT_SLUGS[0]);

      // The page now has a header "Join Tabs" and a closing-CTA "Join Tabs".
      const joinLinks = screen.getAllByRole("link", { name: "Join Tabs" });
      expect(joinLinks.length).toBeGreaterThanOrEqual(1);
      joinLinks.forEach((l) => expect(l).toHaveAttribute("href", "/register"));
      expect(
        screen.getByRole("link", { name: "Back to homepage" })
      ).toHaveAttribute("href", "/");
    });
  });

  describe("unknown product slug", () => {
    it("renders the MarketingNotFound content for an unknown slug", () => {
      renderProductPage("does-not-exist");

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
