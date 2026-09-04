// Feature: tabs-homepage-redesign
//
// MarketingLayout — the shared shell for the public Marketing_Site. It is the
// element route (no `path`) whose children are the marketing pages, so every
// marketing page (Homepage, each Product_Page, each Use_Case_Page) renders the
// same Navigation_Bar and Footer around its content (Req 19.9, 22.1).
//
// Responsibilities:
//   - Render `NavigationBar`, a react-router `<Outlet />` for the active page,
//     and `Footer` (design.md "MarketingLayout").
//   - Scope the shared marketing branding (Nunito font + palette custom
//     properties) to the marketing subtree via a `marketing-root` container so
//     the site is consistently branded (Req 22.1) without restyling the
//     dashboard. The full Design_Document CSS port targets `.marketing-root`
//     in task 10; the palette custom properties are also set inline here as a
//     resilient fallback so branding tokens exist before that CSS lands.
//   - Preconnect to the Design_Document web-font origins
//     (fonts.googleapis.com and fonts.gstatic.com) for faster font delivery
//     (Req 16.1). The links are injected into `document.head` in an effect and
//     removed on unmount, and are idempotent — if a matching preconnect link
//     already exists (e.g. added to public/index.html), it is left untouched.
//
// Styling here is intentionally minimal/class-based; sticky nav, palette, and
// layout CSS land in task 10.
//
// _Requirements: 16.1, 19.9, 22.1, 22.3_

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import NavigationBar from "./nav/NavigationBar";
import Footer from "./nav/Footer";

// Design_Document styling ported into the app, scoped entirely under
// `.marketing-root` so the dashboard theme is unaffected (task 10 / Req 22.1).
// Palette + typography + base + nav base + buttons land in task 10.1; section
// layout, hero animation, and responsive breakpoints are appended in task 10.2.
import "./marketing.css";

// Web-font origins from the Design_Document. Google Fonts serves CSS from
// fonts.googleapis.com and the font files from fonts.gstatic.com; the latter is
// a cross-origin font fetch and therefore needs `crossorigin` on its
// preconnect. Preconnecting to both shaves the connection setup off the
// critical font request (Req 16.1).
const FONT_PRECONNECT_ORIGINS = [
  { href: "https://fonts.googleapis.com", crossOrigin: false },
  { href: "https://fonts.gstatic.com", crossOrigin: true },
];

// Marketing palette custom properties (design.md: --ink/--cream/--teal/--cyan/
// --amber/--orange) plus the shared Nunito font stack. Set inline on the
// `marketing-root` container so the tokens are scoped to the marketing subtree
// (the dashboard theme is untouched) and available even before the task-10 CSS
// is loaded. Task 10 owns the authoritative values; these mirror the
// Design_Document palette so nothing renders unstyled in the interim.
// NOTE: these MUST mirror the authoritative Design_Document palette declared in
// marketing.css (§2). They are set inline so branding tokens exist before the
// stylesheet loads; because inline styles win over the stylesheet, any drift
// here would override the CSS — keep the two in sync.
const MARKETING_THEME_VARS = {
  "--ink": "#12262f",
  "--cream": "#fbf6ec",
  "--teal": "#0e7c93",
  "--cyan": "#18a8d8",
  "--amber": "#f5a623",
  "--orange": "#e8641f",
  fontFamily:
    'Nunito, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
};

/**
 * Inject font preconnect `<link>` elements into `document.head` if they are not
 * already present, returning a cleanup function that removes only the links this
 * effect added.
 *
 * Idempotency: if a preconnect link for a given origin already exists (for
 * instance declared in public/index.html), it is left in place and this effect
 * does not add a duplicate — matching the design note that the preconnect may
 * live in the layout or the HTML document.
 *
 * @returns {() => void} cleanup that removes the links added by this effect
 */
function injectFontPreconnects() {
  if (typeof document === "undefined") {
    return () => {};
  }

  const added = [];

  FONT_PRECONNECT_ORIGINS.forEach(({ href, crossOrigin }) => {
    // Skip if an equivalent preconnect already exists to avoid duplicates.
    const existing = document.head.querySelector(
      `link[rel="preconnect"][href="${href}"]`
    );
    if (existing) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = href;
    if (crossOrigin) {
      // Anonymous CORS mode; required for the gstatic font-file fetch.
      link.crossOrigin = "anonymous";
    }
    link.setAttribute("data-marketing-preconnect", "true");
    document.head.appendChild(link);
    added.push(link);
  });

  return () => {
    added.forEach((link) => {
      if (link.parentNode) {
        link.parentNode.removeChild(link);
      }
    });
  };
}

/**
 * Shared Marketing_Site layout: sticky Navigation_Bar, the active page via
 * `<Outlet />`, and the Footer — all wrapped in a branding-scoped
 * `marketing-root` container.
 *
 * @returns {JSX.Element}
 */
export default function MarketingLayout() {
  // Add the font preconnect links on mount and clean them up on unmount so the
  // dashboard (which does not use these fonts) is unaffected when the visitor
  // leaves the marketing subtree.
  useEffect(() => injectFontPreconnects(), []);

  return (
    <div className="marketing-root" style={MARKETING_THEME_VARS}>
      <NavigationBar />
      <Outlet />
      <Footer />
    </div>
  );
}
