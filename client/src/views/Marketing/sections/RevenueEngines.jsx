// Feature: tabs-homepage-redesign
//
// RevenueEngines — Homepage section presenting the five ways Tabs' products
// help customers (venues, promoters, restaurants) grow their own revenue.
//
// Framing is customer-outcome first: each engine describes the money the
// CUSTOMER earns using the product, not revenue Tabs captures.
//
// Presents (per Requirement 7 and the Design_Document):
//   - The five engines: Subscriptions, Ticketing, Advertising,
//     Events & experiences, Market Intelligence — each with its description (7.1)
//   - A semantic <section> landmark; full Design_Document styling lands in task 10 (7.2)
//
// Styling is intentionally minimal and class-based here; the full
// Design_Document CSS port happens in task 10.
//
// _Requirements: 7.1, 7.2_

import React from "react";

/**
 * The five revenue engines, in Design_Document order. Each engine carries the
 * short marketing description shown on the Homepage.
 * @type {Array<{ name: string, description: string }>}
 */
export const REVENUE_ENGINES = [
  {
    name: "Subscriptions",
    description:
      "Turn one-time attendees into recurring members. Sell memberships and season passes that give you predictable, repeat revenue between events.",
  },
  {
    name: "Ticketing",
    description:
      "Keep more of every sale. Collect ticket, door, and reserved-seat revenue straight into your own account, with fast payouts and no box-office markup.",
  },
  {
    name: "Advertising",
    description:
      "Get paid by the brands that want your audience. Sell sponsorships and promoted placements to add a high-margin revenue line on top of ticket sales.",
  },
  {
    name: "Events & experiences",
    description:
      "Grow beyond one-off nights. Package premium experiences and managed events into a repeatable, higher-margin offering your regulars come back for.",
  },
  {
    name: "Market Intelligence",
    description:
      "Sell out smarter. Use your attendance and demand data to price events, time on-sales, and program the nights that make you the most money.",
  },
];

/**
 * Revenue_Engines_Section landmark for the Homepage.
 *
 * @returns {JSX.Element}
 */
export default function RevenueEngines() {
  return (
    <section
      className="marketing-revenue-engines"
      id="revenue-engines"
      aria-labelledby="revenue-engines-title"
    >
      <div className="marketing-revenue-engines__inner">
        <h2
          id="revenue-engines-title"
          className="marketing-revenue-engines__title"
        >
          Five ways to grow your revenue
        </h2>
        <p className="marketing-revenue-engines__lede">
          Tabs gives you five ways to earn across the whole events lifecycle —
          so every event does more for your bottom line.
        </p>

        <ul className="marketing-revenue-engines__list">
          {REVENUE_ENGINES.map((engine) => (
            <li key={engine.name} className="marketing-revenue-engines__item">
              <h3 className="marketing-revenue-engines__item-name">
                {engine.name}
              </h3>
              <p className="marketing-revenue-engines__item-desc">
                {engine.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
