// MarketingNotFound — in-layout not-found page for the Marketing_Site.
//
// Rendered for any unmatched marketing route and for unknown product/use-case
// slugs (ProductPage / UseCasePage). It is deliberately rendered *inside*
// `MarketingLayout` (via the router `<Outlet />` or by a page delegating to it),
// so the Navigation_Bar and Footer remain present around this content.
//
// Requirement 19.10: IF a visitor requests a Marketing_Site route that does not
// exist, THEN the Marketing_Site SHALL present a not-found page that offers
// navigation back to the Homepage.
//
// Styling is intentionally minimal/class-based here; the full Design_Document
// CSS port happens in task 10.

import React from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "./hooks/useDocumentMeta";

/**
 * In-layout "page not found" view offering a link back to the Homepage (`/`).
 *
 * @returns {JSX.Element}
 */
const MarketingNotFound = () => {
  useDocumentMeta({
    title: "Page not found — Tabs",
    description:
      "The page you were looking for could not be found. Return to the Tabs homepage to keep exploring.",
  });

  return (
    <main className="marketing-not-found" role="main">
      <div className="marketing-not-found__inner">
        <p className="marketing-not-found__code">404</p>
        <h1 className="marketing-not-found__title">Page not found</h1>
        <p className="marketing-not-found__message">
          We couldn&apos;t find the page you were looking for. It may have moved,
          or the link may be incorrect.
        </p>
        <Link className="marketing-not-found__home-link" to="/">
          Back to homepage
        </Link>
      </div>
    </main>
  );
};

export default MarketingNotFound;
