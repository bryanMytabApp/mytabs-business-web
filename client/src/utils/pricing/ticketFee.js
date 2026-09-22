// Event-creation ticket-fee helpers — the web client's mirror of the single source
// of truth for the Tabs platform ticket fee.
//
// The fee is CUTOVER-GATED and driven by the same Pricing_Version_Registry that
// powers subscription pricing (`../../config/pricingVersions`). It is NOT a hardcoded
// snapshot:
//   - Pre-migration (before 2026-09-06): 3% + $1.00 per ticket
//   - Current (on/after 2026-09-06):     4% + $0.89 per ticket
//
// This keeps the event-create ticket PREVIEW aligned with what ticket.keeptabs.app
// (the buyer app) actually charges at checkout, so the two surfaces never drift.
//
// Fee model (matches backend + buyer app):
//   feeDollars = subtotalDollars * (percent/100) + (perTicketCents/100) * quantity

import { versionForDate, pricingVersions } from "../../config/pricingVersions";

// Resolve the ticketFee { percent, perTicketCents, basis } in effect for a date
// (defaults to now). Falls back to the newest registered version defensively.
export function ticketFeeForDate(date = new Date()) {
  const version =
    versionForDate(date) || pricingVersions[pricingVersions.length - 1];
  return version?.ticketFee || { percent: 4, perTicketCents: 89, basis: "subtotal" };
}

// Percent of the subtotal for the CURRENTLY-EFFECTIVE version (today).
export const TICKET_FEE_PERCENT = ticketFeeForDate().percent;

// Flat per-ticket component in DOLLARS for the CURRENTLY-EFFECTIVE version (today).
export const TICKET_FEE_PER_TICKET = ticketFeeForDate().perTicketCents / 100;

// Human-readable label for the preview, e.g. "Tabs Fee (4% + $0.89)". Derived from
// the registry so the string can never contradict the math.
export function ticketFeeLabel(date = new Date()) {
  const fee = ticketFeeForDate(date);
  const flat = (fee.perTicketCents / 100).toFixed(2);
  return `Tabs Fee (${fee.percent}% + $${flat})`;
}

// Label for the CURRENTLY-EFFECTIVE version (today) — convenience for module scope.
export const TABS_FEE_LABEL = ticketFeeLabel();

// Decide which date drives the fee SCHEDULE for the create/edit preview.
//
// The fee is locked when the event is PUBLISHED. For an EXISTING event, resolve by
// publishedAt (else createdAt) so the preview shows the fee the event was actually
// published under — never the scheduled event date (which can be years out) and never
// "today". For a BRAND-NEW unpublished event there is no published/created date yet,
// so fall back to `now` (it will publish today).
export function resolveScheduleDate({ publishedAt, createdAt } = {}) {
  return publishedAt || createdAt || new Date();
}

// Compute the Tabs platform fee in DOLLARS for a ticket subtotal + quantity, using
// the version in effect on `date` (defaults to now). Clamped to be non-negative.
export function computeTabsFee(subtotalDollars, quantity = 1, date = new Date()) {
  const fee = ticketFeeForDate(date);
  const safeSubtotal =
    Number.isFinite(subtotalDollars) && subtotalDollars > 0 ? subtotalDollars : 0;
  const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const value =
    safeSubtotal * (fee.percent / 100) + (fee.perTicketCents / 100) * safeQty;
  return value >= 0 ? value : 0;
}
