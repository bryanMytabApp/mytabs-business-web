// UseCasePage — Use_Case_Page for the Marketing_Site.
//
// Rendered by the `/solutions/:useCaseSlug` route. Reads the `:useCaseSlug`
// route param, looks up the matching entry in `useCaseContent`, and presents a
// per-segment layout that matches the RestaurantsPage design (shared `mkt-*`
// layout, no hero photo):
//   - a breadcrumb + left-aligned hero (segment name, lede, CTAs),
//   - the problems the segment faces (`problems[]`) as a card grid,
//   - the relevant Tabs products/capabilities (`relevantProducts[]`),
//   - the authored content `sections[]` as numbered feature rows, and
//   - a closing CTA band with a path back to the Homepage (`/`).
//
// Unknown slugs delegate to the in-layout `MarketingNotFound` page so the
// Navigation_Bar and Footer remain present (Req 19.10). Title + meta description
// come from the entry's `seo` via `useDocumentMeta` (Req 22.2).
//
// _Requirements: 19.5, 19.10, 21.1, 21.2, 21.3, 21.4, 21.5, 22.2_

import React from "react";
import { useParams, Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";
import MarketingNotFound from "../MarketingNotFound";
import { useCaseContent } from "./useCaseContent";

/**
 * Use_Case_Page for a single customer segment.
 *
 * Resolves `:useCaseSlug` against `useCaseContent`. When the slug is unknown the
 * component renders `MarketingNotFound` (Req 19.10). Otherwise it renders the
 * shared secondary-page layout describing the segment's problems, the relevant
 * Tabs products, and the authored content sections, with a "Join Tabs" CTA and
 * a path back to the Homepage.
 *
 * @returns {JSX.Element}
 */
const UseCasePage = () => {
  const { useCaseSlug } = useParams();
  const content =
    useCaseSlug && Object.prototype.hasOwnProperty.call(useCaseContent, useCaseSlug)
      ? useCaseContent[useCaseSlug]
      : undefined;

  // Unknown slug -> in-layout not-found (keeps Nav/Footer). Req 19.10.
  // Hooks below (useDocumentMeta) must not run conditionally, but returning
  // early here is safe because MarketingNotFound owns its own document meta.
  if (!content) {
    return <MarketingNotFound />;
  }

  const {
    segmentName,
    problems = [],
    relevantProducts = [],
    sections = [],
    seo = {},
  } = content;

  return (
    <UseCasePageContent
      segmentName={segmentName}
      problems={problems}
      relevantProducts={relevantProducts}
      sections={sections}
      seo={seo}
    />
  );
};

/**
 * Presentational body for a resolved use-case entry. Split out so the
 * `useDocumentMeta` hook is always called unconditionally for a known segment
 * (the parent short-circuits to MarketingNotFound before reaching here).
 *
 * @param {{
 *   segmentName: string,
 *   problems: string[],
 *   relevantProducts: string[],
 *   sections: Array<{ heading: string, body: string, mediaAlt?: string }>,
 *   seo: { title?: string, description?: string }
 * }} props
 * @returns {JSX.Element}
 */
const UseCasePageContent = ({
  segmentName,
  problems,
  relevantProducts,
  sections,
  seo,
}) => {
  useDocumentMeta({ title: seo.title, description: seo.description });

  // Match the RestaurantsPage problem grid: 3-up when it divides evenly,
  // otherwise 2-up (keeps a tidy grid for 2 or 4 problems).
  const problemGridModifier = problems.length % 3 === 0 ? "3" : "2";

  return (
    <main className="mkt-page mkt-use-case" role="main" aria-labelledby="use-case-title">
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Solutions / {segmentName}</p>

        <header className="mkt-page__hero">
          <h1 id="use-case-title">Tabs for {segmentName}</h1>
          {seo.description && <p className="mkt-page__lede">{seo.description}</p>}
          <div className="mkt-page__ctas">
            <Link className="btn btn--primary" to="/register">Join Tabs</Link>
            <Link className="btn btn--ghost" to="/#pricing">See pricing</Link>
          </div>
        </header>

        {problems.length > 0 && (
          <section className="mkt-section" aria-labelledby="use-case-problems-title">
            <h2 id="use-case-problems-title">Challenges we solve</h2>
            <div className={`mkt-card-grid mkt-card-grid--${problemGridModifier}`}>
              {problems.map((problem, index) => (
                <div className="mkt-card mkt-card--problem" key={index}>
                  <p>{problem}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {relevantProducts.length > 0 && (
          <section className="mkt-section" aria-labelledby="use-case-products-title">
            <h2 id="use-case-products-title">Products that power it</h2>
            <ul className="marketing-use-case__product-list">
              {relevantProducts.map((product, index) => (
                <li className="marketing-use-case__product" key={index}>{product}</li>
              ))}
            </ul>
          </section>
        )}

        {sections.length > 0 && (
          <section className="mkt-section" aria-labelledby="use-case-how-title">
            <h2 id="use-case-how-title">How {segmentName.toLowerCase()} use Tabs</h2>
            <div className="mkt-feature-rows">
              {sections.map((section, index) => (
                <div className="mkt-feature-row" key={index}>
                  <div className="mkt-feature-row__num" aria-hidden="true">{index + 1}</div>
                  <div className="mkt-feature-row__body">
                    <h3>{section.heading}</h3>
                    <p>{section.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mkt-closing" aria-labelledby="use-case-closing-title">
          <div className="mkt-closing__inner">
            <div>
              <h2 id="use-case-closing-title">
                Ready to run {segmentName.toLowerCase()} on Tabs?
              </h2>
              <p>Talk to our team about the right plan for your organization.</p>
            </div>
            <div className="mkt-closing__actions">
              <Link className="btn btn--primary" to="/register">Join Tabs</Link>
              <Link className="btn btn--ghost" to="/">Back to homepage</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default UseCasePage;
export { UseCasePageContent };
