// ---------------------------------------------------------------------------
// Shared pricing-catalog helpers.
//
// These were originally private to `src/views/Subscription/SubscriptionView.jsx`.
// They now live here so BOTH the authenticated Subscribe page (SubscriptionView)
// and the public Marketing pricing surface (usePlanData / PricingSection) derive
// plan prices from a SINGLE source of truth — the backend catalog rows returned by
// `paymentService.getSystemSubscriptions()` — using the same cutover-aware pricing
// version selection. This guarantees the displayed price and the amount pinned to
// Stripe at checkout can never drift.
//
// The BACKEND registry (mirrored into `src/config/pricingVersions.js`) is the
// authoritative source for plan names, the cutover schedule, and the cumulative
// plan→product mix. This module carries NO Stripe ids and is never used for
// charging — it is display-only.
// ---------------------------------------------------------------------------

import {
  PLAN_LEVELS,
  PRODUCT_NAMES,
  planProductMix,
  pricingVersions,
  versionForNewSignup,
} from "../../config/pricingVersions";

// The pricing version a NEW signup TODAY is pinned to, honoring the go-live cutover
// (the migration version's effectiveDate = Sunday 2026-09-06). BEFORE the cutover
// this resolves to the LEGACY (pre-migration) version; ON/AFTER, the new version —
// so pricing shows legacy prices until Sunday, then new ones. Falls back to the
// newest registered version defensively if date resolution returns nothing.
export const CURRENT_VERSION =
  versionForNewSignup(new Date()) || pricingVersions[pricingVersions.length - 1];

// The pricingEffectiveDate of the version a NEW signup TODAY is pinned to. The
// catalog (System_Subscriptions) holds one row per plan×interval PER pricing version
// (each stamped with `pricingEffectiveDate`), so we must select the row for the
// version in effect today: LEGACY before the go-live cutover, NEW on/after. This is
// the same cutover the displayed prices honor, so card + checkout never drift.
export const CURRENT_EFFECTIVE_DATE = CURRENT_VERSION?.effectiveDate;

// Format a cents amount as a currency string. Shows no decimals for whole-dollar
// amounts and two decimals otherwise (e.g. 56300 -> "$563", 1399 -> "$13.99").
export const dollars = (cents) =>
  `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;

// Find the backend catalog row (System_Subscriptions) for a plan level + interval,
// pinned to the CURRENTLY-EFFECTIVE pricing version. This is the SAME row checkout
// sends to Stripe, so its `amount` is exactly what the customer will be charged.
// Level fields may be number or string; catalog sublevel values are
// "monthly" / "yearly".
export const findCatalogRow = (systemSubscriptions, level, interval) => {
  const rows = Array.isArray(systemSubscriptions) ? systemSubscriptions : [];
  const wantedSublevel = interval === "yearly" ? "yearly" : "monthly";
  const forLevel = rows.filter((sub) => String(sub.level) === String(level));
  // Rows matching the chosen interval, then narrowed to the effective version.
  const forInterval = forLevel.filter((sub) => sub.sublevel === wantedSublevel);
  const candidates = forInterval.length > 0 ? forInterval : forLevel;
  return (
    // Prefer the row stamped with the currently-effective pricing version...
    candidates.find(
      (sub) => sub.pricingEffectiveDate === CURRENT_EFFECTIVE_DATE
    ) ||
    // ...else the newest row at/at-before today's effective date (defensive: if the
    // exact stamp is absent, never pick a FUTURE (not-yet-live) version's row)...
    candidates
      .filter(
        (sub) =>
          !sub.pricingEffectiveDate ||
          sub.pricingEffectiveDate <= CURRENT_EFFECTIVE_DATE
      )
      .sort((a, b) =>
        String(b.pricingEffectiveDate || "").localeCompare(
          String(a.pricingEffectiveDate || "")
        )
      )[0] ||
    // ...else whatever exists for this level (legacy catalogs with no version stamp).
    candidates[0] ||
    null
  );
};

// Coerce a catalog row's `amount` (cents) to a finite number. DynamoDB stores the
// amount as a String, so a row's amount may be a number OR a numeric string; only a
// finite result is trusted, otherwise `null` (the caller falls back to config).
const coerceAmountCents = (row) => {
  if (row == null) return null;
  const amount = Number(row.amount);
  return Number.isFinite(amount) ? amount : null;
};

// Config-derived fallback amount (cents) for a plan + interval, used only when the
// catalog row for a plan hasn't loaded / is absent. Yearly = 12x monthly (matches
// the provisioned Stripe yearly prices).
const fallbackAmountCents = (planName, interval) => {
  const monthlyCents = CURRENT_VERSION?.planMonthlyCents?.[planName];
  if (!Number.isFinite(Number(monthlyCents))) return null;
  return interval === "yearly" ? monthlyCents * 12 : monthlyCents;
};

// Human-readable display names for every product included in a plan, derived from the
// cumulative plan→product mix + product display-name map (Req 20.4). Falls back to the
// raw product id if a display name is missing.
const includedProductsFor = (planName) =>
  (planProductMix[planName] || []).map((pid) => PRODUCT_NAMES[pid] || pid);

// Build the four plan display view-models (PlanView[]) from the backend catalog rows
// for a given billing interval. Price comes from the CATALOG row's real amount (what
// Stripe will charge) so the displayed price and the charge can never drift; it falls
// back to the config amount only when the catalog row for a plan hasn't loaded.
//
// Growth is flagged the "most popular" plan (`popular: true`) and Enterprise is a
// contact-only, custom-priced plan (`talkToSales: true`) — Req 10.4, 10.5.
//
// PlanView shape (see design.md → Data Models):
//   { id, level, name, amountCents, price, interval, priceSuffix,
//     popular, talkToSales, includedProducts }
export const buildPlanViewModels = (rows = [], interval = "monthly") => {
  const normalizedInterval = interval === "yearly" ? "yearly" : "monthly";
  return PLAN_LEVELS.map((planName, idx) => {
    const level = idx + 1; // Starter=1 ... Enterprise=4
    // Prefer the catalog row's real amount (what Stripe charges) over config.
    const catalogRow = findCatalogRow(rows, level, normalizedInterval);
    const catalogAmount = coerceAmountCents(catalogRow);
    const amountCents =
      catalogAmount != null
        ? catalogAmount
        : fallbackAmountCents(planName, normalizedInterval);
    return {
      id: planName.toLowerCase(),
      level,
      name: planName,
      amountCents,
      price: Number.isFinite(amountCents) ? dollars(amountCents) : null,
      interval: normalizedInterval,
      priceSuffix: normalizedInterval === "yearly" ? "/yr" : "/mo",
      popular: planName === "Growth", // exactly one "most popular" indicator
      talkToSales: planName === "Enterprise", // custom-priced, contact path
      includedProducts: includedProductsFor(planName),
    };
  });
};

// Format a Contract_Product baseline reference (e.g. AI Discovery / Market Intelligence
// from `pricingVersions`) as a display label. These add-ons have NO self-serve price;
// the label is a "From $X/interval" reference shown alongside a Talk-to-sales path.
export const baselineLabel = (baseline) => {
  if (!baseline) return "Custom quote";
  const cents = Number(baseline.baselineCents);
  if (!Number.isFinite(cents)) return "Custom quote";
  const suffix = baseline.interval === "year" ? "/yr" : "/mo";
  return `From ${dollars(cents)}${suffix}`;
};
