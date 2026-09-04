// Feature: tabs-homepage-redesign
//
// StatBand — the Homepage summary counts section (Stat_Band).
//
// Presents four at-a-glance platform stats as a slim banner (Requirement 3):
//   - "7 connected products" (3.1)
//   - "5 revenue engines"    (3.2)
//   - "3 platforms"          (3.3)
//   - "4 plans"              (3.4)
//
// Each stat is split into a numeric value and a label so the styling can size
// them independently. Content is authored/static.
//
// _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

import React from "react";

// The four summary stats, in Design_Document order. `value` + `label` combine
// to the required literal strings (e.g. "7 connected products").
// City / region counts trace to config/urbanhtx-regions.json (65 cities across
// 8 coverage regions of the live UrbanHTX discovery network).
export const STATS = [
  { value: "7", label: "connected products" },
  { value: "5", label: "revenue engines" },
  { value: "65", label: "cities covered" },
  { value: "8", label: "regions nationwide" },
];

/**
 * Stat_Band landmark rendering the four platform summary counts as a slim
 * banner.
 */
export default function StatBand() {
  return (
    <section
      className="marketing-statband"
      aria-label="Platform at a glance"
    >
      <ul className="marketing-statband__list">
        {STATS.map((stat) => (
          <li key={stat.label} className="marketing-statband__item">
            <span className="marketing-statband__value">{stat.value}</span>{" "}
            <span className="marketing-statband__label">{stat.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
