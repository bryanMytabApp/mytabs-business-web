// Feature: tabs-homepage-redesign
//
// Static content model for the Marketing_Site Use_Case_Pages (one per customer
// segment). Keyed by URL-safe slug; the slugs match the Solutions_Mega_Menu
// entries in the NavigationBar and the `/solutions/:useCaseSlug` route.
//
// Each entry follows the design.md UseCaseContent shape:
//   {
//     slug: string,
//     segmentName: string,
//     problems: string[],
//     relevantProducts: string[],   // product/capability names for this segment
//     sections: [{ heading, body, mediaAlt? }],
//     seo: { title, description }
//   }
//
// The marketing copy is authored (not fetched); pricing is the only dynamic
// data on the Marketing_Site. Content is sourced from the Design_Document
// (Solutions mega-menu + Segments section) as the source of truth.
//
// _Requirements: 19.5, 21.2, 22.2_

/**
 * Ordered list of known use-case slugs. Kept in sync with the
 * Solutions_Mega_Menu entries so routing and navigation stay consistent.
 * @type {string[]}
 */
export const useCaseSlugs = [
  "venues-promoters",
  "hospitality-nightlife",
  "agencies",
  "universities",
  "tourism-cities",
];

/**
 * Per-segment content keyed by slug.
 * @type {Record<string, {
 *   slug: string,
 *   segmentName: string,
 *   problems: string[],
 *   relevantProducts: string[],
 *   sections: Array<{ heading: string, body: string, mediaAlt?: string }>,
 *   seo: { title: string, description: string }
 * }>}
 */
export const useCaseContent = {
  "venues-promoters": {
    slug: "venues-promoters",
    segmentName: "Venues & promoters",
    problems: [
      "Selling tickets across scattered tools with no single view of who is actually showing up.",
      "Filling rooms on off-peak nights and turning one-time buyers into a repeat crowd.",
      "Losing the door and box-office revenue that should stay in-house.",
      "No line of sight into which promoters, campaigns, and events actually drive attendance.",
    ],
    relevantProducts: [
      "Events",
      "Ticketing & Box Office",
      "Analytics",
      "Engagements",
      "Organizations",
    ],
    sections: [
      {
        heading: "Own every seat from on-sale to the door",
        body:
          "Publish events, sell tickets, and run the box office on one platform. Keeptabs replaces the patchwork of ticketing tabs, spreadsheets, and door lists with a single operating system so your team works from the same live picture on show night.",
        mediaAlt:
          "Keeptabs dashboard showing ticket sales and door check-in for a venue event",
      },
      {
        heading: "Turn attendance into a repeatable engine",
        body:
          "See RSVP-to-attendance, repeat visits, and revenue per event, then use engagements and promotions to bring the same crowd back on the nights you need to fill. Every campaign ties back to who walked through the door.",
        mediaAlt:
          "Analytics view of attendance and repeat-visit trends across a venue's events",
      },
      {
        heading: "Keep the revenue that belongs to you",
        body:
          "Ticketing, box office, and door sales run through your account, and organizations tooling lets multi-room operators and promoter teams manage it all under one roof with consolidated reporting.",
      },
    ],
    seo: {
      title: "Tabs for Venues & Promoters | Ticketing, Box Office & Attendance",
      description:
        "Keeptabs gives venues and promoters one platform for ticketing, box office, door check-in, and attendance analytics — so you fill rooms and keep the revenue in-house.",
    },
  },

  "hospitality-nightlife": {
    slug: "hospitality-nightlife",
    segmentName: "Hospitality & nightlife",
    problems: [
      "Quiet weeknights and unpredictable covers with no reliable way to drive traffic.",
      "Guest lists, reservations, and promotions living in disconnected apps and group chats.",
      "No loyalty loop to turn a big night into regulars who keep coming back.",
      "Little visibility into which nights, offers, and promoters actually move revenue.",
    ],
    relevantProducts: [
      "Events",
      "Ticketing & Box Office",
      "Engagements",
      "Analytics",
    ],
    sections: [
      {
        heading: "Program nights that people show up for",
        body:
          "Launch ticketed nights, entry packages, and reservations from one place. Keeptabs pulls guest lists, cover, and promotions together so hosts and door staff work from the same live list instead of a stack of screenshots.",
        mediaAlt:
          "Keeptabs mobile check-in view for a nightlife event guest list",
      },
      {
        heading: "Build a loyalty loop around your crowd",
        body:
          "Digital coupons, loyalty rewards, check-in challenges, and social features turn a packed night into regulars. Engagements keep guests coming back without another disconnected app.",
        mediaAlt:
          "Loyalty rewards and digital coupon screens for a hospitality venue",
      },
      {
        heading: "See what drives revenue night to night",
        body:
          "Track covers, spend signals, and which offers and promoters move the needle so you can double down on the nights and campaigns that work.",
      },
    ],
    seo: {
      title: "Tabs for Hospitality & Nightlife | Drive Traffic & Loyalty",
      description:
        "Keeptabs helps bars, clubs, and hospitality venues program ticketed nights, manage guest lists, and build loyalty — with clear analytics on what drives covers and revenue.",
    },
  },

  agencies: {
    slug: "agencies",
    segmentName: "Agencies",
    problems: [
      "Juggling events, ticketing, and reporting across many client accounts and disconnected tools.",
      "Rebuilding the same event, promotion, and analytics stack from scratch for every client.",
      "Proving campaign ROI to clients without a single source of attendance and revenue truth.",
      "No clean way to manage roles, access, and billing across a portfolio of clients.",
    ],
    relevantProducts: [
      "Events",
      "Ticketing & Box Office",
      "Analytics",
      "Engagements",
      "Organizations",
      "Market Intelligence",
    ],
    sections: [
      {
        heading: "Run every client on one operating system",
        body:
          "Manage events, ticketing, promotions, and reporting for all of your clients from a single platform. Organizations tooling gives each client its own space with roles, governance, and consolidated billing across the portfolio.",
        mediaAlt:
          "Organizations console showing multiple client accounts managed by an agency",
      },
      {
        heading: "Prove ROI with one source of truth",
        body:
          "Attendance, revenue, and engagement roll up per client and per campaign, so the numbers in your client report come straight from the platform — not a hand-built spreadsheet.",
        mediaAlt:
          "Cross-client analytics dashboard summarizing campaign performance",
      },
      {
        heading: "Scale delivery without scaling headcount",
        body:
          "Reusable event and engagement templates, plus market intelligence, let your team launch new client programs fast and advise with real market data behind them.",
      },
    ],
    seo: {
      title: "Tabs for Agencies | Multi-Client Events, Ticketing & Reporting",
      description:
        "Keeptabs lets agencies run events, ticketing, promotions, and reporting across every client from one platform — with roles, consolidated billing, and ROI you can prove.",
    },
  },

  universities: {
    slug: "universities",
    segmentName: "Universities",
    problems: [
      "Student orgs, departments, and campus life running events on a tangle of separate tools.",
      "Weak RSVP-to-attendance and no reliable read on engagement across campus.",
      "Hard to coordinate access, approvals, and reporting across many campus groups.",
      "Missing the data to show leadership which programs actually drive participation.",
    ],
    relevantProducts: [
      "Events",
      "Ticketing & Box Office",
      "Engagements",
      "Analytics",
      "Organizations",
    ],
    sections: [
      {
        heading: "One home for campus events",
        body:
          "Give student organizations, departments, and campus life a shared platform to publish events, manage RSVPs and tickets, and check students in. The Prairie View A&M SGA Leadership Summit hit 84.7% RSVP-to-attendance and $1,270 in revenue on Keeptabs.",
        mediaAlt:
          "Campus event page with RSVP and ticketing for a university student organization",
      },
      {
        heading: "Boost turnout and engagement",
        body:
          "Live polls, trivia, check-in challenges, and rewards drive participation before, during, and after events, turning flyers on a wall into measurable attendance.",
        mediaAlt:
          "Live polls and check-in challenge screens during a campus event",
      },
      {
        heading: "Coordinate every group with governance and reporting",
        body:
          "Organizations tooling lets campus administrators manage roles, approvals, and consolidated reporting across many student groups and departments from one console.",
      },
    ],
    seo: {
      title: "Tabs for Universities | Campus Events, RSVPs & Engagement",
      description:
        "Keeptabs gives universities one platform for campus events, ticketing, and engagement — proven to lift RSVP-to-attendance, with governance and reporting across every group.",
    },
  },

  "tourism-cities": {
    slug: "tourism-cities",
    segmentName: "Tourism & cities",
    problems: [
      "Local events and attractions scattered across sites with no single, trustworthy calendar.",
      "Hard to measure visitor attendance, spend, and the economic impact of programming.",
      "Coordinating many venues, districts, and partners without shared tooling or reporting.",
      "Limited market intelligence to plan programming and attract visitors year-round.",
    ],
    relevantProducts: [
      "Events",
      "Ticketing & Box Office",
      "Analytics",
      "Market Intelligence",
      "AI Discovery",
      "Organizations",
    ],
    sections: [
      {
        heading: "A single calendar for the whole destination",
        body:
          "Bring local events, attractions, and partner programming onto one platform so residents and visitors always find an accurate, up-to-date view of what's happening across the city.",
        mediaAlt:
          "City-wide events calendar aggregating venues and attractions for visitors",
      },
      {
        heading: "Measure attendance and economic impact",
        body:
          "Ticketing and analytics give tourism boards and cities real attendance and revenue data, so you can show the economic impact of programming instead of estimating it.",
        mediaAlt:
          "Dashboard summarizing visitor attendance and revenue across city events",
      },
      {
        heading: "Plan with market intelligence and coordinate partners",
        body:
          "AI Discovery and Market Intelligence surface where demand is heading, while organizations tooling lets you coordinate venues, districts, and partners with shared roles and consolidated reporting.",
      },
    ],
    seo: {
      title: "Tabs for Tourism & Cities | Destination Events & Impact",
      description:
        "Keeptabs helps tourism boards and cities unify local events on one calendar, measure attendance and economic impact, and plan with market intelligence across every partner.",
    },
  },
};

export default useCaseContent;
