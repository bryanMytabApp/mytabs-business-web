// Feature: tabs-homepage-redesign
//
// Segments — Homepage section presenting the six target customer segments Tabs
// serves, so visitors can quickly identify the use cases relevant to them.
//
// Presents (per Requirement 8 and the Design_Document):
//   - The six segments: promoters, venues, hospitality/nightlife, agencies,
//     universities, tourism boards/cities — each with its description (8.1)
//   - A semantic <section> landmark; full Design_Document styling lands in task 10 (8.2)
//
// Where a segment maps to one of the bespoke Use_Case_Pages, the card links to
// the matching `/solutions/:useCaseSlug` route. The slug list and segment names
// are reused from the shared `useCaseContent` module so labels/routes stay in
// sync with the Solutions mega-menu and the `/solutions/:useCaseSlug` pages.
// (Note: the Solutions pages combine "Venues & promoters" into one page, while
// this section presents promoters and venues as distinct segments per the
// Design_Document; both point at the venues-promoters use-case page.)
//
// Styling is intentionally minimal and class-based here; the full
// Design_Document CSS port happens in task 10.
//
// _Requirements: 8.1, 8.2_

import React from "react";
import { Link } from "react-router-dom";

import { useCaseContent } from "../solutions/useCaseContent";

/**
 * The six segments, in Design_Document order. Each carries a short marketing
 * description and, where sensible, `useCaseSlug` linking to the matching
 * bespoke Use_Case_Page (`/solutions/:useCaseSlug`).
 * @type {Array<{ name: string, description: string, useCaseSlug?: string }>}
 */
export const SEGMENTS = [
  {
    name: "Promoters",
    description:
      "Independent promoters run on-sales, door lists, and payouts in one place, with a clear read on which campaigns and events actually fill rooms.",
    useCaseSlug: "venues-promoters",
  },
  {
    name: "Venues",
    description:
      "Venues own every seat from on-sale to the door — ticketing, box office, and check-in — and keep the revenue that belongs to them in-house.",
    useCaseSlug: "venues-promoters",
  },
  {
    name: "Hospitality & nightlife",
    description:
      "Bars, clubs, and hospitality venues program ticketed nights, manage guest lists, and build a loyalty loop that turns big nights into regulars.",
    useCaseSlug: "hospitality-nightlife",
  },
  {
    name: "Agencies",
    description:
      "Agencies run events, ticketing, promotions, and reporting across every client from one platform, with roles, consolidated billing, and provable ROI.",
    useCaseSlug: "agencies",
  },
  {
    name: "Universities",
    description:
      "Student orgs, departments, and campus life share one platform for events, RSVPs, and engagement — with governance and reporting across every group.",
    useCaseSlug: "universities",
  },
  {
    name: "Tourism boards & cities",
    description:
      "Tourism boards and cities unify local events on one calendar, measure attendance and economic impact, and plan with market intelligence.",
    useCaseSlug: "tourism-cities",
  },
];

/**
 * Render the inner content of a segment card. When a segment maps to a known
 * Use_Case_Page, the whole card body is wrapped in a router link so activating
 * it navigates to the matching `/solutions/:useCaseSlug` page.
 */
function SegmentCard({ segment }) {
  const known = segment.useCaseSlug && useCaseContent[segment.useCaseSlug];
  const body = (
    <>
      <h3 className="marketing-segments__item-name">{segment.name}</h3>
      <p className="marketing-segments__item-desc">{segment.description}</p>
    </>
  );

  if (known) {
    return (
      <li className="marketing-segments__item">
        <Link
          className="marketing-segments__link"
          to={`/solutions/${segment.useCaseSlug}`}
        >
          {body}
        </Link>
      </li>
    );
  }

  return <li className="marketing-segments__item">{body}</li>;
}

/**
 * Segments_Section landmark for the Homepage.
 *
 * @returns {JSX.Element}
 */
export default function Segments() {
  return (
    <section
      className="marketing-segments"
      id="segments"
      aria-labelledby="segments-title"
    >
      <div className="marketing-segments__inner">
        <h2 id="segments-title" className="marketing-segments__title">
          Built for the people who run events
        </h2>
        <p className="marketing-segments__lede">
          From a single promoter to a whole city, Tabs adapts to how each segment
          plans, sells, and grows.
        </p>

        <ul className="marketing-segments__list">
          {SEGMENTS.map((segment) => (
            <SegmentCard key={segment.name} segment={segment} />
          ))}
        </ul>
      </div>
    </section>
  );
}
