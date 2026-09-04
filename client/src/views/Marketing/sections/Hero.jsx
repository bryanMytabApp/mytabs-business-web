// Feature: tabs-homepage-redesign
//
// Hero — the Hero_Section at the top of the Homepage (Requirement 2).
//
// Ports the Design_Document hero closely: the exact headline + lede, the
// gradient blob backdrop, and the Animated_Mockup — a realistic browser
// dashboard (RSVP / ticket / check-in stat chips + named event rows + icon
// sidebar) plus a phone "Discover" feed. Float animation is gated by
// `useReducedMotion` (Req 2.7, 2.8, 15.4). Mockups are pure CSS/markup, so the
// asset-failure case is N/A (Req 2.6); `handleMockupImageError` remains for any
// future real <img>.
//
// _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 15.4_

import React from "react";
import { Link } from "react-router-dom";

import useReducedMotion from "../hooks/useReducedMotion";
import tabsLogo from "../../../assets/Logo No Shaddow Big.png";

/** Headline text. Rendered with a line break before "Keep them" (see render). */
export const HERO_HEADLINE = "Fill your calendar. Sell every seat. Keep them coming back.";

/** The headline split at the intended line break so "Keep them coming back."
    starts on its own line. */
export const HERO_HEADLINE_LINE_1 = "Fill your calendar. Sell every seat.";
export const HERO_HEADLINE_LINE_2 = "Keep them coming back.";

/** Dashboard URL shown in the mockup browser bar (matches the Design_Document). */
export const MOCKUP_URL = "app.keeptabs.io/dashboard";

/** Primary_CTA — routes to the registration page (Req 2.3, 2.4). */
export const PRIMARY_CTA = { label: "Get started", to: "/register" };

/** Secondary_CTA — in-page anchor to the platform/products overview (Req 2.3, 2.4). */
export const SECONDARY_CTA = { label: "See pricing", to: "/pricing" };

/** Exact lede copy from the Design_Document (Req 2.2). */
export const HERO_LEDE =
  "The all-in-one platform for venues, promoters, and restaurants — publish " +
  "events, sell tickets, run the door, engage attendees, and see what worked, " +
  "all in one place.";

/** Dashboard KPI chips shown in the browser mockup (Design_Document values). */
const STAT_CHIPS = [
  { value: "4,812", label: "RSVPs" },
  { value: "$18.2k", label: "Ticket sales" },
  { value: "92%", label: "Check-in rate" },
];

/** Event rows shown in the browser mockup (Design_Document content). */
const EVENT_ROWS = [
  { thumb: "linear-gradient(135deg,var(--cyan),var(--teal))", title: "Homecoming Tailgate", meta: "Sat · Lot C · 1,204 going" },
  { thumb: "linear-gradient(135deg,var(--amber),var(--orange))", title: "Late Night Trivia", meta: "Thu · The Yard · 340 going" },
  { thumb: "linear-gradient(135deg,#8fd3e8,var(--teal))", title: "Sponsor Showcase", meta: "Fri · Main Hall · 612 going" },
];

/** Phone "Discover" feed cards (Design_Document content). */
const PHONE_CARDS = [
  { img: "linear-gradient(135deg,var(--orange),var(--amber))", title: "Block Party at POST", meta: "Tonight · 8:00 PM" },
  { img: "linear-gradient(135deg,var(--cyan),var(--teal))", title: "Alumni Tailgate", meta: "Sat · Lot C" },
];

export function handleMockupImageError(event) {
  const img = event && event.currentTarget;
  if (!img) return;
  img.style.visibility = "hidden";
  const region = img.closest(".marketing-hero__mockup-region");
  if (region) region.setAttribute("data-asset-failed", "true");
}

/** Realistic browser dashboard mockup (decorative, hidden from AT — Req 15.2). */
function BrowserMockup() {
  return (
    <div className="marketing-hero__browser" aria-hidden="true">
      <div className="marketing-hero__browser-bar">
        <span className="marketing-hero__dot" />
        <span className="marketing-hero__dot" />
        <span className="marketing-hero__dot" />
        <span className="marketing-hero__url">{MOCKUP_URL}</span>
      </div>
      <div className="marketing-hero__browser-body">
        <div className="marketing-hero__browser-sidebar">
          <span className="marketing-hero__side-icon is-active" />
          <span className="marketing-hero__side-icon" />
          <span className="marketing-hero__side-icon" />
          <span className="marketing-hero__side-icon" />
        </div>
        <div className="marketing-hero__browser-content">
          <div className="marketing-hero__stat-row">
            {STAT_CHIPS.map((chip) => (
              <div className="marketing-hero__stat-chip" key={chip.label}>
                <div className="marketing-hero__stat-num">{chip.value}</div>
                <div className="marketing-hero__stat-lbl">{chip.label}</div>
              </div>
            ))}
          </div>
          {EVENT_ROWS.map((ev) => (
            <div className="marketing-hero__ev-row" key={ev.title}>
              <span
                className="marketing-hero__ev-thumb"
                style={{ background: ev.thumb }}
              />
              <span className="marketing-hero__ev-text">
                <span className="marketing-hero__ev-title">{ev.title}</span>
                <span className="marketing-hero__ev-meta">{ev.meta}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Phone "Discover" mockup (decorative, hidden from AT — Req 15.2). */
function PhoneMockup() {
  return (
    <div className="marketing-hero__phone" aria-hidden="true">
      <div className="marketing-hero__phone-screen">
        <div className="marketing-hero__phone-status">
          <span>9:41</span>
          <span>●●●</span>
        </div>
        <div className="marketing-hero__phone-head">Discover</div>
        {PHONE_CARDS.map((card) => (
          <div className="marketing-hero__phone-card" key={card.title}>
            <div className="marketing-hero__phone-card-img" style={{ background: card.img }} />
            <div className="marketing-hero__phone-card-body">
              <div className="marketing-hero__phone-card-title">{card.title}</div>
              <div className="marketing-hero__phone-card-meta">{card.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();

  const mockupClassName = [
    "marketing-hero__mockup-region",
    prefersReducedMotion ? "is-static" : "is-animated",
  ].join(" ");

  return (
    <section className="marketing-hero" aria-labelledby="marketing-hero-heading">
      <div className="marketing-hero__blob" aria-hidden="true" />
      <div className="marketing-hero__inner">
        <div className="marketing-hero__copy">
          <img
            src={tabsLogo}
            alt=""
            aria-hidden="true"
            className="marketing-hero__logo"
          />
          <h1 id="marketing-hero-heading" className="marketing-hero__headline">
            {HERO_HEADLINE_LINE_1}{" "}
            <br />
            {HERO_HEADLINE_LINE_2}
          </h1>
          <p className="marketing-hero__lede">{HERO_LEDE}</p>
          <div className="marketing-hero__ctas">
            <Link
              className="marketing-hero__cta marketing-hero__cta--primary"
              to={PRIMARY_CTA.to}
            >
              {PRIMARY_CTA.label}
            </Link>
            <Link
              className="marketing-hero__cta marketing-hero__cta--secondary"
              to={SECONDARY_CTA.to}
            >
              {SECONDARY_CTA.label}
            </Link>
          </div>
        </div>

        <div className={mockupClassName}>
          <BrowserMockup />
          <PhoneMockup />
        </div>
      </div>
    </section>
  );
}
