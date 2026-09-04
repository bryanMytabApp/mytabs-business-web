// Feature: tabs-homepage-redesign
//
// ProductsSection — the Homepage Products_Section presenting Tabs' seven
// connected products plus the advertising / sponsorships / managed-experiences
// card (Requirement 4).
//
// The seven product cards (Events, Ticketing & Box Office, Analytics,
// Engagements, Market Intelligence, AI Discovery, Organizations) reuse the
// shared content model (`PRODUCT_SLUGS` / `productContent`) so names,
// descriptions, and routes stay in sync with the bespoke Product_Pages, the
// NavigationBar mega-menu, and the Footer. Each card links to its
// `/products/:slug` page (Req 4.1, 19.6).
//
// A final non-product card describes advertising, sponsorships, and managed
// experiences (Req 4.2) — this is a platform capability rather than one of the
// seven products, so it has no dedicated product page and renders as plain
// content.
//
// Styling is intentionally minimal and class-based; the full Design_Document
// CSS port lands in task 10.
//
// _Requirements: 4.1, 4.2, 4.3_

import React from "react";
import { Link } from "react-router-dom";

import { PRODUCT_SLUGS, productContent } from "../products/productContent";

// The seven product cards, derived from the shared content model in
// Design_Document order. Description is the short marketing summary.
const PRODUCT_CARDS = PRODUCT_SLUGS.map((slug) => ({
  slug,
  name: productContent[slug].productName,
  description: productContent[slug].description,
  to: `/products/${slug}`,
}));

// The advertising / sponsorships / managed-experiences card (Req 4.2).
export const ADVERTISING_CARD = {
  name: "Advertising, sponsorships & managed experiences",
  description:
    "Beyond the seven products, Tabs powers advertising, sponsorships, and fully managed experiences — turning your events into revenue channels for partners and brands.",
};

/**
 * Products_Section landmark: seven product cards + the advertising card.
 */
export default function ProductsSection() {
  return (
    <section
      className="marketing-products"
      id="products"
      aria-labelledby="marketing-products-heading"
    >
      <h2 id="marketing-products-heading" className="marketing-products__heading">
        Seven connected products
      </h2>

      <ul className="marketing-products__grid">
        {PRODUCT_CARDS.map((product) => (
          <li key={product.slug} className="marketing-products__card">
            <Link to={product.to} className="marketing-products__card-link">
              <h3 className="marketing-products__card-title">{product.name}</h3>
              <p className="marketing-products__card-desc">
                {product.description}
              </p>
            </Link>
          </li>
        ))}

        <li className="marketing-products__card marketing-products__card--advertising">
          <h3 className="marketing-products__card-title">
            {ADVERTISING_CARD.name}
          </h3>
          <p className="marketing-products__card-desc">
            {ADVERTISING_CARD.description}
          </p>
        </li>
      </ul>
    </section>
  );
}
