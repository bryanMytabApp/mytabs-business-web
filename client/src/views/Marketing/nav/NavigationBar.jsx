// Feature: tabs-homepage-redesign
//
// NavigationBar — the shared, sticky Marketing_Site navigation rendered by
// `MarketingLayout` on the Homepage, every Product_Page, and every Use_Case_Page.
//
// Responsibilities (per Requirement 1 and the Design_Document):
//   - Sticky/fixed to the top with no vertical displacement on scroll (Req 1.1).
//   - Presents: logo, "Products" trigger, "Solutions" trigger, "Platform" link,
//     "Pricing" link, "Company" link, "Log in" action, "Talk to sales" action
//     (Req 1.2).
//   - Products_Mega_Menu items link to `/products/:productSlug`; Solutions_Mega_Menu
//     items link to `/solutions/:useCaseSlug` (Req 1.3, 1.4, 19.6, 19.7). Labels and
//     slugs come from the shared content modules so navigation, footer, and routes
//     stay in sync.
//   - Only one mega-menu is open at a time; menus dismiss on Escape / outside-click
//     (handled inside `MegaMenu`) (Req 1.5, 19.6, 19.7).
//   - In-page anchor links (Platform / Pricing / Company) use Smooth_Scroll to the
//     target Homepage section within ≤1000 ms (Req 1.6, 18.1), gated by
//     `useReducedMotion` so navigation is instant when reduced motion is active
//     (Req 18.2). If the target section id is not present on the current page, the
//     handler no-ops and scroll position is retained (Req 1.7).
//   - "Log in" targets the existing `/login` route (Req 19.8).
//
// Styling here is intentionally minimal and class-based; the full Design_Document
// CSS port (sticky styling, palette, layout) lands in task 10.
//
// _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 18.1, 18.2, 19.6, 19.7, 19.8_

import React, { useCallback, useState } from "react";
import { Link } from "react-router-dom";

import MegaMenu from "./MegaMenu";
import useReducedMotion from "../hooks/useReducedMotion";
import tabsLogo from "../../../assets/menu/HomeviewTab.svg";
import { PRODUCT_SLUGS, productContent } from "../products/productContent";
import { PRODUCT_ICONS } from "../products/productIcons";
import { useCaseSlugs, useCaseContent } from "../solutions/useCaseContent";

// Panel ids used for the mega-menu `aria-controls` wiring. Kept stable so the
// trigger/panel association is predictable and testable.
const PRODUCTS_MENU_ID = "nav-products-menu";
const SOLUTIONS_MENU_ID = "nav-solutions-menu";

// Products_Mega_Menu entries — one router link per known product slug, in
// Design_Document order. Labels come from the shared content model so product
// names never drift between the nav, footer, and Product_Pages (Req 1.3, 19.6).
// Short subtitles from the Design_Document Products mega-menu, keyed by slug.
const PRODUCT_SUBTITLES = {
  events: "Publish & manage every event",
  ticketing: "Box office & QR check-in",
  analytics: "Performance you can act on",
  engagements: "Polls, raffles & loyalty",
  "market-intelligence": "Decision-ready reporting",
  "ai-discovery": "Supervised event sourcing",
  organizations: "Multi-location, one account",
};

// Per-product icons (gradient + SVG path data) are defined once in
// ../products/productIcons and shared with the bespoke Product_Pages so the
// nav chip and the large page-title icon always match.

const PRODUCT_MENU_ITEMS = PRODUCT_SLUGS.map((slug) => ({
  label: productContent[slug].productName,
  subtitle: PRODUCT_SUBTITLES[slug],
  to: `/products/${slug}`,
  icon: PRODUCT_ICONS[slug],
}));

// Solutions_Mega_Menu entries — one router link per known use-case slug, in
// order. Labels come from the shared content model (Req 1.4, 19.7).
const SOLUTIONS_MENU_ITEMS = useCaseSlugs.map((slug) => ({
  label: useCaseContent[slug].segmentName,
  // The hospitality/nightlife segment has a bespoke Restaurants & Hospitality
  // page at /solutions/restaurants; everything else uses the generic use-case route.
  to: slug === "hospitality-nightlife" ? "/solutions/restaurants" : `/solutions/${slug}`,
}));

// In-page anchor links to Homepage sections (Req 1.2, 1.6). The `sectionId`
// values match the section landmark ids the Homepage sections adopt (task 5).
const ANCHOR_LINKS = [
  { label: "Platform", sectionId: "platform" },
];

/**
 * NavigationBar — sticky marketing navigation with accessible mega-menus and
 * reduced-motion-aware in-page smooth scrolling.
 *
 * Only one mega-menu is open at a time; opening one closes the other.
 *
 * @returns {JSX.Element}
 */
export default function NavigationBar() {
  // Which mega-menu is currently open: "products" | "solutions" | null. Keeping
  // a single value (rather than a boolean per menu) enforces "only one open at a
  // time" (Req 1.3, 1.4).
  const [openMenu, setOpenMenu] = useState(null);
  // Mobile hamburger drawer open/closed. On desktop the links are always shown
  // and this state is ignored (CSS-gated).
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const openProducts = useCallback(() => setOpenMenu("products"), []);
  const openSolutions = useCallback(() => setOpenMenu("solutions"), []);
  const closeMenus = useCallback(() => setOpenMenu(null), []);
  // Close the mobile drawer (and any open mega-menu) — used when a link is
  // followed or the toggle is pressed.
  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  // In-page anchor navigation (Req 1.6, 1.7, 18.1, 18.2).
  //
  // - Resolves the target section by id on the current page. If it is absent
  //   (e.g. on a Product_Page rather than the Homepage), the handler no-ops so
  //   the current scroll position is retained (Req 1.7).
  // - When present, scrolls to the section. Reduced motion → instant jump;
  //   otherwise smooth scroll (Req 18.2). `scrollIntoView` completes well within
  //   the 1000 ms budget (Req 1.6, 18.1).
  const handleAnchorClick = useCallback(
    (event, sectionId) => {
      // Any menu should close when navigating.
      closeMenus();

      const target =
        typeof document !== "undefined" ? document.getElementById(sectionId) : null;

      if (!target) {
        // No such section on this page: no-op, retain scroll position (Req 1.7).
        event.preventDefault();
        return;
      }

      event.preventDefault();
      target.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "start",
      });
    },
    [closeMenus, prefersReducedMotion]
  );

  return (
    <nav className="marketing-nav" aria-label="Primary">
      <div className="marketing-nav__inner">
        {/* Logo / home link */}
        <Link to="/" className="marketing-nav__logo" aria-label="Tabs home" onClick={closeMobile}>
          <img src={tabsLogo} alt="" className="marketing-nav__logo-img" aria-hidden="true" />
          <span className="marketing-nav__logo-text">keeptabs</span>
        </Link>

        {/* Hamburger — visible only on mobile (CSS). Toggles the links drawer. */}
        <button
          type="button"
          className="marketing-nav__hamburger"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="marketing-nav-links"
          onClick={toggleMobile}
        >
          <span className="marketing-nav__hamburger-bars" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>

        <div
          id="marketing-nav-links"
          className={
            mobileOpen
              ? "marketing-nav__links is-mobile-open"
              : "marketing-nav__links"
          }
        >
          <MegaMenu
            id={PRODUCTS_MENU_ID}
            label="Products"
            items={PRODUCT_MENU_ITEMS}
            isOpen={openMenu === "products"}
            onOpen={openProducts}
            onClose={closeMenus}
            onItemClick={closeMobile}
            grid
            caret
          />

          <MegaMenu
            id={SOLUTIONS_MENU_ID}
            label="Solutions"
            items={SOLUTIONS_MENU_ITEMS}
            isOpen={openMenu === "solutions"}
            onOpen={openSolutions}
            onClose={closeMenus}
            onItemClick={closeMobile}
            caret
          />

          {ANCHOR_LINKS.map(({ label, sectionId }) => (
            <a
              key={sectionId}
              className="marketing-nav__link"
              href={`#${sectionId}`}
              onClick={(event) => { handleAnchorClick(event, sectionId); closeMobile(); }}
            >
              {label}
            </a>
          ))}

          <Link className="marketing-nav__link" to="/pricing" onClick={closeMobile}>
            Pricing
          </Link>
          <Link className="marketing-nav__link" to="/about" onClick={closeMobile}>
            About us
          </Link>

        </div>

        <div className="marketing-nav__actions">
          {/* Existing authenticated app login route (Req 19.8). */}
          <Link to="/login" className="marketing-nav__login" onClick={closeMobile}>
            Log in
          </Link>

          {/* Join Tabs — routes to the registration page. */}
          <Link to="/register" className="marketing-nav__cta" onClick={closeMobile}>
            Join Tabs
          </Link>
        </div>
      </div>
    </nav>
  );
}
