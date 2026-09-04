// Feature: tabs-homepage-redesign
//
// Property tests for CareersBand (design.md Correctness Property 12).
//
// Property 12: Career apply link identifies its role — Validates: Requirements 11.2
//   (and the empty-state message — Requirements 11.3)
//
// These exercise the REAL component with arbitrary role lists. No component
// source is modified; a failure here indicates a real defect.

import React from "react";
import { render, screen, within } from "@testing-library/react";
import fc from "fast-check";

import CareersBand, { buildApplyMailto, ROLES } from "./CareersBand";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

// A role title. Roles are identified by their title (Req 11.2), so we generate
// non-empty titles across a wide range of characters (incl. unicode, symbols,
// and whitespace-bearing strings) to stress subject encoding.
const roleTitleArb = fc.string({ minLength: 1, maxLength: 60 }).filter((s) => s.trim().length > 0);

const roleArb = fc.record({
  title: roleTitleArb,
  location: fc.option(fc.string({ maxLength: 40 }), { nil: undefined }),
  type: fc.option(fc.string({ maxLength: 24 }), { nil: undefined }),
});

// A non-empty list of roles. Titles may repeat; the component keys by
// `title-index`, so duplicates must not break rendering.
const roleListArb = fc.array(roleArb, { minLength: 1, maxLength: 8 });

// Decode a mailto subject param back to its raw text for comparison.
const subjectOf = (href) => {
  const match = /[?&]subject=([^&]*)/.exec(href || "");
  return match ? decodeURIComponent(match[1]) : null;
};

describe("CareersBand — Property 12: Career apply link identifies its role", () => {
  // Feature: tabs-homepage-redesign, Property 12: For any open role, its apply
  // action is a mailto: link whose subject line contains that role's identifier.
  it("renders one mailto apply link per role whose subject contains the role title", () => {
    fc.assert(
      fc.property(roleListArb, (roles) => {
        const { unmount } = render(<CareersBand roles={roles} />);
        try {
          const applyLinks = screen.getAllByRole("link", { name: /apply/i });

          // One apply action per open role (Req 11.1).
          expect(applyLinks).toHaveLength(roles.length);

          applyLinks.forEach((link, index) => {
            const href = link.getAttribute("href");
            const role = roles[index];

            // Must be a mailto: link (Req 11.2).
            expect(href).toMatch(/^mailto:/);

            // The subject line must contain this specific role's identifier.
            const subject = subjectOf(href);
            expect(subject).not.toBeNull();
            expect(subject).toContain(role.title);

            // And it must equal the component's own builder for that role, so
            // the link is unambiguously tied to it.
            expect(href).toBe(buildApplyMailto(role.title));
          });
        } finally {
          unmount();
        }
      }),
      { numRuns: 150 }
    );
  });

  // Feature: tabs-homepage-redesign, Property 12: each apply link is scoped to a
  // distinct role — the subject accessible-name association identifies the role.
  it("associates each apply link with its own role via accessible name", () => {
    fc.assert(
      fc.property(roleListArb, (roles) => {
        const { unmount } = render(<CareersBand roles={roles} />);
        try {
          // Each rendered role row exposes its title, and the row's apply link's
          // accessible name references that title (via the sr-only suffix).
          roles.forEach((role, index) => {
            const href = screen
              .getAllByRole("link", { name: /apply/i })[index]
              .getAttribute("href");
            expect(subjectOf(href)).toContain(role.title);
          });
        } finally {
          unmount();
        }
      }),
      { numRuns: 150 }
    );
  });

  // Feature: tabs-homepage-redesign, Property 12 (empty case, Req 11.3): an empty
  // role list yields the empty-state message and NO apply links.
  it("renders the empty-state message and no apply links for an empty role list", () => {
    fc.assert(
      fc.property(fc.constant([]), (roles) => {
        const { unmount } = render(<CareersBand roles={roles} />);
        try {
          expect(screen.queryAllByRole("link", { name: /apply/i })).toHaveLength(0);
          expect(screen.getByText(/no open roles/i)).toBeInTheDocument();
        } finally {
          unmount();
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: tabs-homepage-redesign, Property 12: the default (module ROLES) roster
  // also satisfies the invariant — every seeded role gets an identifying mailto.
  it("holds for the default ROLES roster", () => {
    const { unmount } = render(<CareersBand />);
    try {
      const applyLinks = screen.getAllByRole("link", { name: /apply/i });
      expect(applyLinks).toHaveLength(ROLES.length);
      applyLinks.forEach((link, index) => {
        expect(subjectOf(link.getAttribute("href"))).toContain(ROLES[index].title);
      });
    } finally {
      unmount();
    }
  });
});
