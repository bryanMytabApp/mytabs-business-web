// TDD: the event-creation ticket preview must pull the CURRENT pricing model
// (4% + $0.89 on/after the 2026-09-06 cutover) from the shared pricing registry,
// NOT the legacy hardcoded 3% + $1.00. These tests pin an explicit date so they do
// not depend on "today".
import {
  ticketFeeForDate,
  ticketFeeLabel,
  computeTabsFee,
  resolveScheduleDate,
} from "./ticketFee";

const PRE = "2026-09-05"; // day before the cutover -> legacy 3% + $1.00
const POST = "2026-12-01"; // well after the cutover -> current 4% + $0.89

describe("event-create ticket fee — registry-driven (single source of truth)", () => {
  it("resolves the CURRENT model (4% + $0.89) on/after the cutover", () => {
    const fee = ticketFeeForDate(POST);
    expect(fee.percent).toBe(4);
    expect(fee.perTicketCents).toBe(89);
  });

  it("still resolves the legacy model (3% + $1.00) before the cutover", () => {
    const fee = ticketFeeForDate(PRE);
    expect(fee.percent).toBe(3);
    expect(fee.perTicketCents).toBe(100);
  });

  it("renders the label from the registry, not a hardcoded string", () => {
    // The bug was a hardcoded "Tabs Fee (3% + $1.00)" on the create-event preview.
    expect(ticketFeeLabel(POST)).toBe("Tabs Fee (4% + $0.89)");
    expect(ticketFeeLabel(PRE)).toBe("Tabs Fee (3% + $1.00)");
  });

  it("computes the fee with the CURRENT rate (4% of subtotal + $0.89/ticket)", () => {
    // $100 subtotal, 1 ticket -> 4% of 100 = 4.00 + 0.89 = 4.89
    expect(computeTabsFee(100, 1, POST)).toBeCloseTo(4.89, 2);
    // $50 subtotal, 2 tickets -> 4% of 50 = 2.00 + (0.89 * 2) = 3.78
    expect(computeTabsFee(50, 2, POST)).toBeCloseTo(3.78, 2);
  });

  it("does NOT use the legacy 3% + $1.00 math for a post-cutover date", () => {
    // Legacy would be 100*0.03 + 1 = 4.00; current is 4.89. They must differ.
    const legacy = 100 * 0.03 + 1.0;
    expect(computeTabsFee(100, 1, POST)).not.toBeCloseTo(legacy, 2);
  });

  it("defaults quantity to 1 and clamps invalid input", () => {
    expect(computeTabsFee(100, 0, POST)).toBeCloseTo(4.89, 2);
    expect(computeTabsFee(-5, 1, POST)).toBeGreaterThanOrEqual(0);
  });
});

describe("resolveScheduleDate — event-create preview anchors on the PUBLISHED date", () => {
  // For an EXISTING event, the create/edit preview must show the fee locked at the
  // event's publish time (publishedAt -> createdAt), NOT today and NOT the scheduled
  // (possibly far-future) event date. For a brand-new unpublished event, no
  // published/created date exists yet, so it falls back to `now` (it publishes today).
  const PUBLISHED_PRE = "Thu Aug 27 2026 20:58:23 GMT+0000"; // real prod format, pre-cutover
  const CREATED_PRE = "Wed Aug 20 2026 10:00:00 GMT+0000";
  const SCHEDULED_FUTURE = "Thu May 31 2040 11:00:00 GMT-0500";

  it("uses publishedAt when present", () => {
    expect(resolveScheduleDate({ publishedAt: PUBLISHED_PRE })).toBe(PUBLISHED_PRE);
  });

  it("falls back to createdAt when there is no publishedAt", () => {
    expect(resolveScheduleDate({ createdAt: CREATED_PRE })).toBe(CREATED_PRE);
  });

  it("prefers publishedAt over createdAt", () => {
    expect(
      resolveScheduleDate({ publishedAt: PUBLISHED_PRE, createdAt: CREATED_PRE })
    ).toBe(PUBLISHED_PRE);
  });

  it("ignores the scheduled event date entirely", () => {
    // A far-future scheduled date must never drive the schedule.
    const d = resolveScheduleDate({ publishedAt: PUBLISHED_PRE, scheduledEventDate: SCHEDULED_FUTURE });
    expect(d).toBe(PUBLISHED_PRE);
  });

  it("falls back to `now` for a brand-new event (nothing published/created yet)", () => {
    const d = resolveScheduleDate({});
    // Should be a Date ~now (a new event publishes today).
    expect(d instanceof Date).toBe(true);
  });

  it("drives the fee: an event published pre-cutover shows 3% + $1.00 despite a 2040 event date", () => {
    const d = resolveScheduleDate({ publishedAt: PUBLISHED_PRE, scheduledEventDate: SCHEDULED_FUTURE });
    // $50 ticket: 3% of 50 = 1.50 + 1.00 = 2.50
    expect(computeTabsFee(50, 1, d)).toBeCloseTo(2.5, 2);
    expect(ticketFeeLabel(d)).toBe("Tabs Fee (3% + $1.00)");
  });
});
