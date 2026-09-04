// Feature: tabs-homepage-redesign
//
// RestaurantsPage — "Solutions / Restaurants & Hospitality" secondary page.
// Copy from files-2/secondary-pages-copy.md. Route: /solutions/restaurants.

import React from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";

const PROBLEMS = [
  { title: "Off-peak nights stay empty", body: "A Tuesday trivia night or a Wednesday happy hour needs consistent promotion — not a one-off post that disappears in a day." },
  { title: "No way to cap or charge for a seat", body: "Ticketed dinners, tastings, and limited-seat events need real ticketing — not a sign-up sheet or a first-come-first-served door policy." },
  { title: "Regulars have no reason to come back", body: "Without a loyalty or coupon system tied to your events, a first-time guest at trivia night has no reason to become a regular." },
];

const FEATURES = [
  {
    title: "Promote every recurring event from one calendar",
    body: "Trivia, live music, brunch, tastings — publish them all as a running calendar guests can follow, instead of a new post every week that only reaches whoever's scrolling that day.",
    points: ["Recurring event series, not one-off posts", "Discoverable in the Tabs app, not just your own following"],
  },
  {
    title: "Sell tickets or reserve seats for limited events",
    body: "Cap a wine tasting at 40 seats, charge for a prix fixe night, or reserve tables for a live show — with real ticketing and QR check-in at the door.",
    points: ["Box office & QR check-in", "Set a cap so you never overbook a seated event"],
  },
  {
    title: "Turn first-timers into regulars",
    body: "Digital coupons, loyalty perks, and check-in challenges give guests a reason to come back for the next trivia night instead of a different bar.",
    points: ["Digital coupons & loyalty perks", "Check-in challenges & polls to keep the room engaged"],
  },
  {
    title: "See which nights are actually working",
    body: "Compare RSVPs, ticket sales, and check-in rates across every recurring event so you know which nights to keep, grow, or drop.",
    points: ["Attendance & revenue by event", "Compare performance week over week"],
  },
];

const PLANS = [
  { name: "Starter", price: "$187", suffix: "/mo", forWho: "A weekly event or two, one location", popular: false },
  { name: "Growth", price: "$563", suffix: "/mo", forWho: "Multiple recurring nights, building loyalty", popular: true },
];

export default function RestaurantsPage() {
  useDocumentMeta({
    title: "Restaurants & Hospitality — Tabs",
    description:
      "Turn slow nights into your busiest nights. Tabs gives restaurants and bars one place to promote recurring events, sell tickets, run loyalty, and see what works.",
  });

  return (
    <main className="mkt-page mkt-restaurants" role="main" aria-labelledby="rest-title">
      <div className="wrap">
        <p className="mkt-breadcrumb">Home / Solutions / Restaurants &amp; Hospitality</p>
        <header className="mkt-page__hero">
          <h1 id="rest-title">Turn your slow nights into your busiest nights.</h1>
          <p className="mkt-page__lede">
            Trivia nights, live music, tastings, happy hours, brunch pop-ups — Tabs gives restaurants and
            bars one place to promote them, sell tickets or reserve spots, run loyalty and coupons, and see
            which nights are actually working.
          </p>
          <div className="mkt-page__ctas">
            <Link className="btn btn--primary" to="/register">Join Tabs</Link>
            <Link className="btn btn--ghost" to="/#pricing">See pricing</Link>
          </div>
        </header>

        <section className="mkt-section" aria-labelledby="rest-problems">
          <h2 id="rest-problems">The problems this solves</h2>
          <p className="mkt-section__intro">
            Most restaurants promote events through whatever's fastest — an Instagram story, a table tent, a
            group text — and lose track of what worked.
          </p>
          <div className="mkt-card-grid mkt-card-grid--3">
            {PROBLEMS.map((p) => (
              <div className="mkt-card mkt-card--problem" key={p.title}>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section" aria-labelledby="rest-how">
          <h2 id="rest-how">How restaurants use Tabs</h2>
          <div className="mkt-feature-rows">
            {FEATURES.map((f, i) => (
              <div className="mkt-feature-row" key={f.title}>
                <div className="mkt-feature-row__num" aria-hidden="true">{i + 1}</div>
                <div className="mkt-feature-row__body">
                  <h3>{f.title}</h3>
                  <p>{f.body}</p>
                  <ul className="mkt-feature-row__points">
                    {f.points.map((pt) => (
                      <li key={pt}>{pt}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mkt-section" aria-labelledby="rest-pricing">
          <h2 id="rest-pricing">Where restaurants usually start.</h2>
          <p className="mkt-section__intro">
            Most single-location restaurants and bars start on Starter or Growth, depending on how many
            recurring nights they run.
          </p>
          <div className="mkt-card-grid mkt-card-grid--2">
            {PLANS.map((p) => (
              <div className={`mkt-plan${p.popular ? " mkt-plan--popular" : ""}`} key={p.name}>
                {p.popular && <span className="mkt-plan__badge">Most popular for restaurants</span>}
                <h3>{p.name}</h3>
                <p className="mkt-plan__price">
                  <span className="mkt-plan__amount">{p.price}</span>
                  <span className="mkt-plan__suffix">{p.suffix}</span>
                </p>
                <p className="mkt-plan__for">{p.forWho}</p>
                <Link className={`btn ${p.popular ? "btn--primary" : "btn--ghost"}`} to="/register">Join Tabs</Link>
              </div>
            ))}
          </div>
          <p className="mkt-footnote">
            Running more than one location? Ask about Enterprise for consolidated billing across your group.
          </p>
        </section>

        <section className="mkt-closing" aria-labelledby="rest-cta">
          <div className="mkt-closing__inner">
            <div>
              <h2 id="rest-cta">Ready to fill your slowest night on the calendar?</h2>
              <p>Talk to our team about the right plan for your restaurant or group.</p>
            </div>
            <div className="mkt-closing__actions">
              <Link className="btn btn--primary" to="/register">Join Tabs</Link>
              <Link className="btn btn--ghost" to="/contact">Talk to sales</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
