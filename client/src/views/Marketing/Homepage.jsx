// Feature: tabs-homepage-redesign
//
// Homepage — composes the public Marketing_Site landing page from the section
// components built in task 5. It renders the sections in Design_Document order
// inside a single semantic <main> landmark (Req 15.1); the Navigation_Bar and
// Footer are provided by MarketingLayout and are intentionally NOT rendered here.
//
// Section order (Design_Document / Req 12.2 — CtaBand renders LAST, before the
// Footer):
//   Hero → StatBand → ProductsSection → PlatformSection → ProofSection →
//   RevenueEngines → Segments → CtaBand
//   (Company/leadership lives on /about; open roles live on /careers.)
//   (Pricing lives on the dedicated /pricing page, not the homepage.)
//
// Page metadata (Req 17.1, 17.2): the document title and meta description are
// set via `useDocumentMeta`.
//
// Anchor reconciliation: the Navigation_Bar's "Talk to sales" action scrolls to
// the section whose id is `talk-to-sales`, while `CtaBand` owns id `contact`
// (the target of every `/#contact` link). To make the closing CTA reachable by
// BOTH targets, CtaBand is wrapped here in a `<div id="talk-to-sales">`. That
// gives the nav's `talk-to-sales` scroll target an element to resolve to while
// CtaBand keeps its own `id="contact"` for the `/#contact` links — so both
// `#contact` and `#talk-to-sales` resolve to the closing CTA region.
//
// Styling is intentionally minimal/class-based here; the full Design_Document
// CSS port lands in task 10.
//
// _Requirements: 12.2, 15.1, 15.2, 17.1, 17.2_

import React from "react";

import useDocumentMeta from "./hooks/useDocumentMeta";

import Hero from "./sections/Hero";
import StatBand from "./sections/StatBand";
import ProductsSection from "./sections/ProductsSection";
import PlatformSection from "./sections/PlatformSection";
import ProofSection from "./sections/ProofSection";
import RevenueEngines from "./sections/RevenueEngines";
import Segments from "./sections/Segments";
import CtaBand from "./sections/CtaBand";

/** Homepage document title (Design_Document page title, Req 17.1). */
export const HOMEPAGE_TITLE = "Tabs — Fill your calendar. Sell every seat. Keep them coming back.";

/** Homepage meta description (Req 17.2). */
export const HOMEPAGE_DESCRIPTION =
  "The all-in-one platform for venues, promoters, and restaurants — publish " +
  "events, sell tickets, run the door, engage attendees, and see what worked, " +
  "all in one place.";

/**
 * The public Marketing_Site Homepage. Rendered as the index route inside
 * `MarketingLayout`, which supplies the Navigation_Bar and Footer landmarks.
 *
 * @returns {JSX.Element}
 */
export default function Homepage() {
  useDocumentMeta({ title: HOMEPAGE_TITLE, description: HOMEPAGE_DESCRIPTION });

  return (
    <main className="marketing-homepage">
      <Hero />
      <StatBand />
      <ProductsSection />
      <PlatformSection />
      <ProofSection />
      <RevenueEngines />
      <Segments />
      {/*
        Wrap CtaBand so the nav's `talk-to-sales` scroll target resolves here,
        while CtaBand keeps its own id="contact" for `/#contact` links. Both
        anchors therefore point at the closing CTA region (Req 12.2).
      */}
      <div id="talk-to-sales">
        <CtaBand />
      </div>
    </main>
  );
}
