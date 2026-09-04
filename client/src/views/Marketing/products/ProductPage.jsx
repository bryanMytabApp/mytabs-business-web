// Feature: tabs-homepage-redesign
//
// ProductPage — per-product Marketing_Site page.
//
// Reads the `:productSlug` route param, looks up `productContent[slug]`, and
// renders a layout that matches the shared secondary-page design (Restaurants /
// Solutions): a full-width `.mkt-page` + `.wrap` shell, a breadcrumb, a
// left-aligned `.mkt-page__hero`, then `.mkt-section` blocks for the problems
// grid, feature rows, authored sections, plans, and FAQ, closing with the
// shared `.mkt-closing` CTA band.
//
// This page is rendered inside `MarketingLayout` via the router `<Outlet />`
// (task 9), so the Navigation_Bar and Footer surround this content. It provides
// a Primary_CTA "Join Tabs" (→ `/register`) and a path back to the Homepage
// (`/`) (Req 20.3), and sets the document title + meta description from the
// entry's `seo` (Req 22.2).
//
// _Requirements: 19.4, 19.10, 20.1, 20.2, 20.3, 20.4, 20.5, 20.6, 22.2_

import React from "react";
import { Link, useParams } from "react-router-dom";

import productContent from "./productContent";
import { PRODUCT_ICONS } from "./productIcons";
import MarketingNotFound from "../MarketingNotFound";
import useDocumentMeta from "../hooks/useDocumentMeta";

/** Shared "Talk to sales" contact target used across the Marketing_Site. */
export const TALK_TO_SALES_TO = "/#contact";

/**
 * Product_Page. Resolves `:productSlug` to a `productContent` entry and renders
 * its authored content, or delegates to `MarketingNotFound` when the slug is
 * unknown.
 *
 * @returns {JSX.Element}
 */
export default function ProductPage() {
  const { productSlug } = useParams();
  const product =
    productSlug && Object.prototype.hasOwnProperty.call(productContent, productSlug)
      ? productContent[productSlug]
      : undefined;

  // Set page title + meta description from the entry's seo (Req 22.2). The hook
  // is called unconditionally (before any early return) to respect the Rules of
  // Hooks; MarketingNotFound sets its own meta when the slug is unknown.
  const seo = product ? product.seo || {} : {};
  useDocumentMeta({ title: seo.title, description: seo.description });

  // Unknown slug → in-layout not-found page (Req 19.10). Rendering
  // MarketingNotFound directly keeps Nav/Footer (supplied by MarketingLayout)
  // around the not-found content.
  if (!product) {
    return <MarketingNotFound />;
  }

  const {
    productName,
    headline,
    description,
    subhead,
    problems = [],
    problemsIntro,
    featureRows = [],
    sections = [],
    faq = [],
    offeredOnPlans,
  } = product;

  const headingId = `product-${product.slug}-heading`;
  const plansId = `product-${product.slug}-plans`;

  // Large gradient product icon (same source as the Products mega-menu chip),
  // shown next to the eyebrow to match the site theme.
  const icon = PRODUCT_ICONS[product.slug];

  return (
    <main
      className="mkt-page mkt-product"
      role="main"
      aria-labelledby={headingId}
      data-product-slug={product.slug}
    >
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Products / {productName}</p>

        <header className="mkt-page__hero">
          <div className="marketing-product__title-row">
            {icon ? (
              <span
                className="marketing-product__icon"
                style={{ background: icon.gradient }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {icon.render}
                </svg>
              </span>
            ) : null}
            <p className="marketing-product__eyebrow">{productName}</p>
          </div>
          <h1 id={headingId}>{headline}</h1>
          <p className="mkt-page__lede">{description}</p>
          <div className="mkt-page__ctas">
            <Link className="btn btn--primary" to="/register">Join Tabs</Link>
            <Link className="btn btn--ghost" to="/#pricing">See pricing</Link>
          </div>
        </header>

        {subhead && (
          <section className="mkt-section" aria-label="Overview">
            <p className="mkt-section__intro">{subhead}</p>
          </section>
        )}

        {problems.length > 0 && (
          <section className="mkt-section" aria-label="Problems this solves">
            {problemsIntro && <p className="mkt-section__intro">{problemsIntro}</p>}
            <div className="mkt-card-grid mkt-card-grid--3">
              {problems.map((prob) => (
                <div className="mkt-card mkt-card--problem" key={prob.title}>
                  <h3>{prob.title}</h3>
                  <p>{prob.body}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {featureRows.length > 0 && (
          <section className="mkt-section" aria-label="How it works">
            <div className="mkt-feature-rows">
              {featureRows.map((row, i) => (
                <div className="mkt-feature-row" key={row.heading}>
                  <div className="mkt-feature-row__num" aria-hidden="true">{i + 1}</div>
                  <div className="mkt-feature-row__body">
                    <h3>{row.heading}</h3>
                    <p>{row.body}</p>
                    {Array.isArray(row.points) && row.points.length > 0 && (
                      <ul className="mkt-feature-row__points">
                        {row.points.map((pt) => (
                          <li key={pt}>{pt}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {sections.length > 0 &&
          sections.map((section, index) => {
            const sectionHeadingId = `product-${product.slug}-section-${index}`;
            return (
              <section
                key={section.heading || index}
                className="mkt-section"
                aria-labelledby={sectionHeadingId}
              >
                <h2 id={sectionHeadingId}>{section.heading}</h2>
                <p className="mkt-section__intro">{section.body}</p>
              </section>
            );
          })}

        {Array.isArray(offeredOnPlans) && offeredOnPlans.length > 0 && (
          <section className="mkt-section" aria-labelledby={plansId}>
            <h2 id={plansId}>Included on these plans</h2>
            <ul className="marketing-use-case__product-list">
              {offeredOnPlans.map((plan) => (
                <li key={plan} className="marketing-use-case__product">
                  {plan}
                </li>
              ))}
            </ul>
          </section>
        )}

        {faq.length > 0 && (
          <section className="mkt-section" aria-labelledby={`product-${product.slug}-faq`}>
            <h2 id={`product-${product.slug}-faq`}>Frequently asked</h2>
            <div className="mkt-faq">
              {faq.map((qa) => (
                <details className="mkt-faq__item" key={qa.q}>
                  <summary>{qa.q}</summary>
                  <p>{qa.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        <section className="mkt-closing" aria-label="Get started">
          <div className="mkt-closing__inner">
            <div>
              <h2>Ready to run {productName.toLowerCase()} on Tabs?</h2>
              <p>Join Tabs and set it up for your next event, or talk to our team about the right plan.</p>
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
}
