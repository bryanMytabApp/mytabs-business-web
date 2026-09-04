// Feature: tabs-homepage-redesign
//
// CtaBand — closing call-to-action region for the Homepage. It gives a visitor
// who has scrolled the whole page a final prompt to convert without scrolling
// back up.
//
// Presents (per Requirement 12 and the Design_Document):
//   - The closing CTA content and actions: a Primary_CTA "Talk to sales" plus a
//     Secondary_CTA (12.1)
//   - Rendered as its own <section> so the Homepage can place it directly before
//     the Footer (12.2)
//
// The Primary_CTA points at the marketing contact anchor (`/#contact`, the same
// "Talk to sales" target used across the Marketing_Site) and the Secondary_CTA
// points at the existing `/login` route (Req 19.8). Full Design_Document styling
// lands in task 10.
//
// _Requirements: 12.1, 12.2_

import React from "react";
import { Link } from "react-router-dom";

/** Shared "Talk to sales" contact target used across the Marketing_Site. */
export const TALK_TO_SALES_TO = "/#contact";

/**
 * CTA_Band landmark for the Homepage. Rendered by `Homepage` immediately before
 * the Footer (Req 12.2).
 *
 * @returns {JSX.Element}
 */
export default function CtaBand() {
  return (
    <section
      className="marketing-cta-band"
      id="contact"
      aria-labelledby="cta-band-title"
    >
      <div className="marketing-cta-band__inner">
        <h2 id="cta-band-title" className="marketing-cta-band__title">
          Ready to run your events on Tabs?
        </h2>
        <p className="marketing-cta-band__lede">
          See how the connected platform fits your venue, agency, campus, or
          city — and what it can do for your next event.
        </p>

        <div className="marketing-cta-band__actions">
          <Link
            className="marketing-cta-band__cta marketing-cta-band__cta--primary"
            to="/register"
          >
            Join Tabs
          </Link>
          <Link
            className="marketing-cta-band__cta marketing-cta-band__cta--secondary"
            to="/login"
          >
            Log in
          </Link>
        </div>
      </div>
    </section>
  );
}
