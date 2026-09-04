// Feature: tabs-homepage-redesign
//
// ProofSection — the Homepage Proof_Section presenting the Prairie View A&M
// University SGA Leadership Summit case study as social proof (Requirement 6).
//
// Displays the case study narrative (6.1) and the two headline result metrics:
//   - "84.7% RSVP-to-attendance" (6.2)
//   - "$1,270 revenue"           (6.3)
//
// Metric strings are exported so smoke tests (task 5.6) can assert the exact
// literals. Content is authored/static from the Design_Document.
//
// Styling is intentionally minimal and class-based; the full Design_Document
// CSS port lands in task 10.
//
// _Requirements: 6.1, 6.2, 6.3_

import React from "react";

// Exact metric literals required by Req 6.2 / 6.3.
export const RSVP_ATTENDANCE_METRIC = "84.7% RSVP-to-attendance";
export const REVENUE_METRIC = "$1,270 revenue";

const CASE_STUDY = {
  organization: "Prairie View A&M University",
  event: "SGA Leadership Summit",
  quote:
    "Tabs gave our student government one place to publish the Summit, sell tickets, check students in, and see exactly how it performed — with results we could take straight to leadership.",
  metrics: [RSVP_ATTENDANCE_METRIC, REVENUE_METRIC],
};

/**
 * Proof_Section landmark: the Prairie View A&M case study with result metrics.
 */
export default function ProofSection() {
  return (
    <section
      className="marketing-proof"
      id="proof"
      aria-labelledby="marketing-proof-heading"
    >
      <h2 id="marketing-proof-heading" className="marketing-proof__heading">
        Real results: {CASE_STUDY.organization} {CASE_STUDY.event}
      </h2>

      <figure className="marketing-proof__figure">
        <blockquote className="marketing-proof__quote">
          <p>{CASE_STUDY.quote}</p>
        </blockquote>
        <figcaption className="marketing-proof__caption">
          {CASE_STUDY.organization} — {CASE_STUDY.event}
        </figcaption>
      </figure>

      <ul className="marketing-proof__metrics">
        {CASE_STUDY.metrics.map((metric) => (
          <li key={metric} className="marketing-proof__metric">
            {metric}
          </li>
        ))}
      </ul>
    </section>
  );
}
