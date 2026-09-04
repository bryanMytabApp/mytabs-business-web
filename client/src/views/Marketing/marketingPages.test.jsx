// Feature: tabs-homepage-redesign — Task 11.2
//
// Cross-cutting content-presence + alt-attribute property tests for the public
// Marketing_Site pages (Homepage, each bespoke Product_Page, each bespoke
// Use_Case_Page). These exercise the REAL page components end-to-end through a
// MemoryRouter + Routes harness that mirrors the production routes:
//
//   MarketingLayout (element route)
//     index                      → Homepage
//     products/:productSlug      → ProductPage
//     solutions/:useCaseSlug     → UseCasePage
//
// Only the network boundary is mocked: Homepage composes PricingSection, whose
// `usePlanData` hook calls `paymentService.getSystemSubscriptions`. We mock it
// to resolve an empty catalog ({ data: [] }) so the pricing fetch settles
// deterministically (no unhandled async / act warnings). No component source is
// modified — a failure here indicates a real defect.
//
// Properties covered (design.md Correctness Properties):
//   11 — Each marketing page sets a distinct title + meta description (17.1, 17.2, 22.2)
//   13 — Every image exposes an alt attribute (15.2)
//   14 — Every Product_Page presents its product content (20.2)
//   15 — Every Use_Case_Page presents its segment content (21.2)
//   16 — Every bespoke page offers Talk-to-sales and a path home (20.3, 21.3)
//
// The page sets are finite (1 Homepage, 7 products, 5 use cases), so we iterate
// the whole set; where a generator applies (slug choice), we run ≥100 iterations.
//
// _Requirements: 15.2, 17.1, 17.2, 20.2, 20.3, 21.2, 21.3, 22.2_

import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import fc from "fast-check";

// Mock the service PricingSection's usePlanData hook consumes so Homepage's
// async pricing fetch resolves deterministically to an empty catalog.
jest.mock("../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
}));

import { getSystemSubscriptions } from "../../services/paymentService";

import MarketingLayout from "./MarketingLayout";
import Homepage from "./Homepage";
import ProductPage from "./products/ProductPage";
import UseCasePage from "./solutions/UseCasePage";
import productContent, { PRODUCT_SLUGS } from "./products/productContent";
import { useCaseContent, useCaseSlugs } from "./solutions/useCaseContent";

// ─── Harness ────────────────────────────────────────────────────────────────

/**
 * Render a marketing page at `initialPath` through a router harness that mirrors
 * the production route shape: pages render inside `MarketingLayout` (Nav + Footer
 * + Outlet), with the Homepage at the index and the bespoke pages under their
 * parameterized routes.
 *
 * @param {string} initialPath e.g. "/", "/products/events", "/solutions/agencies"
 * @returns {import("@testing-library/react").RenderResult}
 */
const renderMarketingPage = (initialPath) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route element={<MarketingLayout />}>
          <Route index element={<Homepage />} />
          <Route path="products/:productSlug" element={<ProductPage />} />
          <Route path="solutions/:useCaseSlug" element={<UseCasePage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );

/** Read the current `<meta name="description">` content, or "" when absent. */
const currentMetaDescription = () => {
  const meta = document.querySelector('meta[name="description"]');
  return meta ? meta.getAttribute("content") || "" : "";
};

/**
 * The full ordered set of marketing pages under test: the Homepage plus every
 * bespoke product and use-case page. Each entry carries the URL and a stable
 * label for diagnostics.
 * @type {Array<{ path: string, label: string }>}
 */
const ALL_PAGES = [
  { path: "/", label: "homepage" },
  ...PRODUCT_SLUGS.map((slug) => ({
    path: `/products/${slug}`,
    label: `product:${slug}`,
  })),
  ...useCaseSlugs.map((slug) => ({
    path: `/solutions/${slug}`,
    label: `usecase:${slug}`,
  })),
];

beforeEach(() => {
  getSystemSubscriptions.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ─── Property 11 ──────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 11: Each marketing page sets a
// distinct title and meta description.
describe("Property 11: Each marketing page sets a distinct title + meta description", () => {
  it("gives every page a non-empty, distinct title and meta description", async () => {
    const titles = [];
    const descriptions = [];

    // Finite page set → iterate all pages. Titles/descriptions are applied in a
    // useEffect (useDocumentMeta) against a single shared document.title +
    // meta[name=description], so we capture each page's values after they settle
    // and before rendering the next page.
    for (const page of ALL_PAGES) {
      const { unmount } = renderMarketingPage(page.path);

      // useDocumentMeta writes title + description in an effect. Wait until this
      // page's title has been applied (non-empty) before capturing.
      await waitFor(() => {
        expect(document.title.length).toBeGreaterThan(0);
      });

      const title = document.title;
      const description = currentMetaDescription();

      expect(title.length).toBeGreaterThan(0);
      expect(description.length).toBeGreaterThan(0);

      titles.push(title);
      descriptions.push(description);

      unmount();
    }

    // Distinctness across the whole set (Req 17.1, 17.2, 22.2).
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});

// ─── Property 13 ──────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 13: Every image exposes an alt
// attribute (may be empty string for decorative images).
describe("Property 13: Every image exposes an alt attribute", () => {
  it("ensures every <img> on every marketing page defines an alt attribute", async () => {
    // Finite page set → iterate all pages. Current pages use CSS/role=img
    // placeholders rather than <img>, so this is trivially satisfied when no
    // <img> is present, but the check is kept to guard future regressions.
    for (const page of ALL_PAGES) {
      const { container, unmount } = renderMarketingPage(page.path);

      // Let effects/async settle so any conditionally rendered imagery mounts.
      await waitFor(() => {
        expect(document.title.length).toBeGreaterThan(0);
      });

      const images = container.querySelectorAll("img");
      images.forEach((img) => {
        // `alt` must be defined (empty string is allowed for decorative images).
        expect(img.hasAttribute("alt")).toBe(true);
      });

      unmount();
    }
  });
});

// ─── Property 14 ──────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 14: Every Product_Page presents its
// product content (product name + headline).
describe("Property 14: Every Product_Page presents its product content", () => {
  // Assertions are scoped to the page's own <main> landmark. The shared
  // Navigation_Bar and Footer (from MarketingLayout) also render product names
  // as links, so scoping to <main> isolates the page's authored content.
  it("renders productName and headline for each known product slug", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRODUCT_SLUGS), (slug) => {
        const product = productContent[slug];
        const { unmount } = renderMarketingPage(`/products/${slug}`);
        try {
          const main = screen.getByRole("main");
          // Product name (eyebrow) and headline (H1) both present in the page body.
          expect(within(main).getByText(product.productName)).toBeInTheDocument();
          expect(
            within(main).getByRole("heading", { level: 1, name: product.headline })
          ).toBeInTheDocument();
          // Not the not-found state.
          expect(
            within(main).queryByRole("heading", { level: 1, name: "Page not found" })
          ).not.toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  // Finite exhaustive pass so every product slug is covered at least once,
  // regardless of generator sampling.
  it.each(PRODUCT_SLUGS)(
    "presents product content for slug '%s'",
    (slug) => {
      const product = productContent[slug];
      const { unmount } = renderMarketingPage(`/products/${slug}`);
      try {
        const main = screen.getByRole("main");
        expect(within(main).getByText(product.productName)).toBeInTheDocument();
        expect(
          within(main).getByRole("heading", { level: 1, name: product.headline })
        ).toBeInTheDocument();
      } finally {
        unmount();
      }
    }
  );
});

// ─── Property 15 ──────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 15: Every Use_Case_Page presents its
// segment content (segment name, at least one problem, at least one relevant
// product).
describe("Property 15: Every Use_Case_Page presents its segment content", () => {
  // Assertions are scoped to the page's own <main>. The Navigation_Bar/Footer
  // render segment and product names as links, so <main> isolates the page's
  // authored segment content.
  it("renders segmentName, a problem, and a relevant product for each known use-case slug", () => {
    fc.assert(
      fc.property(fc.constantFrom(...useCaseSlugs), (slug) => {
        const content = useCaseContent[slug];
        const { unmount } = renderMarketingPage(`/solutions/${slug}`);
        try {
          const main = screen.getByRole("main");

          // Segment name appears in the H1 ("Tabs for {segmentName}").
          expect(
            within(main).getByRole("heading", {
              level: 1,
              name: `Tabs for ${content.segmentName}`,
            })
          ).toBeInTheDocument();

          // At least one problem must render (Req 21.2). Content guarantees ≥1.
          expect(content.problems.length).toBeGreaterThan(0);
          expect(within(main).getByText(content.problems[0])).toBeInTheDocument();

          // At least one relevant product must render (Req 21.2). ≥1 guaranteed.
          expect(content.relevantProducts.length).toBeGreaterThan(0);
          expect(
            within(main).getByText(content.relevantProducts[0])
          ).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  // Finite exhaustive pass across every use-case slug.
  it.each(useCaseSlugs)(
    "presents segment content for slug '%s'",
    (slug) => {
      const content = useCaseContent[slug];
      const { unmount } = renderMarketingPage(`/solutions/${slug}`);
      try {
        const main = screen.getByRole("main");
        expect(
          within(main).getByRole("heading", {
            level: 1,
            name: `Tabs for ${content.segmentName}`,
          })
        ).toBeInTheDocument();
        expect(within(main).getByText(content.problems[0])).toBeInTheDocument();
        expect(
          within(main).getByText(content.relevantProducts[0])
        ).toBeInTheDocument();
      } finally {
        unmount();
      }
    }
  );
});

// ─── Property 16 ──────────────────────────────────────────────────────────────
// Feature: tabs-homepage-redesign, Property 16: Every bespoke page (product +
// use-case) offers a Talk-to-sales affordance and a path home (a "Back to
// homepage" link to "/").
describe("Property 16: Every bespoke page offers Talk-to-sales and a path home", () => {
  const bespokePaths = [
    ...PRODUCT_SLUGS.map((slug) => `/products/${slug}`),
    ...useCaseSlugs.map((slug) => `/solutions/${slug}`),
  ];

  // Assertions are scoped to the page's own <main>. The Navigation_Bar also
  // renders a "Join Tabs" affordance (an in-page anchor), so scoping to
  // <main> asserts the bespoke PAGE itself offers both affordances (Req 20.3,
  // 21.3), independent of the shared shell.
  it("exposes Join Tabs and a Back to homepage (href '/') on every bespoke page", () => {
    fc.assert(
      fc.property(fc.constantFrom(...bespokePaths), (path) => {
        const { unmount } = renderMarketingPage(path);
        try {
          const main = screen.getByRole("main");

          // At least one "Join Tabs" affordance in the page body (Req 20.3,
          // 21.3). Hero and closing bands may both offer it, so use getAllBy.
          const talkToSales = within(main).getAllByRole("link", {
            name: "Join Tabs",
          });
          expect(talkToSales.length).toBeGreaterThan(0);

          // A path back home: at least one "Back to homepage" link → "/".
          const homeLinks = within(main).getAllByRole("link", {
            name: "Back to homepage",
          });
          expect(homeLinks.length).toBeGreaterThan(0);
          homeLinks.forEach((link) => {
            expect(link).toHaveAttribute("href", "/");
          });
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  // Finite exhaustive pass so every bespoke page is asserted at least once.
  it.each(bespokePaths)("offers Talk-to-sales and a path home on '%s'", (path) => {
    const { unmount } = renderMarketingPage(path);
    try {
      const main = screen.getByRole("main");
      expect(
        within(main).getAllByRole("link", { name: "Join Tabs" }).length
      ).toBeGreaterThan(0);
      const homeLinks = within(main).getAllByRole("link", {
        name: "Back to homepage",
      });
      expect(homeLinks.length).toBeGreaterThan(0);
      homeLinks.forEach((link) => expect(link).toHaveAttribute("href", "/"));
    } finally {
      unmount();
    }
  });
});
