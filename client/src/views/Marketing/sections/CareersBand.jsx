// Feature: tabs-homepage-redesign
//
// CareersBand — Homepage section presenting the open roles at Tabs so a job
// seeker can see what's available and apply.
//
// Presents (per Requirement 11 and the Design_Document):
//   - The open roles, each with an apply action (11.1)
//   - Each apply action opens a `mailto:` link whose SUBJECT line identifies
//     that specific role (11.2)
//   - When no roles are open, an empty-state message indicating there are
//     currently no open roles (11.3)
//
// The roles list is data-driven from the `ROLES` array below so the roster can
// be edited without touching markup, and so the smoke/property tests
// (tasks 5.6 / 5.8) can drive the component with arbitrary role lists.
//
// NOTE: The user-provided Design_Document HTML/CSS is the source of truth for
// the exact open roles (Req 11.1) but is not part of the spec files in this
// repo, so the `ROLES` entries below are a reasonable seed. Replace them with
// the exact roles from the Design_Document; the component reads this array, so
// no markup changes are required to update the roster (setting `ROLES` to an
// empty array exercises the empty-state path in 11.3).
//
// Styling is intentionally minimal and class-based here; the full
// Design_Document CSS port happens in task 10.
//
// _Requirements: 11.1, 11.2, 11.3_

import React from "react";

/** Careers inbox that receives role applications. */
export const CAREERS_EMAIL = "careers@keeptabs.app";

/**
 * Open roles at Tabs (Req 11.1). Each entry drives one role row with its own
 * apply action. Set to `[]` to render the empty-state message (Req 11.3).
 *
 * TODO(design-doc): Replace these seed entries with the exact open roles from
 * the user-provided Design_Document.
 *
 * @type {Array<{ title: string, location?: string, type?: string }>}
 */
export const ROLES = [
  {
    title: "Senior Full-Stack Engineer",
    location: "Houston, TX / Remote",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    location: "Houston, TX / Remote",
    type: "Full-time",
  },
  {
    title: "Events Success Manager",
    location: "Houston, TX",
    type: "Full-time",
  },
];

/**
 * Build the `mailto:` href for applying to a specific role. The subject line
 * identifies the role so an application email is unambiguously tied to it
 * (Req 11.2).
 *
 * @param {string} roleTitle - The role's identifier (its title).
 * @returns {string} A `mailto:` URL with an encoded, role-specific subject.
 */
export function buildApplyMailto(roleTitle) {
  const subject = encodeURIComponent(`Application: ${roleTitle}`);
  return `mailto:${CAREERS_EMAIL}?subject=${subject}`;
}

/**
 * Careers_Band landmark for the Homepage.
 *
 * @param {Object} [props]
 * @param {Array<{ title: string, location?: string, type?: string }>} [props.roles]
 *   Open roles to display; defaults to the module-level `ROLES`. Passing `[]`
 *   renders the empty-state message (Req 11.3).
 * @returns {JSX.Element}
 */
export default function CareersBand({ roles = ROLES }) {
  const hasRoles = Array.isArray(roles) && roles.length > 0;

  return (
    <section
      className="marketing-careers"
      id="careers"
      aria-labelledby="careers-title"
    >
      <div className="marketing-careers__inner">
        <h2 id="careers-title" className="marketing-careers__title">
          Open roles
        </h2>
        <p className="marketing-careers__lede">
          Help build the operating system events run on.
        </p>

        {hasRoles ? (
          <ul className="marketing-careers__list">
            {roles.map((role, index) => (
              <li
                key={`${role.title}-${index}`}
                className="marketing-careers__role"
              >
                <div className="marketing-careers__role-info">
                  <p className="marketing-careers__role-title">{role.title}</p>
                  {(role.location || role.type) && (
                    <p className="marketing-careers__role-meta">
                      {[role.location, role.type]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                </div>
                <a
                  className="marketing-careers__apply"
                  href={buildApplyMailto(role.title)}
                >
                  Apply
                  <span className="sr-only">{` for ${role.title}`}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="marketing-careers__empty" role="status">
            There are currently no open roles. Check back soon.
          </p>
        )}
      </div>
    </section>
  );
}
