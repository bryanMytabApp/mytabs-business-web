// Feature: tabs-homepage-redesign
//
// Company — Homepage section presenting the leadership and advisors behind Tabs
// so visitors can evaluate the team's credibility.
//
// Presents (per Requirement 9 and the Design_Document):
//   - Bryan Dykes as CEO (9.1)
//   - Michael Arnwine as CTO (9.2)
//   - The advisors defined in the Design_Document (9.3)
//
// Leadership (CEO/CTO) is fixed by the requirements. The advisor roster is
// data-driven from `ADVISORS` below.
//
// NOTE: The user-provided Design_Document HTML/CSS is the source of truth for
// the advisor names/titles (Req 9.3) but is not part of the spec files in this
// repo, so the advisor entries below are placeholders. Replace the `ADVISORS`
// entries with the exact advisor names/titles from the Design_Document; the
// section markup and the CEO/CTO leadership content do not need to change.
//
// Styling is intentionally minimal and class-based here; the full
// Design_Document CSS port happens in task 10.
//
// _Requirements: 9.1, 9.2, 9.3_

import React from "react";

/**
 * Leadership team — fixed by Requirement 9.1 (CEO) and 9.2 (CTO).
 * @type {Array<{ name: string, title: string, bio: string }>}
 */
export const LEADERSHIP = [
  {
    name: "Bryan Dykes",
    title: "CEO",
    bio:
      "Sets the vision for the operating system events run on and leads the company's growth across products, platforms, and segments.",
  },
  {
    name: "Michael Arnwine",
    title: "CTO",
    bio:
      "Leads engineering and product architecture, building the connected platform that powers events from on-sale to the door.",
  },
];

/**
 * Advisors backing Tabs (Req 9.3).
 *
 * TODO(design-doc): Replace these placeholder entries with the exact advisor
 * names and titles from the user-provided Design_Document. The component reads
 * this array, so no markup changes are required to update the roster.
 * @type {Array<{ name: string, title: string }>}
 */
export const ADVISORS = [
  { name: "Advisor name", title: "Advisor — see Design_Document" },
  { name: "Advisor name", title: "Advisor — see Design_Document" },
];

/**
 * Company_Section landmark for the Homepage.
 *
 * @returns {JSX.Element}
 */
export default function Company() {
  return (
    <section
      className="marketing-company"
      id="company"
      aria-labelledby="company-title"
    >
      <div className="marketing-company__inner">
        <h2 id="company-title" className="marketing-company__title">
          The team behind Tabs
        </h2>
        <p className="marketing-company__lede">
          Operators and builders focused on making events run on a single,
          connected platform.
        </p>

        <div className="marketing-company__leadership">
          <h3 className="marketing-company__group-title">Leadership</h3>
          <ul className="marketing-company__list">
            {LEADERSHIP.map((person) => (
              <li key={person.name} className="marketing-company__person">
                <p className="marketing-company__person-name">{person.name}</p>
                <p className="marketing-company__person-title">{person.title}</p>
                <p className="marketing-company__person-bio">{person.bio}</p>
              </li>
            ))}
          </ul>
        </div>

        {ADVISORS.length > 0 && (
          <div className="marketing-company__advisors">
            <h3 className="marketing-company__group-title">Advisors</h3>
            <ul className="marketing-company__list">
              {ADVISORS.map((advisor, index) => (
                <li
                  key={`${advisor.name}-${index}`}
                  className="marketing-company__person"
                >
                  <p className="marketing-company__person-name">
                    {advisor.name}
                  </p>
                  <p className="marketing-company__person-title">
                    {advisor.title}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
