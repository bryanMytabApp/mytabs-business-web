// Feature: tabs-homepage-redesign
//
// PlatformSection — the Homepage Platform_Section describing the three
// delivery surfaces Tabs runs on (Requirement 5):
//   - Web dashboard (5.1)
//   - Tabs mobile app, identified as available for iOS and Android (5.2)
//   - Organizations console (5.3)
//
// Content is authored/static from the Design_Document. The Organizations
// console card links to its bespoke product page for a deeper dive.
//
// Styling is intentionally minimal and class-based; the full Design_Document
// CSS port lands in task 10.
//
// _Requirements: 5.1, 5.2, 5.3_

import React from "react";
import { Link } from "react-router-dom";

// The three platforms, in Design_Document order. `availability` (optional)
// carries the iOS/Android identification required for the mobile app (5.2).
const PLATFORMS = [
  {
    id: "web-dashboard",
    name: "Web dashboard",
    description:
      "The full Tabs control center in the browser — publish events, sell tickets, run engagements, and read analytics from one place your whole team can use.",
  },
  {
    id: "mobile-app",
    name: "Tabs mobile app",
    availability: "Available for iOS and Android",
    description:
      "Run the door, check guests in, and keep your audience engaged on the go. The Tabs mobile app puts box office and live experiences in your pocket.",
  },
  {
    id: "organizations-console",
    name: "Organizations console",
    description:
      "Manage multiple locations, teams, roles, and consolidated reporting and billing across your whole organization from a single console.",
    to: "/products/organizations",
  },
];

/**
 * Platform_Section landmark: the three Tabs delivery surfaces.
 */
export default function PlatformSection() {
  return (
    <section
      className="marketing-platform"
      id="platform"
      aria-labelledby="marketing-platform-heading"
    >
      <h2 id="marketing-platform-heading" className="marketing-platform__heading">
        Three platforms, one operating system
      </h2>

      <ul className="marketing-platform__grid">
        {PLATFORMS.map((platform) => (
          <li key={platform.id} className="marketing-platform__card">
            <h3 className="marketing-platform__card-title">{platform.name}</h3>
            {platform.availability && (
              <p className="marketing-platform__availability">
                {platform.availability}
              </p>
            )}
            <p className="marketing-platform__card-desc">
              {platform.description}
            </p>
            {platform.to && (
              <Link to={platform.to} className="marketing-platform__card-link">
                Learn more
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
