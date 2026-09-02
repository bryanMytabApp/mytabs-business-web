// Auto-generated from mytabs-backend/serverless/common/pricing/pricingVersions.js
// DO NOT EDIT MANUALLY. Regenerate via:
//   node mytabs-backend/scripts/generate-frontend-pricing.js
//
// The BACKEND registry is the single source of truth. This is a minimal, display-only
// mirror of the pricing-version registry and cumulative plan product mix so the
// keeptabs Subscribe page can render plan names, prices, and included-feature lists.
// It carries NO Stripe ids and is never used for charging.

export const PLAN_LEVELS = ["Starter","Growth","Pro","Enterprise"];

// Cumulative plan → productId[] mix (each higher plan includes the lower).
export const planProductMix = {
  "Starter": [
    "profile",
    "events",
    "public_private_events",
    "calendar",
    "ticketing",
    "box_office",
    "qr_checkin",
    "basic_analytics"
  ],
  "Growth": [
    "profile",
    "events",
    "public_private_events",
    "calendar",
    "ticketing",
    "box_office",
    "qr_checkin",
    "basic_analytics",
    "promotion_campaigns",
    "advanced_analytics",
    "live_polls",
    "pulse_feedback",
    "surveys",
    "digital_coupons",
    "checkin_challenges"
  ],
  "Pro": [
    "profile",
    "events",
    "public_private_events",
    "calendar",
    "ticketing",
    "box_office",
    "qr_checkin",
    "basic_analytics",
    "promotion_campaigns",
    "advanced_analytics",
    "live_polls",
    "pulse_feedback",
    "surveys",
    "digital_coupons",
    "checkin_challenges",
    "sponsor_promotions",
    "loyalty_rewards",
    "scratch_offs",
    "instant_win",
    "raffles",
    "leaderboards",
    "prediction_challenges",
    "treasure_hunts",
    "trivia",
    "photo_contests",
    "social_wall"
  ],
  "Enterprise": [
    "profile",
    "events",
    "public_private_events",
    "calendar",
    "ticketing",
    "box_office",
    "qr_checkin",
    "basic_analytics",
    "promotion_campaigns",
    "advanced_analytics",
    "live_polls",
    "pulse_feedback",
    "surveys",
    "digital_coupons",
    "checkin_challenges",
    "sponsor_promotions",
    "loyalty_rewards",
    "scratch_offs",
    "instant_win",
    "raffles",
    "leaderboards",
    "prediction_challenges",
    "treasure_hunts",
    "trivia",
    "photo_contests",
    "social_wall",
    "multi_location",
    "org_admin",
    "roles_governance",
    "consolidated_billing"
  ]
};

// Product display names (id → human label).
export const PRODUCT_NAMES = {
  "profile": "Business Profile & Public Presence",
  "events": "Event Publishing",
  "public_private_events": "Public and Private Events",
  "calendar": "Calendar Management",
  "ticketing": "Ticketing",
  "box_office": "Box Office",
  "qr_checkin": "QR Check-In",
  "basic_analytics": "Basic Analytics",
  "promotion_campaigns": "Promotion Campaigns",
  "advanced_analytics": "Advanced Analytics & Audience Insights",
  "live_polls": "Live Polls",
  "pulse_feedback": "Pulse Feedback",
  "surveys": "Surveys",
  "digital_coupons": "Digital Coupons",
  "checkin_challenges": "Check-In Challenges",
  "sponsor_promotions": "Sponsor Promotions",
  "loyalty_rewards": "Loyalty & Rewards",
  "scratch_offs": "Digital Scratch-Offs",
  "instant_win": "Instant Win",
  "raffles": "Raffles",
  "leaderboards": "Leaderboards",
  "prediction_challenges": "Prediction Challenges",
  "treasure_hunts": "Treasure Hunts",
  "trivia": "Trivia Challenges",
  "photo_contests": "Photo Contests",
  "social_wall": "Social Wall",
  "multi_location": "Multiple Locations & Business Accounts",
  "org_admin": "Organization Administration",
  "roles_governance": "User Roles & Governance",
  "consolidated_billing": "Consolidated Reporting & Billing",
  "ai_discovery": "AI Discovery",
  "market_intel": "Market Intelligence"
};

// Minimal date-ordered registry mirror (display only; no Stripe ids).
export const pricingVersions = [
  {
    "effectiveDate": "2000-01-01",
    "expiryDate": "2026-09-06",
    "ticketFee": {
      "percent": 3,
      "perTicketCents": 100,
      "basis": "subtotal"
    },
    "aiDiscovery": {
      "model": "contract",
      "baselineCents": 28100,
      "interval": "month"
    },
    "marketIntel": {
      "model": "contract",
      "baselineCents": 1200000,
      "interval": "year"
    },
    "planMonthlyCents": {
      "Starter": 1399,
      "Growth": 1998,
      "Pro": 2498,
      "Enterprise": 99900
    }
  },
  {
    "effectiveDate": "2026-09-06",
    "expiryDate": "9999-12-31",
    "ticketFee": {
      "percent": 4,
      "perTicketCents": 89,
      "basis": "subtotal"
    },
    "aiDiscovery": {
      "model": "contract",
      "baselineCents": 28100,
      "interval": "month"
    },
    "marketIntel": {
      "model": "contract",
      "baselineCents": 1200000,
      "interval": "year"
    },
    "planMonthlyCents": {
      "Starter": 18700,
      "Growth": 56300,
      "Pro": 122100,
      "Enterprise": 281900
    }
  }
];

// Resolve the version in effect for a YYYY-MM-DD (or ISO) date. Mirrors the
// backend's END_OF_TIME semantics: any date >= the current version's effectiveDate
// resolves to it.
export function versionForDate(date) {
  const day = typeof date === "string" ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
  return pricingVersions.find((v) => v.effectiveDate <= day && day < v.expiryDate) || null;
}

// The version a NEW signup on `today` is pinned to (mirrors the backend's
// planForNewSubscription): simply the version effective on the signup date. The
// migration version's effectiveDate IS the go-live cutover (2026-09-06), so before
// then this resolves to the pre-migration version and on/after to the new one — the
// displayed prices always match what checkout will pin + charge.
export function versionForNewSignup(today = new Date()) {
  return versionForDate(today) || pricingVersions[pricingVersions.length - 1] || null;
}
