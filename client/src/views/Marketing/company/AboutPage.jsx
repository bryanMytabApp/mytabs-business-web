// Feature: tabs-homepage-redesign
//
// AboutPage — the "Company / About" secondary page. Content is the final-draft
// copy from files-2/secondary-pages-copy.md. Rendered inside MarketingLayout
// (nav + footer supplied there). Route: /about.

import React from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";

const VALUES = [
  {
    title: "One login, not five",
    body:
      "Every product we build shares the same events, attendees, and data. Organizers shouldn't have to re-enter the same information in a different tool for every part of the job.",
    grad: "linear-gradient(135deg,var(--cyan),var(--teal))",
  },
  {
    title: "Prove it, don't promise it",
    body:
      "We'd rather show a real number from a real event than a projection. That's why our earliest case study is still our headline one — it's the one we can stand behind.",
    grad: "linear-gradient(135deg,var(--amber),var(--orange))",
  },
  {
    title: "Built with the people who use it",
    body:
      "Our roadmap comes from organizers, venue staff, and campus administrators — not just from what's easy to build.",
    grad: "linear-gradient(135deg,var(--teal),var(--ink))",
  },
];

const LEADERS = [
  { initials: "BD", name: "Bryan Dykes", role: "Co-Founder & CEO", grad: "linear-gradient(135deg,var(--teal),var(--ink))" },
  { initials: "MA", name: "Michael Arnwine", role: "Co-Founder & CTO", grad: "linear-gradient(135deg,var(--orange),var(--amber))" },
];

const ADVISORS = [
  { initials: "DF", name: "Dr. Doug Franklin", role: "Strategy" },
  { initials: "JL", name: "JoAnna Luna", role: "Legal & IP" },
  { initials: "RB", name: "Rayvin Biggers", role: "Creative Director" },
  { initials: "RB", name: "Rodney Broussard", role: "Accounting & BD" },
  { initials: "RE", name: "REB III Enterprises", role: "Technology" },
];

export default function AboutPage() {
  useDocumentMeta({
    title: "About — Tabs",
    description:
      "Tabs began with one campus and is building the operating system for every event, everywhere. Meet the team and the principles behind the platform.",
  });

  return (
    <main className="mkt-page mkt-about" role="main" aria-labelledby="about-title">
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Company</p>
        <header className="mkt-page__hero">
          <h1 id="about-title">
            We started with one campus. We're building the system for every event, everywhere.
          </h1>
          <p className="mkt-page__lede">
            Tabs began with a simple observation: the organizations running the most events — campuses,
            venues, restaurants, promoters — were the ones with the least connected tools to run them. So
            we built one platform to replace the five they were stitching together.
          </p>
        </header>

        <section className="mkt-section" aria-labelledby="about-history">
          <h2 id="about-history">How we got here.</h2>
          <p className="mkt-section__intro">
            Tabs started with Prairie View A&amp;M University as our first market — proof that if a platform
            can work for a campus running dozens of overlapping events a week, it can work for any organizer.
          </p>
          <h3>Houston-born, campus-tested</h3>
          <p>
            We built the first version of Tabs around a real, unglamorous problem: student organizations and
            campus departments had no shared system for promoting events, selling tickets, or knowing what
            actually worked. Our pilot at Prairie View A&amp;M's SGA Leadership Summit converted 84.7% of RSVPs
            into people who showed up — proof the model works before we ever tried to sell it anywhere else.
            From there, the same core platform expanded to serve venues, promoters, restaurants, and agencies
            who had the same problem at a different scale.
          </p>
          <p className="mkt-tag">Founded in Houston, Texas</p>
        </section>

        <section className="mkt-section" aria-labelledby="about-values">
          <h2 id="about-values">What we believe.</h2>
          <p className="mkt-section__intro">A few principles guide every product decision we make.</p>
          <div className="mkt-card-grid mkt-card-grid--3">
            {VALUES.map((v) => (
              <div className="mkt-card" key={v.title}>
                <span className="mkt-card__icon" style={{ background: v.grad }} aria-hidden="true" />
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section" aria-labelledby="about-leaders">
          <h2 id="about-leaders">Leadership &amp; advisors.</h2>
          <p className="mkt-section__intro">
            Tabs is built by a founding team backed by advisors across strategy, legal, creative, and technology.
          </p>
          <div className="mkt-leader-grid">
            {LEADERS.map((l) => (
              <div className="mkt-leader-card" key={l.name}>
                <span className="mkt-avatar" style={{ background: l.grad }} aria-hidden="true">{l.initials}</span>
                <div>
                  <h4>{l.name}</h4>
                  <div className="mkt-role">{l.role}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mkt-advisor-grid">
            {ADVISORS.map((a) => (
              <div className="mkt-advisor-card" key={a.name}>
                <span className="mkt-avatar mkt-avatar--sm" aria-hidden="true">{a.initials}</span>
                <div className="mkt-advisor-name">{a.name}</div>
                <div className="mkt-advisor-role">{a.role}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-closing" aria-labelledby="about-cta">
          <div className="mkt-closing__inner">
            <div>
              <h2 id="about-cta">Want to see the platform, or join the team?</h2>
              <p>Talk to our sales team, or check open roles below.</p>
            </div>
            <div className="mkt-closing__actions">
              <Link className="btn btn--primary" to="/contact">Talk to sales</Link>
              <Link className="btn btn--ghost" to="/careers">See open roles</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
