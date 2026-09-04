// Per-product content model for the Marketing_Site bespoke Product_Pages.
//
// Static, authored marketing copy keyed by URL-safe slug. Consumed by
// `ProductPage.jsx` (task 8.2) via `:productSlug` and by the NavigationBar
// Products mega-menu, which links to `/products/:slug`.
//
// Source of truth for product names/descriptions: the user-provided
// Design_Document HTML/CSS marketing copy (mirrored in the spec's
// requirements.md Req 4/5/7 and design.md). `offeredOnPlans` is derived from
// `planProductMix` in `src/config/pricingVersions.js` (productId -> plan names).
//
// Shape (see design.md -> Data Models -> ProductContent):
//   {
//     slug: string,
//     productName: string,
//     headline: string,
//     description: string,
//     sections: [{ heading, body, mediaAlt? }],
//     offeredOnPlans?: string[],
//     seo: { title, description }
//   }

import { planProductMix, PLAN_LEVELS } from "../../../config/pricingVersions";

/**
 * Return the plan names (in PLAN_LEVELS order) whose cumulative product mix
 * includes ANY of the supplied product ids. Because `planProductMix` is
 * cumulative (each higher plan includes the lower), this yields the set of
 * plans on which a marketing product is offered.
 *
 * @param {string[]} productIds product ids from pricingVersions `planProductMix`
 * @returns {string[]} ordered list of plan names (subset of PLAN_LEVELS)
 */
function plansIncludingAny(productIds) {
  const wanted = new Set(productIds);
  return PLAN_LEVELS.filter((plan) => {
    const mix = planProductMix[plan] || [];
    return mix.some((id) => wanted.has(id));
  });
}

// URL-safe slugs, aligned with the Products_Mega_Menu entries (Req 1.3, 19.6).
// Order matches the Design_Document product ordering.
export const PRODUCT_SLUGS = [
  "events",
  "ticketing",
  "analytics",
  "engagements",
  "market-intelligence",
  "ai-discovery",
  "organizations",
];

/**
 * Product content keyed by slug. Each entry follows the ProductContent shape.
 * `offeredOnPlans` is derived from `planProductMix` where the product maps to
 * one or more plan product ids; Contract_Products (AI Discovery, Market
 * Intelligence) are add-ons that are not part of any self-serve plan mix, so
 * they carry no `offeredOnPlans`.
 */
export const productContent = {
  events: {
    slug: "events",
    productName: "Events",
    headline: "Publish events people actually show up to.",
    subhead:
      "Events is the foundation of the Tabs platform. Every ticket sold, guest checked in, poll answered, and insight reported flows from the events you publish here — so the rest of the platform works from one shared source of truth instead of scattered tools.",
    description:
      "Create, schedule, and publish public and private events with a full calendar and a branded public presence. Events is the foundation of the Tabs platform — every ticket, check-in, and insight flows from the events you run.",
    problemsIntro:
      "When your events live across flyers, social posts, and spreadsheets, nothing connects — and nothing compounds.",
    problems: [
      {
        title: "Events disappear the moment you post them",
        body: "A single social post reaches whoever is scrolling that minute, then vanishes. There's no durable, followable home for what you're running.",
      },
      {
        title: "Public and private events need different handling",
        body: "An open community night and an invite-only VIP dinner have different rules, but most tools force you to run them the same way.",
      },
      {
        title: "Nothing carries over to the next step",
        body: "When the event isn't the hub, ticketing, check-in, and reporting all start from scratch with re-entered data.",
      },
    ],
    featureRows: [
      {
        heading: "Publish public and private events",
        body: "Open events to your whole audience for discovery and RSVPs, or keep them private and invite-only. Manage the full lifecycle from draft to published to sold out in one place.",
        points: [
          "Public, discoverable events and private invite-only events",
          "Draft-to-published workflow, not a one-way post",
          "Every event becomes the hub for its tickets, check-in, and data",
        ],
      },
      {
        heading: "Keep everything on a connected calendar",
        body: "A running calendar keeps every event, on-sale date, and door time organized, so your team and your audience always know what's next — and recurring nights become a series people can follow, not a weekly one-off.",
        points: [
          "Recurring series, not disposable posts",
          "On-sale dates and door times in one view",
          "Followable by your audience in the Tabs app",
        ],
      },
      {
        heading: "Show up with a branded public presence",
        body: "Each business gets a public profile that showcases its events, so discovery and RSVPs happen on a page that's unmistakably yours instead of a generic listing.",
        points: [
          "Business Profile & Public Presence for every organizer",
          "Discovery and RSVPs on your own branded page",
          "One presence across all of your events",
        ],
      },
    ],
    faq: [
      {
        q: "What's the difference between a public and private event?",
        a: "Public events are discoverable to the Tabs audience and open for RSVPs or ticket sales. Private events are invite-only and don't appear in public discovery — useful for VIP nights, member events, or internal gatherings.",
      },
      {
        q: "Do I need Events to use ticketing or analytics?",
        a: "Yes — Events is the foundation. Tickets, check-in, engagement, and reporting all attach to an event you've published, which is what keeps your data connected in one place.",
      },
      {
        q: "Which plans include Events?",
        a: "Event publishing, public and private events, and calendar management are part of the core platform and are included on every plan.",
      },
    ],
    offeredOnPlans: plansIncludingAny([
      "events",
      "public_private_events",
      "calendar",
    ]),
    seo: {
      title: "Events — Publish and manage events | Tabs",
      description:
        "Create, schedule, and publish public and private events with a connected calendar and branded public profile. The foundation of the Tabs platform.",
    },
  },

  ticketing: {
    slug: "ticketing",
    productName: "Ticketing & Box Office",
    headline: "Sell tickets and run the door, all in one platform.",
    subhead:
      "Most organizers run tickets through one tool, the guest list through another, and check-in on a clipboard. Tabs puts online ticketing, a live box office, and QR check-in in the same place your event is already published — so sales, seats, and arrivals all tie back to one source of truth.",
    description:
      "Sell tickets online, run a live box office, and check guests in with QR codes. Ticketing & Box Office turns every event into a smooth, sold-out night with revenue you can see in real time.",
    problemsIntro:
      "Disconnected ticketing is where money and time leak out of an event.",
    problems: [
      {
        title: "Sales live outside your event",
        body: "When tickets are sold on a separate platform, you re-key attendee lists, reconcile two dashboards, and never see one clean number for how the event is really doing.",
      },
      {
        title: "The door is chaos",
        body: "Paper lists and screenshots don't scale at entry. Lines back up, comps get argued at the door, and you can't tell in the moment how many people have actually arrived.",
      },
      {
        title: "No real-time read on revenue",
        body: "Without live sales and check-in in one view, you're guessing at walk-up demand, when to push promotion, and whether tonight is on pace.",
      },
    ],
    featureRows: [
      {
        heading: "Sell tickets online, tied to the event you published",
        body: "Create multiple ticket types and tiers, set prices and per-type caps, and open or close sales on your schedule. Every sale is attributed to the event automatically, so your attendee list and revenue are one dataset — not two exports you stitch together.",
        points: [
          "Multiple ticket types, tiers, and pricing",
          "Per-type quantity caps so you never oversell",
          "Sales tracked against the event, not a separate tool",
        ],
      },
      {
        heading: "Run a live box office on event night",
        body: "Sell and manage tickets at the door from the same system, at the pace event night demands. Handle walk-ups, issue and track comps, and keep the door total moving in step with your online sales.",
        points: [
          "Point-of-sale built for the door",
          "Walk-up sales and comps in one flow",
          "Door and online sales roll into the same totals",
        ],
      },
      {
        heading: "Check guests in with fast QR scanning",
        body: "Every ticket carries a QR code. Scan at entry to admit guests in seconds, prevent duplicate entry, and capture a real arrival count — which becomes the attendance data your reporting and RSVP-to-attendance rate are built on.",
        points: [
          "Fast QR check-in that keeps lines moving",
          "Duplicate-entry protection",
          "Live arrival counts feed your analytics",
        ],
      },
      {
        heading: "See sales and attendance in real time",
        body: "Watch tickets sold, revenue, and check-in rate update live as the night unfolds, then compare performance across every event to learn which ones to keep, grow, or drop.",
        points: [
          "Live tickets-sold and revenue",
          "Check-in rate as guests arrive",
          "Compare performance event over event",
        ],
      },
    ],
    faq: [
      {
        q: "What does Tabs charge per ticket?",
        a: "The current platform fee is 4% plus $0.89 per ticket on the sale subtotal. It's the same fee across the platform, with no separate ticketing contract to sign.",
      },
      {
        q: "Do I need separate ticketing software?",
        a: "No. Ticketing, box office, and QR check-in are built into the same platform where you publish the event, so there's no third-party ticketing tab to manage or reconcile.",
      },
      {
        q: "Can I sell free tickets or run RSVP-only events?",
        a: "Yes. You can run free RSVP events and paid ticketed events from the same tools, and both feed the same check-in and attendance data.",
      },
      {
        q: "Which plans include ticketing?",
        a: "Ticketing, box office, and QR check-in are part of the core platform and are included on every plan, from Starter up.",
      },
    ],
    offeredOnPlans: plansIncludingAny([
      "ticketing",
      "box_office",
      "qr_checkin",
    ]),
    seo: {
      title: "Ticketing & Box Office — Sell tickets and run the door | Tabs",
      description:
        "Sell tickets online, run a live box office, and check guests in with QR codes — all tied to the event you published. Real-time revenue and attendance from every event.",
    },
  },

  analytics: {
    slug: "analytics",
    productName: "Analytics",
    headline: "Know what's working before the night is over.",
    subhead:
      "Because ticketing and check-in run on the same platform as your events, Analytics reflects what actually happened — real RSVPs, real sales, real arrivals — not numbers you exported and stitched together by hand.",
    description:
      "See attendance, revenue, and audience insights across every event. Analytics starts with the essentials on every plan and grows into advanced audience insights as you scale.",
    problemsIntro:
      "You can't grow what you can't measure — and most organizers are flying blind between events.",
    problems: [
      {
        title: "RSVPs don't tell you who showed up",
        body: "A big RSVP count means nothing if half don't arrive. Without check-in data tied to the event, you can't tell interest from attendance.",
      },
      {
        title: "Revenue lives in a different tool",
        body: "When sales are on a separate platform, you never see attendance and revenue side by side for the same event.",
      },
      {
        title: "No way to compare event to event",
        body: "Without a consistent record across events, you can't tell which nights, formats, or promotions actually drive turnout.",
      },
    ],
    featureRows: [
      {
        heading: "Track the essentials on every event",
        body: "Basic Analytics comes on every plan: follow sales, RSVPs, and attendance for each event so you always know how it's performing without setting anything up.",
        points: [
          "Sales, RSVPs, and attendance per event",
          "Included on every plan from Starter up",
          "No setup — it's built from your live event data",
        ],
      },
      {
        heading: "Measure RSVP-to-attendance, for real",
        body: "Because QR check-in feeds Analytics directly, you get a true RSVP-to-attendance rate — the same metric that hit 84.7% in our Prairie View A&M case study — instead of a guess.",
        points: [
          "True attendance from QR check-in, not estimates",
          "RSVP-to-attendance conversion per event",
          "Live arrival counts as the night unfolds",
        ],
      },
      {
        heading: "Go deeper with advanced audience insights",
        body: "Advanced Analytics & Audience Insights reveal who shows up, what they respond to, and where your revenue really comes from — so you can program the next event with evidence.",
        points: [
          "Audience insights: who attends and what they respond to",
          "Revenue breakdowns across events",
          "Compare performance event over event",
        ],
      },
    ],
    faq: [
      {
        q: "What's included in Basic vs Advanced Analytics?",
        a: "Basic Analytics (sales, RSVPs, attendance per event) is included on every plan. Advanced Analytics & Audience Insights — deeper audience behavior and revenue analysis — is included from the Growth plan up.",
      },
      {
        q: "Where does the attendance data come from?",
        a: "From QR check-in at the door. Because ticketing and check-in are part of the same platform, every scan updates your analytics automatically — no manual attendance tracking.",
      },
      {
        q: "Can I compare multiple events?",
        a: "Yes. Analytics keeps a consistent record across every event so you can compare RSVPs, revenue, and check-in rates to see what to keep, grow, or drop.",
      },
    ],
    offeredOnPlans: plansIncludingAny(["basic_analytics", "advanced_analytics"]),
    seo: {
      title: "Analytics — Attendance, revenue, and audience insights | Tabs",
      description:
        "Measure attendance, revenue, and audience behavior across every event. Basic analytics on every plan, advanced insights as you grow.",
    },
  },

  engagements: {
    slug: "engagements",
    productName: "Engagements",
    headline: "Turn attendees into a crowd that comes back.",
    subhead:
      "Engagements is the widest product in the platform — a full suite of live interaction, rewards, and games that runs on the same events and attendee data as everything else, so every poll answered and prize won is tied to a real guest at a real event.",
    description:
      "Drive interaction before, during, and after your events with polls, surveys, coupons, loyalty rewards, and a full suite of gamified experiences. Engagements keeps your audience active and coming back.",
    problemsIntro:
      "Getting people in the door once is expensive. The return visit is where the margin is.",
    problems: [
      {
        title: "One-time guests don't come back",
        body: "Without a reason tied to your events, a first-time attendee has no incentive to choose you again over the next option.",
      },
      {
        title: "The room goes quiet",
        body: "Between the doors opening and the main moment, attention drifts. There's nothing keeping guests engaged and present.",
      },
      {
        title: "Sponsors want proof of engagement",
        body: "Sponsors pay for attention and activation, but most organizers can't show any interaction data to back up the value.",
      },
    ],
    featureRows: [
      {
        heading: "Run live interaction in the moment",
        body: "Live Polls, Pulse Feedback, Surveys, and Check-In Challenges keep attendees engaged during the event and hand you real-time feedback you can act on before the night ends.",
        points: [
          "Live Polls and Pulse Feedback during the event",
          "Surveys for structured feedback",
          "Check-In Challenges that reward showing up",
        ],
      },
      {
        heading: "Reward attendance and drive the return visit",
        body: "Digital Coupons, Loyalty & Rewards, Digital Scratch-Offs, and Instant Win give guests a concrete reason to come back for the next event instead of going elsewhere.",
        points: [
          "Digital Coupons and Loyalty & Rewards",
          "Digital Scratch-Offs and Instant Win offers",
          "Every reward tied to a real checked-in guest",
        ],
      },
      {
        heading: "Turn events into experiences with games",
        body: "Raffles, Leaderboards, Prediction Challenges, Treasure Hunts, Trivia Challenges, Photo Contests, and a Social Wall turn any event into something people talk about and share.",
        points: [
          "Raffles, Trivia, and Prediction Challenges",
          "Leaderboards, Treasure Hunts, and Photo Contests",
          "A Social Wall that surfaces the crowd's activity",
        ],
      },
      {
        heading: "Prove sponsor value with real activation",
        body: "Sponsor Promotions let approved sponsors show up inside the experiences your audience is already engaging with — and because it all runs on the platform, you can show the interaction it drove.",
        points: [
          "Sponsor Promotions inside live engagements",
          "Activation tied to real attendee interaction",
          "Engagement data to back up sponsor value",
        ],
      },
    ],
    faq: [
      {
        q: "Do I need a separate app for polls, trivia, or raffles?",
        a: "No. Every engagement runs inside the Tabs platform and mobile app your attendees already use, tied to the event they're attending.",
      },
      {
        q: "Which engagements come with which plan?",
        a: "Growth adds the live interaction and coupon layer (Live Polls, Pulse Feedback, Surveys, Digital Coupons, Check-In Challenges). Pro adds the full games and loyalty suite (Raffles, Leaderboards, Trivia, Loyalty & Rewards, Sponsor Promotions, and more).",
      },
      {
        q: "Can sponsors be featured in engagements?",
        a: "Yes. Sponsor Promotions let approved sponsors appear inside the experiences, and the engagement they drive is measurable so you can prove the value.",
      },
    ],
    offeredOnPlans: plansIncludingAny([
      "promotion_campaigns",
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
    ]),
    seo: {
      title: "Engagements — Polls, rewards, and gamified experiences | Tabs",
      description:
        "Keep audiences active with live polls, surveys, coupons, loyalty rewards, raffles, trivia, and more. Turn attendees into repeat fans.",
    },
  },

  "market-intelligence": {
    slug: "market-intelligence",
    productName: "Market Intelligence",
    headline: "See your market the way the winners do.",
    subhead:
      "Market Intelligence looks beyond your own events to the demand, pricing, and competition across your whole market. It's a contract product — scoped to your market and delivered by our team — not a self-serve dashboard, so talk to sales to tailor it.",
    description:
      "Market Intelligence is a contract product that gives operators a data-driven view of demand, pricing, and competition across their market. Priced by contract with a baseline reference — talk to sales to scope it for your organization.",
    problemsIntro:
      "Your own event data tells you what happened to you. It doesn't tell you what's happening in your market.",
    problems: [
      {
        title: "You're programming blind to the market",
        body: "Deciding what to run, when, and at what price is a guess when you can only see your own events and not the demand around them.",
      },
      {
        title: "Pricing is set by gut, not evidence",
        body: "Without a read on what the market will bear, tickets get underpriced or overpriced and revenue is left on the table.",
      },
      {
        title: "No decision-ready reporting for stakeholders",
        body: "Boards, sponsors, and city partners want defensible numbers about the market, not anecdotes from a single venue.",
      },
    ],
    featureRows: [
      {
        heading: "Understand market-wide demand and trends",
        body: "See where demand is heading across your market — beyond your own events — so you can plan programming with evidence instead of instinct.",
        points: [
          "Demand and trend signals across the market",
          "Context beyond your own event data",
          "Inputs for smarter programming and timing",
        ],
      },
      {
        heading: "Get decision-ready, recurring reporting",
        body: "Recurring reporting is delivered on a schedule, scoped to your market and the questions you actually need answered — the kind of reporting venues, universities, tourism offices, and brands use to make programming calls.",
        points: [
          "Recurring, scheduled reporting",
          "Scoped to your market and questions",
          "Built for boards, sponsors, and partners",
        ],
      },
      {
        heading: "A revenue engine, not just a dashboard",
        body: "Market Intelligence is one of the five Tabs revenue engines — turning platform-wide data into decisions that grow revenue, delivered as a contract engagement with our team.",
        points: [
          "One of the five Tabs revenue engines",
          "Delivered as a scoped contract engagement",
          "Baseline reference pricing; final scope by quote",
        ],
      },
    ],
    faq: [
      {
        q: "Is Market Intelligence self-serve?",
        a: "No. It's a contract product scoped to your market and delivered by our team, with a baseline reference price. Talk to sales to scope it for your organization.",
      },
      {
        q: "How is it priced?",
        a: "It carries a baseline reference (starting around $12,000/year) and is quoted based on your market and the scope of reporting you need.",
      },
      {
        q: "Who is it for?",
        a: "Venues, universities, tourism offices, cities, and brands that make programming and pricing decisions and need a defensible view of their market.",
      },
    ],
    seo: {
      title: "Market Intelligence — Market-wide demand and pricing data | Tabs",
      description:
        "A contract product giving operators a data-driven view of demand, pricing, and competition across their market. Talk to sales to scope it.",
    },
  },

  "ai-discovery": {
    slug: "ai-discovery",
    productName: "AI Discovery",
    headline: "Fill your calendar without the manual data entry.",
    subhead:
      "AI Discovery is a scheduled, supervised assistant that finds event information from trusted sources and drafts entries for your review — so your calendar stays full without a person copy-pasting listings all day. It's a contract add-on, not a self-serve toggle.",
    description:
      "AI Discovery is a contract product that runs a scheduled, supervised assistant to find event information and draft entries for your review, keeping your calendar full without manual sourcing. Priced by contract with a baseline reference — talk to sales to get started.",
    problemsIntro:
      "For anyone who curates a calendar of other people's events, keeping it current is a full-time, thankless job.",
    problems: [
      {
        title: "Manual event sourcing never ends",
        body: "Someone has to keep finding, copying, and formatting event listings from dozens of sources — and the calendar is stale the moment they stop.",
      },
      {
        title: "Coverage gaps make you less useful",
        body: "Miss a few events and your calendar stops being the place people trust to see everything happening.",
      },
      {
        title: "Full automation is risky",
        body: "Blindly auto-publishing scraped events puts errors and junk in front of your audience with no human check.",
      },
    ],
    featureRows: [
      {
        heading: "Discover events from trusted sources on a schedule",
        body: "A supervised assistant runs on a schedule to find event information from the sources you approve, so your calendar keeps filling itself in the background.",
        points: [
          "Scheduled, automated sourcing",
          "Runs against sources you approve",
          "Keeps a curated calendar current without manual work",
        ],
      },
      {
        heading: "Draft entries for your review — you stay in control",
        body: "Instead of auto-publishing, AI Discovery drafts entries for a human to review and approve. Supervised by design, so nothing goes live without your say.",
        points: [
          "Drafts for review, not blind auto-publish",
          "Human approval before anything is published",
          "Supervised sourcing that protects your audience",
        ],
      },
      {
        heading: "Built on your platform data",
        body: "Because it runs inside Tabs, drafted events land right in the same calendar, ticketing, and analytics as everything else — no separate import step.",
        points: [
          "Drafts flow into your Tabs calendar",
          "Same events, ticketing, and analytics pipeline",
          "Contract add-on with baseline reference pricing",
        ],
      },
    ],
    faq: [
      {
        q: "Does AI Discovery publish events automatically?",
        a: "No — it's supervised. It drafts entries from trusted sources and a human reviews and approves them before anything goes live.",
      },
      {
        q: "Is it self-serve or a contract product?",
        a: "It's a contract add-on with a baseline reference (around $281/month) rather than a self-serve toggle. Talk to sales to scope and enable it.",
      },
      {
        q: "Who benefits most from AI Discovery?",
        a: "Organizations that curate calendars of many events — universities, cities, tourism offices, and agencies — where manual sourcing is a constant burden.",
      },
    ],
    seo: {
      title: "AI Discovery — Supervised, scheduled event sourcing | Tabs",
      description:
        "A contract add-on that finds event information from trusted sources and drafts entries for your review, keeping your calendar full without manual sourcing.",
    },
  },

  organizations: {
    slug: "organizations",
    productName: "Organizations",
    headline: "Run many locations and teams from one console.",
    subhead:
      "Organizations is the layer for operators who are past a single account — venue groups, restaurant groups, agencies managing clients, universities coordinating departments. It puts every business account, role, and bill under one console without losing per-location control.",
    description:
      "Organizations gives multi-location operators a single console to manage business accounts, administration, user roles and governance, and consolidated reporting and billing across the whole organization.",
    problemsIntro:
      "One account works until you have five. Then coordination, access, and billing become the real problem.",
    problems: [
      {
        title: "Every location is its own island",
        body: "Separate logins per venue or brand mean no shared view, duplicated setup, and no way to compare performance across the group.",
      },
      {
        title: "Access control is a liability",
        body: "Without real roles and governance, the wrong people have the wrong access — or everyone shares one login.",
      },
      {
        title: "Billing and reporting are a monthly scramble",
        body: "Reconciling separate invoices and reports across locations eats time and hides the organization-wide picture leadership needs.",
      },
    ],
    featureRows: [
      {
        heading: "Manage every location and business account in one place",
        body: "Bring every venue, brand, or business account under one organization, with a clear view across all of them and shared setup instead of rebuilding per location.",
        points: [
          "Multiple Locations & Business Accounts",
          "One organization-wide view",
          "Shared setup across locations",
        ],
      },
      {
        heading: "Control access with roles and governance",
        body: "Organization Administration with User Roles & Governance keeps the right people in the right permissions across teams and locations — no shared logins, no over-broad access.",
        points: [
          "Organization Administration",
          "User Roles & Governance across teams",
          "Least-privilege access, not shared logins",
        ],
      },
      {
        heading: "Consolidate reporting and billing",
        body: "Roll reporting and billing up across every location so leadership sees the whole picture and pays in one place instead of reconciling a stack of invoices.",
        points: [
          "Consolidated Reporting & Billing",
          "Organization-wide performance view",
          "One bill instead of many",
        ],
      },
    ],
    faq: [
      {
        q: "Who is Organizations for?",
        a: "Operators running more than one location, brand, department, or client account — venue groups, restaurant groups, agencies, and universities — that need central control with per-location detail.",
      },
      {
        q: "Which plan includes Organizations?",
        a: "The Organizations console (multi-location, administration, roles & governance, and consolidated reporting & billing) is part of the Enterprise plan.",
      },
      {
        q: "Can each location still run independently?",
        a: "Yes. Each business account keeps its own events and day-to-day operation; Organizations adds the shared console, governance, and consolidated billing on top.",
      },
    ],
    offeredOnPlans: plansIncludingAny([
      "multi_location",
      "org_admin",
      "roles_governance",
      "consolidated_billing",
    ]),
    seo: {
      title: "Organizations — Multi-location console for teams | Tabs",
      description:
        "Manage multiple locations, user roles and governance, and consolidated reporting and billing from one Organizations console. Built for scale.",
    },
  },
};

export default productContent;
