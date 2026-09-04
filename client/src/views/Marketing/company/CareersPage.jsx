// Feature: tabs-homepage-redesign
//
// CareersPage — "Careers" secondary page. Copy from files-2. Apply links are
// role-specific mailto: to careers@keeptabs.app. Route: /careers.

import React from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";

export const CAREERS_EMAIL = "careers@keeptabs.app";

const ROLES = [
  { title: "Campus Sales Representative", meta: "Business development · Houston" },
  { title: "Technical Event Coordinator", meta: "Customer success · Houston" },
  { title: "Business Development Representative", meta: "Pipeline & growth · Remote" },
];

const HIRING_STEPS = [
  { n: "1", title: "Apply", body: "Send your resume and a short note on which role fits — email works fine, no portal required." },
  { n: "2", title: "Intro conversation", body: "A call with our team to talk through the role, your background, and what you're looking for." },
  { n: "3", title: "Working session", body: "A practical conversation or exercise tied to the actual work — no generic brainteasers." },
  { n: "4", title: "Offer", body: "We move quickly once we know it's a fit, and we'll tell you where you stand at every step." },
];

const applyMailto = (role) =>
  `mailto:${CAREERS_EMAIL}?subject=${encodeURIComponent(`Application: ${role}`)}`;

export default function CareersPage() {
  useDocumentMeta({
    title: "Careers — Tabs",
    description:
      "Help build the operating system events run on. See open roles at Tabs in Houston and beyond, and how our hiring process works.",
  });

  return (
    <main className="mkt-page mkt-careers" role="main" aria-labelledby="careers-title">
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Careers</p>
        <header className="mkt-page__hero">
          <h1 id="careers-title">Help us build the operating system events run on.</h1>
          <p className="mkt-page__lede">
            We're growing our team in Houston as we expand from our HBCU beachhead into new campuses,
            venues, and markets. Here's what's open right now.
          </p>
        </header>

        <section className="mkt-section" aria-labelledby="careers-roles">
          <h2 id="careers-roles">Open roles</h2>
          <p className="mkt-section__intro">All roles are based in Houston unless noted otherwise.</p>
          <ul className="mkt-role-list">
            {ROLES.map((r) => (
              <li className="mkt-role" key={r.title}>
                <div>
                  <p className="mkt-role__title">{r.title}</p>
                  <p className="mkt-role__meta">{r.meta}</p>
                </div>
                <a className="btn btn--ghost" href={applyMailto(r.title)}>
                  Apply<span className="sr-only">{` for ${r.title}`}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="mkt-section" aria-labelledby="careers-process">
          <h2 id="careers-process">How hiring works here</h2>
          <div className="mkt-card-grid mkt-card-grid--4">
            {HIRING_STEPS.map((s) => (
              <div className="mkt-step" key={s.n}>
                <span className="mkt-step__num" aria-hidden="true">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-closing" aria-labelledby="careers-cta">
          <div className="mkt-closing__inner">
            <div>
              <h2 id="careers-cta">Don't see the right role yet?</h2>
              <p>We're growing quickly — send your resume anyway and tell us where you'd fit.</p>
            </div>
            <div className="mkt-closing__actions">
              <a className="btn btn--primary" href={applyMailto("General application")}>Send your resume</a>
              <Link className="btn btn--ghost" to="/contact">Contact us</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
