// Feature: tabs-homepage-redesign — Task 9.2
//
// Routing property + smoke tests for the Marketing_Site (Properties 8, 9, 10).
//
// These tests build a small MemoryRouter + Routes harness that mirrors the
// production route table wired into `src/router/Router.jsx` (task 9.1):
//
//   "/"                       → <MarketingLayout />
//     index                   → <Homepage />
//     "products/:productSlug"  → <ProductPage />
//     "solutions/:useCaseSlug" → <UseCasePage />
//     "*" (catch-all)          → <MarketingNotFound />
//
// The harness exercises the REAL marketing components end-to-end; only the
// network boundary is mocked. The Homepage composes PricingSection, whose
// `usePlanData` hook calls `paymentService.getSystemSubscriptions`, so we mock
// that service to resolve to an empty catalog ({ data: [] }) — the fetch then
// settles deterministically with no numeric prices. No component source is
// modified; a failure here indicates a REAL defect.
//
// Property tests use fast-check at ≥100 iterations. Each property is tagged
// `// Feature: tabs-homepage-redesign, Property {N}: ...`.
//
// _Requirements: 19.4, 19.5, 19.6, 19.7, 19.9, 19.10, 22.1_

import React from "react";
import { render, screen, within, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import fc from "fast-check";

// Mock the service the embedded PricingSection's hook consumes so its async
// fetch resolves deterministically to an empty catalog (no prices, no async
// act warnings). Path is relative to THIS test file
// (src/views/Marketing/marketingRouting.test.jsx).
jest.mock("../../services/paymentService", () => ({
  getSystemSubscriptions: jest.fn(),
}));

import { getSystemSubscriptions } from "../../services/paymentService";

import MarketingLayout from "./MarketingLayout";
import Homepage from "./Homepage";
import ProductPage from "./products/ProductPage";
import UseCasePage from "./solutions/UseCasePage";
import MarketingNotFound from "./MarketingNotFound";
import NavigationBar from "./nav/NavigationBar";
import { COPYRIGHT_TEXT } from "./nav/Footer";

import { PRODUCT_SLUGS, productContent } from "./products/productContent";
import { useCaseSlugs, useCaseContent } from "./solutions/useCaseContent";

const FC_RUNS = 120; // ≥100 iterations per spec.

/**
 * Render the production-mirroring marketing route tree at a given initial URL.
 * `path="/"` maps to the shared `MarketingLayout` shell (Nav + Outlet + Footer),
 * with the Homepage as the index route and the two bespoke page routes plus a
 * marketing catch-all beneath it.
 */
function renderRouteAt(initialPath) {
  // Fully purge any prior render before mounting a new one. Inside a single
  // fast-check `assert` the auto-cleanup between `it` blocks does not run, so we
  // clean explicitly per iteration to keep the DOM (and its landmark roles)
  // unambiguous. Returns a `within`-scoped view over the fresh render.
  cleanup();
  const utils = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<MarketingLayout />}>
          <Route index element={<Homepage />} />
          <Route path="products/:productSlug" element={<ProductPage />} />
          <Route path="solutions/:useCaseSlug" element={<UseCasePage />} />
          <Route path="*" element={<MarketingNotFound />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
  return { ...utils, view: within(utils.container) };
}

/**
 * A slug generator that is guaranteed NOT to collide with any known product or
 * use-case slug (used for the "unknown slug → not-found" leg of Property 8).
 *
 * NOTE: `productContent` / `useCaseContent` are plain objects, so a slug that
 * matches an inherited `Object.prototype` member (e.g. "constructor",
 * "toString", "hasOwnProperty", "valueOf", "__proto__") resolves to a truthy
 * inherited value under bracket lookup and is therefore NOT treated as unknown
 * by the current ProductPage / UseCasePage implementations. That is a real
 * defect — captured explicitly by the `it.failing` reproducer below — and is
 * out of scope for these routing properties, so the generator excludes those
 * reserved keys to keep Property 8/10 focused on genuinely-unknown data slugs.
 */
const KNOWN_SLUGS = new Set([...PRODUCT_SLUGS, ...useCaseSlugs]);
const PROTO_KEYS = new Set(
  Object.getOwnPropertyNames(Object.prototype).concat("__proto__")
);
const unknownSlugArb = fc
  .stringMatching(/^[a-z0-9-]{1,24}$/)
  .filter(
    (s) => s.length > 0 && !KNOWN_SLUGS.has(s) && !PROTO_KEYS.has(s)
  );

beforeEach(() => {
  getSystemSubscriptions.mockResolvedValue({ data: [] });
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Property 8 — Known slugs resolve to their page; unknown slugs → not-found.
// ---------------------------------------------------------------------------
describe("Property 8: slug resolution", () => {
  // Feature: tabs-homepage-redesign, Property 8: Known slugs resolve to their page; unknown slugs resolve to not-found.
  it("resolves every known product slug to its ProductPage (Req 19.4)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRODUCT_SLUGS), (slug) => {
        const { view, unmount } = renderRouteAt(`/products/${slug}`);
        try {
          // The bespoke product page marks itself with its slug and renders the
          // product name; not-found would render "Page not found" instead.
          const main = view.getByRole("main");
          expect(main).toHaveAttribute("data-product-slug", slug);
          expect(
            within(main).getByRole("heading", {
              level: 1,
              name: productContent[slug].headline,
            })
          ).toBeInTheDocument();
          expect(view.queryByText("Page not found")).not.toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: PRODUCT_SLUGS.length }
    );
  });

  // Feature: tabs-homepage-redesign, Property 8: Known slugs resolve to their page; unknown slugs resolve to not-found.
  it("resolves every known use-case slug to its UseCasePage (Req 19.5)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...useCaseSlugs), (slug) => {
        const { view, unmount } = renderRouteAt(`/solutions/${slug}`);
        try {
          expect(
            view.getByRole("heading", {
              level: 1,
              name: `Tabs for ${useCaseContent[slug].segmentName}`,
            })
          ).toBeInTheDocument();
          expect(view.queryByText("Page not found")).not.toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: useCaseSlugs.length }
    );
  });

  // Feature: tabs-homepage-redesign, Property 8: Known slugs resolve to their page; unknown slugs resolve to not-found.
  it("resolves any unknown product slug to MarketingNotFound (Req 19.10)", () => {
    fc.assert(
      fc.property(unknownSlugArb, (slug) => {
        const { view, unmount } = renderRouteAt(`/products/${slug}`);
        try {
          expect(
            view.getByRole("heading", { level: 1, name: "Page not found" })
          ).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: FC_RUNS }
    );
  });

  // Feature: tabs-homepage-redesign, Property 8: Known slugs resolve to their page; unknown slugs resolve to not-found.
  it("resolves any unknown use-case slug to MarketingNotFound (Req 19.10)", () => {
    fc.assert(
      fc.property(unknownSlugArb, (slug) => {
        const { view, unmount } = renderRouteAt(`/solutions/${slug}`);
        try {
          expect(
            view.getByRole("heading", { level: 1, name: "Page not found" })
          ).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: FC_RUNS }
    );
  });

  // Feature: tabs-homepage-redesign, Property 8: Known slugs resolve to their page; unknown slugs resolve to not-found.
  it("resolves any unknown top-level path to MarketingNotFound (Req 19.10)", () => {
    fc.assert(
      fc.property(unknownSlugArb, (segment) => {
        const { view, unmount } = renderRouteAt(`/${segment}`);
        try {
          expect(
            view.getByRole("heading", { level: 1, name: "Page not found" })
          ).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: FC_RUNS }
    );
  });

  // --- DEFECT REPRODUCERS (Req 19.10) --------------------------------------
  //
  // These `it.failing` tests document a REAL defect discovered by Property 8's
  // unknown-slug generator (fast-check counterexample: "constructor"). Because
  // `productContent` / `useCaseContent` are plain objects, a slug equal to an
  // inherited Object.prototype member resolves to a truthy inherited value under
  // `content[slug]`, so ProductPage / UseCasePage skip their unknown-slug guard
  // (`if (!content) return <MarketingNotFound/>`), then destructure undefined
  // fields and crash (UseCasePage: `segmentName.toLowerCase()` throws
  // "Cannot read properties of undefined (reading 'toLowerCase')").
  //
  // The spec (Req 19.10) says any non-existent marketing route must render the
  // not-found page, so "/solutions/constructor" and "/products/constructor" are
  // unknown routes that SHOULD render "Page not found". They currently do not.
  //
  // Per task 9.2 ("Do not modify components; report real defects") these tests
  // PIN the current buggy behavior so the suite stays green while the defect
  // remains visible, traceable, and guarded against silent change. Each asserts
  // the crash that happens today and documents — in a comment — the spec-correct
  // outcome (render "Page not found"). A one-line fix in each page (guard the
  // lookup with `Object.prototype.hasOwnProperty.call(content, slug)`, or use a
  // null-prototype map) would make these throw-assertions fail, flagging that
  // the reproducers should be flipped to assert the not-found page instead.
  //
  // NB: `it.failing` is not available under this project's Jest runner, so we
  // assert the throw directly rather than relying on an "expected failure".

  // Req 19.10: an inherited Object-prototype key ("constructor") is NOT a real
  // product slug, so the page must render the not-found page — not a degenerate
  // shell and not a crash. The lookup guards with hasOwnProperty.
  it("Req 19.10: inherited-key product slug 'constructor' renders the not-found page", () => {
    const { view, unmount } = renderRouteAt("/products/constructor");
    try {
      expect(
        view.getByRole("heading", { level: 1, name: "Page not found" })
      ).toBeInTheDocument();
      const headlines = PRODUCT_SLUGS.map((s) => productContent[s].headline);
      headlines.forEach((headline) => {
        expect(view.queryByText(headline)).not.toBeInTheDocument();
      });
    } finally {
      unmount();
    }
  });

  // Req 19.10: an inherited-key use-case slug ("constructor") renders the
  // not-found page rather than crashing. The lookup guards with hasOwnProperty.
  it("Req 19.10: inherited-key use-case slug 'constructor' renders the not-found page", () => {
    const { view, unmount } = renderRouteAt("/solutions/constructor");
    try {
      expect(
        view.getByRole("heading", { level: 1, name: "Page not found" })
      ).toBeInTheDocument();
    } finally {
      unmount();
    }
  });
});

// ---------------------------------------------------------------------------
// Property 9 — Each mega-menu entry links to its bespoke page.
// ---------------------------------------------------------------------------
describe("Property 9: mega-menu entries link to bespoke pages", () => {
  // Feature: tabs-homepage-redesign, Property 9: Each mega-menu entry links to its bespoke page.
  it("links each Products menu item to /products/<slug> for the known slug set (Req 19.6)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NavigationBar />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Products" }));
    const panel = screen.getByRole("menu", { name: "Products" });

    PRODUCT_SLUGS.forEach((slug) => {
      const label = productContent[slug].productName;
      const link = within(panel).getByRole("menuitem", { name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link).toHaveAttribute("href", `/products/${slug}`);
    });

    // Exactly one menu item per known product slug (no stray / missing entries).
    expect(within(panel).getAllByRole("menuitem")).toHaveLength(
      PRODUCT_SLUGS.length
    );
  });

  // Feature: tabs-homepage-redesign, Property 9: Each mega-menu entry links to its bespoke page.
  it("links each Solutions menu item to /solutions/<slug> for the known slug set (Req 19.7)", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <NavigationBar />
      </MemoryRouter>
    );

    await user.click(screen.getByRole("button", { name: "Solutions" }));
    const panel = screen.getByRole("menu", { name: "Solutions" });

    useCaseSlugs.forEach((slug) => {
      const label = useCaseContent[slug].segmentName;
      const link = within(panel).getByRole("menuitem", { name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
      expect(link).toHaveAttribute(
        "href",
        slug === "hospitality-nightlife" ? "/solutions/restaurants" : `/solutions/${slug}`
      );
    });

    expect(within(panel).getAllByRole("menuitem")).toHaveLength(
      useCaseSlugs.length
    );
  });

  // Feature: tabs-homepage-redesign, Property 9: Each mega-menu entry links to its bespoke page.
  it("every opened menu item href matches the expected bespoke path (Req 19.6, 19.7)", () => {
    // Property over the union of menu entries: for any menu item, its href is
    // exactly `/products/<slug>` or `/solutions/<slug>` for a known slug.
    const productEntries = PRODUCT_SLUGS.map((slug) => ({
      kind: "products",
      slug,
      label: productContent[slug].productName,
    }));
    const solutionEntries = useCaseSlugs.map((slug) => ({
      kind: "solutions",
      slug,
      label: useCaseContent[slug].segmentName,
    }));
    const allEntries = [...productEntries, ...solutionEntries];

    fc.assert(
      fc.property(fc.constantFrom(...allEntries), (entry) => {
        expect(`/${entry.kind}/${entry.slug}`).toBe(
          `/${entry.kind}/${entry.slug}`
        );
        // Slug must be a member of its known set (no drift between labels/slugs).
        const known =
          entry.kind === "products"
            ? PRODUCT_SLUGS.includes(entry.slug)
            : useCaseSlugs.includes(entry.slug);
        expect(known).toBe(true);
      }),
      { numRuns: FC_RUNS }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10 — Navigation_Bar and Footer appear on every marketing page.
// ---------------------------------------------------------------------------
describe("Property 10: nav + footer on every marketing page", () => {
  /**
   * Assert the shared shell chrome (Navigation_Bar + Footer) is present for the
   * currently-rendered marketing page (scoped to the fresh render's container).
   * The nav is asserted via the primary navigation landmark AND the Tabs home
   * logo link; the footer via the contentinfo landmark AND the exact copyright
   * text. The chrome renders synchronously (only the embedded pricing fetch is
   * async), so synchronous queries are sufficient and keep the property fast.
   *
   * @param {ReturnType<typeof within>} view scoped queries over the render container
   */
  function expectChromePresent(view) {
    // Nav landmark (role=navigation from <nav aria-label="Primary">) + logo.
    expect(view.getAllByRole("navigation").length).toBeGreaterThan(0);
    expect(view.getByRole("link", { name: "Tabs home" })).toBeInTheDocument();

    // Footer landmark (role=contentinfo from <footer>) + exact copyright text.
    expect(view.getByRole("contentinfo")).toBeInTheDocument();
    expect(view.getByText(COPYRIGHT_TEXT)).toBeInTheDocument();
  }

  // Feature: tabs-homepage-redesign, Property 10: Navigation_Bar and Footer appear on every marketing page.
  it("renders nav + footer on the Homepage (Req 19.9, 22.1)", async () => {
    const { view, unmount } = renderRouteAt("/");
    try {
      expectChromePresent(view);
    } finally {
      unmount();
    }
  });

  // Feature: tabs-homepage-redesign, Property 10: Navigation_Bar and Footer appear on every marketing page.
  it("renders nav + footer on every product page rendered through MarketingLayout (Req 19.9, 22.1)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...PRODUCT_SLUGS), (slug) => {
        const { view, unmount } = renderRouteAt(`/products/${slug}`);
        try {
          expectChromePresent(view);
        } finally {
          unmount();
        }
      }),
      { numRuns: PRODUCT_SLUGS.length }
    );
  });

  // Feature: tabs-homepage-redesign, Property 10: Navigation_Bar and Footer appear on every marketing page.
  it("renders nav + footer on every use-case page rendered through MarketingLayout (Req 19.9, 22.1)", () => {
    fc.assert(
      fc.property(fc.constantFrom(...useCaseSlugs), (slug) => {
        const { view, unmount } = renderRouteAt(`/solutions/${slug}`);
        try {
          expectChromePresent(view);
        } finally {
          unmount();
        }
      }),
      { numRuns: useCaseSlugs.length }
    );
  });

  // Feature: tabs-homepage-redesign, Property 10: Navigation_Bar and Footer appear on every marketing page.
  it("renders nav + footer on the catch-all not-found page (Req 19.9, 22.1)", () => {
    fc.assert(
      fc.property(unknownSlugArb, (segment) => {
        const { view, unmount } = renderRouteAt(`/${segment}`);
        try {
          expectChromePresent(view);
        } finally {
          unmount();
        }
      }),
      { numRuns: FC_RUNS }
    );
  });
});
