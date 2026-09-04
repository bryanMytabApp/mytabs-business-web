// Feature: tabs-homepage-redesign
//
// Footer — shared marketing-site footer rendered by `MarketingLayout` on the
// Homepage, every Product_Page, and every Use_Case_Page.
//
// Presents (per Requirement 13 and the Design_Document):
//   - Link columns: Product, Solutions, Platform, Company, Resources (13.1)
//   - Social links (13.2)
//   - Legal links (13.3)
//   - Copyright text "© 2026 My Tabs LLC. Houston, Texas." (13.4)
//
// Internal marketing routes use react-router `Link`. Product and Solutions
// columns reuse the canonical slugs from the shared content modules
// (`PRODUCT_SLUGS` / `productContent`, `useCaseSlugs` / `useCaseContent`) so the
// footer, the Products/Solutions mega-menus, and the `/products/:productSlug`
// and `/solutions/:useCaseSlug` routes stay in sync. External links (social,
// legal, resources) use plain anchors.
//
// Styling is intentionally minimal and class-based here; the full Design_Document
// CSS port lands in task 10.
//
// _Requirements: 13.1, 13.2, 13.3, 13.4_

import React from "react";
import { Link } from "react-router-dom";

import { PRODUCT_SLUGS, productContent } from "../products/productContent";
import { useCaseSlugs, useCaseContent } from "../solutions/useCaseContent";

/** Exact copyright text required by Requirement 13.4. */
export const COPYRIGHT_TEXT = "© 2026 My Tabs LLC. Houston, Texas.";

// Product column — one internal link per known product slug, in Design_Document
// order. Labels come from the shared content model so names never drift.
const PRODUCT_LINKS = PRODUCT_SLUGS.map((slug) => ({
  label: productContent[slug].productName,
  to: `/products/${slug}`,
}));

// Solutions column — one internal link per known use-case slug, in order.
const SOLUTIONS_LINKS = useCaseSlugs.map((slug) => ({
  label: useCaseContent[slug].segmentName,
  // Hospitality/nightlife has a bespoke Restaurants & Hospitality page; everything
  // else uses the generic use-case route. Kept in sync with the nav mega-menu.
  to: slug === "hospitality-nightlife" ? "/solutions/restaurants" : `/solutions/${slug}`,
}));

// Platform column — top-level marketing routes / in-page anchors (Req 1.2).
const PLATFORM_LINKS = [
  { label: "Platform", to: "/#platform" },
  { label: "Pricing", to: "/pricing" },
  { label: "Web dashboard", to: "/#platform" },
  { label: "Tabs mobile app", to: "/#platform" },
  { label: "Organizations console", to: "/products/organizations" },
];

// Company column — company/about marketing anchors and actions.
const COMPANY_LINKS = [
  { label: "About", to: "/about" },
  { label: "Join Tabs", to: "/register" },
  { label: "Log in", to: "/login" },
];

// Resources column — supporting content. External resources use plain anchors.
const RESOURCES_LINKS = [
  { label: "Help center", href: "https://help.keeptabs.app", external: true },
  { label: "Contact", to: "/contact" },
];

// Social links (Req 13.2) — external channels open in a new tab.
const SOCIAL_LINKS = [
  {
    label: "Instagram",
    href: "https://www.instagram.com/keeptabsapp?igsh=eXRxZmJmdzVsMmF0&utm_source=qr",
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/share/1BzVsQR1HZ/?mibextid=wwXIfr",
  },
];

// Legal links (Req 13.3).
const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "https://www.mytabs.app/privacy", external: true },
  { label: "Terms of Service", href: "https://www.mytabs.app/terms", external: true },
];

/**
 * Render a single footer link. Internal marketing routes (those with a `to`)
 * use react-router `Link`; external links (those with `href`) use an anchor.
 */
function FooterLink({ link }) {
  if (link.to) {
    return <Link to={link.to}>{link.label}</Link>;
  }
  const external = link.external;
  return (
    <a
      href={link.href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {link.label}
    </a>
  );
}

/**
 * Render a titled column of footer links.
 */
function FooterColumn({ title, links }) {
  return (
    <div className="marketing-footer__column">
      <h2 className="marketing-footer__column-title">{title}</h2>
      <ul className="marketing-footer__list">
        {links.map((link) => (
          <li key={link.label} className="marketing-footer__item">
            <FooterLink link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Marketing_Site Footer landmark.
 */
export default function Footer() {
  return (
    <footer className="marketing-footer" aria-label="Site footer">
      <div className="marketing-footer__columns">
        <FooterColumn title="Product" links={PRODUCT_LINKS} />
        <FooterColumn title="Solutions" links={SOLUTIONS_LINKS} />
        <FooterColumn title="Platform" links={PLATFORM_LINKS} />
        <FooterColumn title="Company" links={COMPANY_LINKS} />
        <FooterColumn title="Resources" links={RESOURCES_LINKS} />
      </div>

      <nav className="marketing-footer__social" aria-label="Social media">
        <ul className="marketing-footer__list marketing-footer__list--inline">
          {SOCIAL_LINKS.map((link) => (
            <li key={link.label} className="marketing-footer__item">
              <a href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <nav className="marketing-footer__legal" aria-label="Legal">
        <ul className="marketing-footer__list marketing-footer__list--inline">
          {LEGAL_LINKS.map((link) => (
            <li key={link.label} className="marketing-footer__item">
              <a
                href={link.href}
                {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <p className="marketing-footer__copyright">{COPYRIGHT_TEXT}</p>
    </footer>
  );
}
