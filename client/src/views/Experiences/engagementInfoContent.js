// Engagement info content — shown in the LockedEngagementModal when a business
// clicks a locked engagement in the Experience/Engagement Catalog.
//
// Keyed by the catalog `typeId` (hyphenated, matching the backend
// mytabs-backend/lambda-experienceCore/handlers/catalogHandlers.js EXPERIENCE_TYPES).
// Each entry provides:
//   - title:       display name (mirrors the catalog name)
//   - tagline:     one-line summary of what it is
//   - value:       why it's valuable to the business (the "sell")
//   - howItWorks:  short ordered steps describing how it works
//   - media:       path to an ANIMATED how-it-works asset (GIF/MP4/webp).
//                  Generated via Magnific and dropped at this path; the modal
//                  falls back to a static illustration when the file is absent.
//
// The asset convention is `/assets/engagements/<typeId>.gif` served from the
// app's public/ dir (public/assets/engagements/<typeId>.gif), so newly added
// media renders automatically with no code change.

export const ENGAGEMENT_MEDIA_BASE = "/assets/engagements";

/** Media URL for an engagement typeId (single animated how-it-works asset). */
export const engagementMediaUrl = (typeId) =>
  typeId ? `${ENGAGEMENT_MEDIA_BASE}/${typeId}.gif` : null;

// Ordered "how it works" SLIDES per engagement typeId — real product screenshots
// captured from the app and shown as an auto-advancing carousel in the modal.
// Path convention: /assets/engagements/<typeId>/<n>.png (1-based). List only the
// slides that actually exist; engagements with no slides fall back to the single
// GIF (engagementMediaUrl) and then to the "preview coming soon" placeholder.
export const ENGAGEMENT_SLIDES = {
  // Raffles has two real app screenshots (Event Engagements + Catalog) plus a
  // Magnific illustration as the third slide.
  raffles: [
    `${ENGAGEMENT_MEDIA_BASE}/raffles/1.png`,
    `${ENGAGEMENT_MEDIA_BASE}/raffles/2.png`,
    `${ENGAGEMENT_MEDIA_BASE}/raffles/3.png`,
  ],
  // Every other engagement has one Magnific illustration slide.
  "live-polls": [`${ENGAGEMENT_MEDIA_BASE}/live-polls/1.png`],
  "trivia-challenges": [`${ENGAGEMENT_MEDIA_BASE}/trivia-challenges/1.png`],
  "prediction-challenges": [`${ENGAGEMENT_MEDIA_BASE}/prediction-challenges/1.png`],
  surveys: [`${ENGAGEMENT_MEDIA_BASE}/surveys/1.png`],
  "pulse-feedback": [`${ENGAGEMENT_MEDIA_BASE}/pulse-feedback/1.png`],
  "instant-win": [`${ENGAGEMENT_MEDIA_BASE}/instant-win/1.png`],
  "digital-scratch-offs": [`${ENGAGEMENT_MEDIA_BASE}/digital-scratch-offs/1.png`],
  "treasure-hunts": [`${ENGAGEMENT_MEDIA_BASE}/treasure-hunts/1.png`],
  "check-in-challenges": [`${ENGAGEMENT_MEDIA_BASE}/check-in-challenges/1.png`],
  "photo-contests": [`${ENGAGEMENT_MEDIA_BASE}/photo-contests/1.png`],
  "social-wall": [`${ENGAGEMENT_MEDIA_BASE}/social-wall/1.png`],
  "digital-coupons": [`${ENGAGEMENT_MEDIA_BASE}/digital-coupons/1.png`],
  "sponsor-promotions": [`${ENGAGEMENT_MEDIA_BASE}/sponsor-promotions/1.png`],
  "loyalty-rewards": [`${ENGAGEMENT_MEDIA_BASE}/loyalty-rewards/1.png`],
  leaderboards: [`${ENGAGEMENT_MEDIA_BASE}/leaderboards/1.png`],
};

/** Ordered slide URLs for an engagement typeId (empty array if none captured). */
export const engagementSlides = (typeId) =>
  (typeId && ENGAGEMENT_SLIDES[typeId]) || [];

export const ENGAGEMENT_INFO = {
  raffles: {
    title: "Raffles",
    tagline: "Run prize giveaways attendees actually enter.",
    value:
      "Raffles turn attention into action. Offer a prize and attendees give you their entry — growing your list, rewarding attendance, and giving sponsors a measurable activation with a provably fair winner selection.",
    howItWorks: [
      "Set the prize, entry rules, and drawing schedule.",
      "Attendees enter from their phone during the event.",
      "Draw a winner with a fair, verifiable selection.",
      "Fulfill the prize and share the results.",
    ],
  },
  "live-polls": {
    title: "Live Polls",
    tagline: "Ask the room and see answers in real time.",
    value:
      "Live Polls keep the crowd engaged and hand you instant feedback you can act on before the moment passes — great for breaking the ice, guiding a program, or making attendees feel heard.",
    howItWorks: [
      "Create a question with a few options.",
      "Open the poll; attendees vote from their phones.",
      "Watch results update live on screen.",
      "Close the poll and keep the results.",
    ],
  },
  "trivia-challenges": {
    title: "Trivia Challenges",
    tagline: "Turn downtime into a competitive game.",
    value:
      "Trivia energizes a room and rewards the people paying attention. Timed questions and a live leaderboard drive participation and give sponsors a fun place to show up.",
    howItWorks: [
      "Build a set of timed questions and answers.",
      "Reveal each question to the room.",
      "Attendees answer against the clock.",
      "A live leaderboard ranks the top players.",
    ],
  },
  "prediction-challenges": {
    title: "Prediction Challenges",
    tagline: "Let attendees predict outcomes and earn points.",
    value:
      "Predictions create suspense and keep attendees invested through the whole event — they come back to see if they were right, and you get an engaged, returning audience.",
    howItWorks: [
      "Open a market with possible outcomes.",
      "Attendees lock in their predictions before the deadline.",
      "Resolve the market with the actual outcome.",
      "Points and standings update automatically.",
    ],
  },
  surveys: {
    title: "Surveys",
    tagline: "Collect structured feedback that guides your next event.",
    value:
      "Surveys give you the honest, structured input to program better — what worked, what didn't, and what your audience wants next — all tied to the event they attended.",
    howItWorks: [
      "Build a multi-question survey form.",
      "Share it during or after the event.",
      "Attendees submit their responses.",
      "Review and export the results.",
    ],
  },
  "pulse-feedback": {
    title: "Pulse Feedback",
    tagline: "Capture quick sentiment in the moment.",
    value:
      "Pulse Feedback reads the room in real time with a single tap, so you can adjust on the fly and prove attendee sentiment to partners and sponsors.",
    howItWorks: [
      "Set up a quick reaction prompt.",
      "Attendees tap a sentiment throughout the event.",
      "See sentiment trend live.",
      "Use it to steer the program in the moment.",
    ],
  },
  "instant-win": {
    title: "Instant Win",
    tagline: "Instant-reveal prizes with configurable win rates.",
    value:
      "Instant Win delivers a dopamine hit that drives participation and repeat plays, with win rates and inventory you control — a proven way to boost engagement and sponsor value.",
    howItWorks: [
      "Configure prizes, win rate, and inventory.",
      "Attendees play and reveal instantly.",
      "Winners are recorded and fulfilled.",
      "Track plays, wins, and remaining inventory.",
    ],
  },
  "digital-scratch-offs": {
    title: "Digital Scratch-Offs",
    tagline: "Interactive scratch-off cards with tiered prizes.",
    value:
      "Scratch-offs bring a familiar, tactile game to your event — high participation, tiered prize pools, and a branded surface sponsors love to own.",
    howItWorks: [
      "Design the card and tiered prize pool.",
      "Attendees scratch to reveal on their phone.",
      "Prizes are awarded by tier.",
      "Fulfillment and inventory are tracked for you.",
    ],
  },
  "treasure-hunts": {
    title: "Treasure Hunts",
    tagline: "QR-based scavenger hunts across your venue.",
    value:
      "Treasure Hunts move people through your space and drive traffic to specific booths or sponsors — turning a passive crowd into active explorers.",
    howItWorks: [
      "Place QR checkpoints around your venue.",
      "Attendees scan each checkpoint to progress.",
      "Track claims and completion in real time.",
      "Reward the attendees who finish.",
    ],
  },
  "check-in-challenges": {
    title: "Check-In Challenges",
    tagline: "Reward attendees for showing up.",
    value:
      "Check-In Challenges reward attendance at specific sessions or locations, boosting turnout where you need it and giving sponsors a reason to host a stop.",
    howItWorks: [
      "Define the check-in locations or sessions.",
      "Attendees check in via QR at each point.",
      "Progress is tracked automatically.",
      "Reward attendees who complete the challenge.",
    ],
  },
  "photo-contests": {
    title: "Photo Contests",
    tagline: "Photo submissions with community voting.",
    value:
      "Photo Contests generate user content and social buzz around your event, with community voting that keeps attendees coming back to check the standings.",
    howItWorks: [
      "Open the contest with a theme and rules.",
      "Attendees submit photos from their phones.",
      "The community votes on entries.",
      "Award winners and showcase the best shots.",
    ],
  },
  "social-wall": {
    title: "Social Wall",
    tagline: "A live feed of attendee posts on screen.",
    value:
      "The Social Wall puts your crowd's energy on the big screen — a live, moderated feed of posts and photos that amplifies engagement and gives sponsors premium visibility.",
    howItWorks: [
      "Enable the wall for your event.",
      "Attendees post photos and messages.",
      "Moderate submissions before they display.",
      "Approved posts appear live on screen.",
    ],
  },
  "digital-coupons": {
    title: "Digital Coupons",
    tagline: "Redeemable coupons for vendors and sponsors.",
    value:
      "Digital Coupons drive real transactions at your event — attendees claim and redeem offers on their phones, and you can prove redemption value to the vendors and sponsors who fund them.",
    howItWorks: [
      "Create coupons with limits and rules.",
      "Attendees claim coupons on their phones.",
      "Redeem at the vendor or sponsor.",
      "Track claims and redemptions.",
    ],
  },
  "sponsor-promotions": {
    title: "Sponsor Promotions",
    tagline: "Branded sponsor offers inside the experience.",
    value:
      "Sponsor Promotions put approved sponsor content in front of an already-engaged audience — a high-margin revenue line with measurable engagement to back up the value.",
    howItWorks: [
      "Add a sponsor's branded offer or content.",
      "Display it inside your live engagements.",
      "Attendees engage with the promotion.",
      "Report the engagement it drove.",
    ],
  },
  "loyalty-rewards": {
    title: "Loyalty & Rewards",
    tagline: "Point-based programs that reward repeat visits.",
    value:
      "Loyalty & Rewards turns one-time attendees into regulars — points for attendance and engagement, redeemable for rewards, with a tier system that keeps people coming back.",
    howItWorks: [
      "Define how attendees earn points.",
      "Attendees accrue points across events.",
      "They redeem points for rewards.",
      "Track members, points, and redemptions.",
    ],
  },
  leaderboards: {
    title: "Leaderboards",
    tagline: "Ranked standings across your experiences.",
    value:
      "Leaderboards add competition that spans your whole event — attendees chase the top spot across challenges, driving sustained engagement and repeat participation.",
    howItWorks: [
      "Enable a leaderboard across your engagements.",
      "Attendees earn points by participating.",
      "Standings update in real time.",
      "Recognize and reward the leaders.",
    ],
  },
};

/**
 * Resolve the info content for an engagement typeId. Falls back to a generic
 * entry (using the provided catalog name/description) so an unknown/new type
 * still renders a coherent modal.
 *
 * @param {string} typeId - hyphenated catalog type id
 * @param {object} [fallback] - { name, description } from the catalog entry
 */
export const getEngagementInfo = (typeId, fallback = {}) => {
  const base = ENGAGEMENT_INFO[typeId];
  if (base) {
    return { ...base, typeId, media: engagementMediaUrl(typeId), slides: engagementSlides(typeId) };
  }
  return {
    typeId,
    title: fallback.name || "Engagement",
    tagline: fallback.description || "Interactive engagement for your event.",
    value:
      fallback.description ||
      "An interactive experience you can run for your attendees.",
    howItWorks: [],
    media: engagementMediaUrl(typeId),
    slides: engagementSlides(typeId),
  };
};

export default ENGAGEMENT_INFO;
