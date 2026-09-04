// Feature: tabs-homepage-redesign
//
// PricingPage — the standalone /pricing page, built from files-2/pricing.html.
// Plan prices are LIVE from the backend via usePlanData (same source as the
// homepage pricing section) so amounts never drift; the billing toggle switches
// the hook between monthly and yearly. The comparison table and FAQ are static
// structure from the design. Rendered inside MarketingLayout (nav + footer).

import React, { useState } from "react";
import { Link } from "react-router-dom";
import useDocumentMeta from "../hooks/useDocumentMeta";
import usePlanData from "../hooks/usePlanData";

const CheckIcon = () => (
  <svg className="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M5 13l4 4L19 7" />
  </svg>
);

// "For whom" line per plan level (design copy), keyed by plan name.
const PLAN_FOR = {
  Starter: "Independent organizers & small venues",
  Growth: "Recurring promoters & venues",
  Pro: "Festival producers & agencies",
  Enterprise: "Universities, cities & venue groups",
};

// Short highlight bullets per plan (design copy).
const PLAN_HIGHLIGHTS = {
  Starter: ["Events, ticketing & check-in", "Basic reporting", "6–12 events per year"],
  Growth: ["Promotion campaigns", "Advanced analytics", "Polls, coupons & check-in challenges"],
  Pro: ["Sponsor promotions & loyalty", "Raffles, trivia & leaderboards", "Full engagement suite"],
  Enterprise: ["Multiple locations & teams", "Governance & consolidated billing", "Contracted integrations"],
};

// Comparison table structure (design). Each row: label + per-plan cell values.
// `true` -> check, "—" -> dash, string -> literal text.
const COMPARE_GROUPS = [
  {
    group: "Core platform",
    rows: [
      { label: "Events & publishing", cells: [true, true, true, true] },
      { label: "Ticketing & box office", cells: [true, true, true, true] },
      { label: "QR check-in", cells: [true, true, true, true] },
      { label: "Events per year", cells: ["6–12", "Unlimited", "Unlimited", "Unlimited"] },
    ],
  },
  {
    group: "Analytics & promotion",
    rows: [
      { label: "Basic reporting", cells: [true, true, true, true] },
      { label: "Advanced analytics", cells: ["—", true, true, true] },
      { label: "Promotion campaigns", cells: ["—", true, true, true] },
    ],
  },
  {
    group: "Engagements",
    rows: [
      { label: "Polls & digital coupons", cells: ["—", true, true, true] },
      { label: "Raffles, trivia & leaderboards", cells: ["—", "—", true, true] },
      { label: "Sponsor promotions & loyalty", cells: ["—", "—", true, true] },
    ],
  },
  {
    group: "Scale & add-ons",
    rows: [
      { label: "Organizations & multi-location", cells: ["—", "—", "—", true] },
      { label: "AI Discovery", cells: ["Add-on", "Add-on", "Add-on", true] },
      { label: "Market Intelligence", cells: ["Add-on", "Add-on", "Add-on", true] },
      { label: "Support", cells: ["Email", "Priority email", "Dedicated success manager", "White-glove onboarding"] },
    ],
  },
];

const FAQS = [
  { q: "Can I change plans later?", a: "Yes. You can move up a plan as soon as you need more room, and the difference is prorated for the rest of your billing cycle." },
  { q: "Is there a setup fee?", a: "No setup fee on Starter, Growth, or Pro. Enterprise contracts are scoped individually based on integrations and onboarding needs." },
  { q: "Do you offer university or nonprofit pricing?", a: "Talk to our sales team — campus and nonprofit programs are usually scoped under Enterprise with pricing that reflects your size and season." },
  { q: "What happens if I go over my event limit on Starter?", a: "We'll reach out before you hit the ceiling to talk through upgrading to Growth, which includes unlimited events." },
  { q: "Can I cancel anytime?", a: "Monthly plans can be cancelled at the end of any billing cycle. Annual plans are billed upfront for the year — talk to sales about your options." },
];

const renderCell = (val) => {
  if (val === true) return <CheckIcon />;
  if (val === "—") return <span className="dash">—</span>;
  return val;
};

function PlanCards({ plans, status }) {
  if (status === "loading") {
    return (
      <div className="price-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((k) => (
          <div className="price-card price-card--skeleton" key={k}>
            <span className="pricing__skeleton pricing__skeleton--name" />
            <span className="pricing__skeleton pricing__skeleton--price" />
            <span className="pricing__skeleton pricing__skeleton--line" />
            <span className="pricing__skeleton pricing__skeleton--line" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="price-grid">
      {plans.map((plan) => {
        const highlights = PLAN_HIGHLIGHTS[plan.name] || [];
        const isBuyable = !plan.talkToSales && plan.price;
        return (
          <div
            className={`price-card${plan.popular ? " featured" : ""}`}
            key={plan.id}
            data-plan={plan.id}
          >
            {plan.popular && <div className="price-badge">Most popular</div>}
            <h3>{plan.name}</h3>
            <div className="amt">
              {plan.talkToSales || !plan.price ? (
                <span>Custom</span>
              ) : (
                <>
                  {plan.price}
                  <span className="cycle">{plan.priceSuffix}</span>
                </>
              )}
            </div>
            <div className="for">{PLAN_FOR[plan.name]}</div>
            <ul>
              {highlights.map((h) => (
                <li key={h}>
                  <CheckIcon />
                  {h}
                </li>
              ))}
            </ul>
            {isBuyable ? (
              <Link className={`btn ${plan.popular ? "btn--primary" : "btn--ghost"}`} to="/register">
                Get started
              </Link>
            ) : (
              <Link className="btn btn--ghost" to="/contact">
                Talk to sales
              </Link>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function PricingPage() {
  useDocumentMeta({
    title: "Pricing — Tabs",
    description:
      "Simple pricing that scales with you. Every plan includes the core platform — publishing, ticketing, box office, QR check-in, and reporting. Compare plans and start today.",
  });

  const [cycle, setCycle] = useState("monthly");
  const interval = cycle === "annual" ? "yearly" : "monthly";
  const { status, plans } = usePlanData(interval);
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="mkt-page mkt-pricing" role="main" aria-labelledby="pricing-title">
      <section className="mkt-pricing__hero">
        <div className="wrap" style={{ maxWidth: 640, marginInline: "auto", textAlign: "center" }}>
          <h1 id="pricing-title">Simple pricing that scales with you.</h1>
          <p className="mkt-page__lede" style={{ marginInline: "auto" }}>
            Every plan includes the core platform — publishing, ticketing, box office, QR check-in, and
            reporting. Upgrade as you run more events, not because we locked a feature behind a wall.
          </p>

          <div className="billing-toggle" role="group" aria-label="Billing cycle">
            <button
              type="button"
              className={cycle === "monthly" ? "active" : ""}
              aria-pressed={cycle === "monthly"}
              onClick={() => setCycle("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cycle === "annual" ? "active" : ""}
              aria-pressed={cycle === "annual"}
              onClick={() => setCycle("annual")}
            >
              Annual <span className="billing-save">Save 20%</span>
            </button>
          </div>
        </div>
      </section>

      <section className="mkt-pricing__cards">
        <div className="wrap">
          <PlanCards plans={plans} status={status} />

          <div className="addon-row">
            <div className="addon">
              <h4>AI Discovery</h4>
              <p>Add scheduled, supervised event discovery to any paid plan.</p>
            </div>
            <div className="addon">
              <h4>Market Intelligence</h4>
              <p>Recurring reporting contracts starting at $1,000/mo, scoped to your market.</p>
            </div>
          </div>
          <p className="price-note">
            Prices shown reflect current plan rates. Final quote confirmed by our team based on your plan
            and contract terms. Annual pricing reflects the yearly billing option.
          </p>
        </div>
      </section>

      <section className="mkt-pricing__compare">
        <div className="wrap">
          <div className="mkt-section-head">
            <h2>Compare plans in detail.</h2>
            <p>Every plan shares the same core platform. Here's exactly what's included at each level.</p>
          </div>
          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th>&nbsp;</th>
                  <th className="plan-col">Starter</th>
                  <th className="plan-col featured">Growth</th>
                  <th className="plan-col">Pro</th>
                  <th className="plan-col">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_GROUPS.map((grp) => (
                  <React.Fragment key={grp.group}>
                    <tr>
                      <td className="row-group-label" colSpan={5}>{grp.group}</td>
                    </tr>
                    {grp.rows.map((row) => (
                      <tr key={row.label}>
                        <td>{row.label}</td>
                        {row.cells.map((c, i) => (
                          <td key={i}>{renderCell(c)}</td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="mkt-pricing__faq">
        <div className="wrap">
          <div className="mkt-section-head">
            <h2>Pricing questions.</h2>
            <p>The most common things organizers ask before switching.</p>
          </div>
          <div className="mkt-faq">
            {FAQS.map((qa, i) => (
              <div className={`mkt-faq__item${openFaq === i ? " is-open" : ""}`} key={qa.q}>
                <button
                  type="button"
                  className="mkt-faq__q"
                  aria-expanded={openFaq === i}
                  onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                >
                  {qa.q}
                </button>
                {openFaq === i && <p className="mkt-faq__a">{qa.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mkt-closing" aria-labelledby="pricing-cta">
        <div className="mkt-closing__inner">
          <div>
            <h2 id="pricing-cta">Still not sure which plan fits?</h2>
            <p>Tell us what you're running and we'll point you to the right one.</p>
          </div>
          <div className="mkt-closing__actions">
            <Link className="btn btn--primary" to="/register">Get started</Link>
            <Link className="btn btn--ghost" to="/contact">Talk to sales</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
