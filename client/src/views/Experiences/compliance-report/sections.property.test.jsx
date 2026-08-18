import React from "react";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";
import EventInfoSection from "./EventInfoSection";
import RaffleConfigSection from "./RaffleConfigSection";
import ParticipantRegistrySection from "./ParticipantRegistrySection";
import WinnerDetailsSection from "./WinnerDetailsSection";
import AuditTrailSection from "./AuditTrailSection";

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generates a valid ISO 8601 timestamp string in UTC.
 */
const isoTimestampArb = fc
  .date({ min: new Date("2000-01-01T00:00:00Z"), max: new Date("2099-12-31T23:59:59Z") })
  .map((d) => d.toISOString());

/**
 * Generates an EventInfo object with some fields randomly set to null.
 */
const eventInfoWithNullsArb = fc.record({
  experienceId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  eventId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  eventName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  eventDate: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  eventLocation: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  organizerName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  organizerContact: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  sponsorName: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  sponsorOptedOut: fc.boolean(),
});

/**
 * Generates a RaffleConfig object with timestamp fields.
 */
const raffleConfigArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 40 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  prizeDescription: fc.string({ minLength: 1, maxLength: 40 }),
  prizeValue: fc.string({ minLength: 1, maxLength: 20 }),
  entryWindowStart: isoTimestampArb,
  entryWindowEnd: isoTimestampArb,
  drawingSchedule: fc.string({ minLength: 1, maxLength: 40 }),
  winnersPerDrawing: fc.integer({ min: 1, max: 10 }),
  eligibilityRules: fc.array(fc.string({ minLength: 1, maxLength: 40 }), { minLength: 1, maxLength: 5 }),
  charitablePurpose: fc.option(fc.string({ minLength: 1, maxLength: 60 }), { nil: null }),
  nonprofitAuthorization: fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: null }),
  totalTicketsSold: fc.integer({ min: 1, max: 10000 }),
  prizeAwardDate: isoTimestampArb,
});

/**
 * Generates a participant record.
 */
const participantArb = fc.record({
  firstName: fc.string({ minLength: 1, maxLength: 20 }),
  lastName: fc.string({ minLength: 1, maxLength: 20 }),
  entryCode: fc.string({ minLength: 4, maxLength: 20 }),
  enteredAt: isoTimestampArb,
  channel: fc.constantFrom("In-App", "QR Code", "Manual"),
  consentStatus: fc.constantFrom("Yes", "No"),
  consentTimestamp: fc.option(isoTimestampArb, { nil: null }),
  giftSelection: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
});

/**
 * Generates a winner record with a specific position.
 */
const winnerArb = fc.record({
  fullName: fc.string({ minLength: 1, maxLength: 30 }),
  entryCode: fc.string({ minLength: 4, maxLength: 20 }),
  position: fc.integer({ min: 1, max: 100 }),
  prizeAssigned: fc.string({ minLength: 1, maxLength: 30 }),
  claimStatus: fc.string({ minLength: 1, maxLength: 30 }),
  selectionTimestamp: isoTimestampArb,
});

/**
 * Generates an audit event record.
 */
const auditEventArb = fc.record({
  timestamp: isoTimestampArb,
  eventType: fc.constantFrom("STATE_TRANSITION", "CONFIG_CHANGE", "ENTRY_MODIFICATION", "ADMIN_ACTION"),
  description: fc.string({ minLength: 1, maxLength: 60 }),
  actor: fc.string({ minLength: 1, maxLength: 30 }),
  previousState: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  newState: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  details: fc.constant(null),
});

// ─── Property 4: Missing Field Fallback ────────────────────────────────────────

/**
 * **Validates: Requirements 4.5**
 *
 * For any event or organizer data object where one or more fields are null or
 * undefined, every null/undefined field SHALL display as "Not Provided" in the
 * rendered output.
 */
describe("Property 4: Missing Field Fallback", () => {
  it("random nulls always display 'Not Provided'", () => {
    fc.assert(
      fc.property(eventInfoWithNullsArb, (data) => {
        const { container } = render(<EventInfoSection data={data} />);

        // Count how many fields are null/empty
        const nullableFields = [
          data.eventName,
          data.eventDate,
          data.eventLocation,
          data.organizerName,
          data.organizerContact,
        ];

        const nullCount = nullableFields.filter(
          (v) => v === null || v === undefined || v === ""
        ).length;

        // Sponsor is null if sponsorName is null/empty OR sponsorOptedOut is true
        const sponsorNull =
          !data.sponsorName || data.sponsorOptedOut;

        const expectedNotProvided = nullCount + (sponsorNull ? 1 : 0);

        // Count actual "Not Provided" occurrences in the rendered output
        const allText = container.textContent;
        const notProvidedMatches = allText.match(/Not Provided/g) || [];

        expect(notProvidedMatches.length).toBe(expectedNotProvided);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Timestamp Formatting ──────────────────────────────────────────

/**
 * **Validates: Requirements 5.8**
 *
 * For any valid ISO 8601 timestamp string, the RaffleConfigSection's timestamp
 * formatter SHALL produce a human-readable string that includes the timezone
 * designator (e.g., "UTC", "EST", "CDT", "GMT+5").
 */
describe("Property 5: Timestamp Formatting", () => {
  it("random ISO timestamps always include timezone in rendered output", () => {
    fc.assert(
      fc.property(raffleConfigArb, (config) => {
        const { container } = render(<RaffleConfigSection data={config} />);
        const text = container.textContent;

        // The rendered text should NOT contain raw ISO strings like "2026-08-10T17:05:03.000Z"
        // Instead it should contain a timezone name like "UTC", "EST", "CDT", "GMT", etc.
        // Intl.DateTimeFormat with timeZoneName: "short" produces timezone abbreviations.
        // We check that the formatted timestamps (Entry Window Start, End, Prize Award Date)
        // do NOT show "Not Provided" (since we always provide valid timestamps) and
        // that they contain a timezone-like pattern.
        const timezonePattern = /[A-Z]{2,5}[+-]?\d{0,2}|GMT[+-]\d{1,2}/;

        // Entry window start is always provided in our arbitrary
        expect(text).not.toContain(config.entryWindowStart);
        // The text should contain at least one timezone abbreviation
        expect(text).toMatch(timezonePattern);
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6: Participant Table Completeness ────────────────────────────────

/**
 * **Validates: Requirements 6.2, 6.5**
 *
 * For any non-empty array of participants, the ParticipantRegistrySection
 * renders the correct number of table rows and shows the correct count summary.
 */
describe("Property 6: Participant Table Completeness", () => {
  it("random arrays render correct row count and summary", () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 1, maxLength: 20 }),
        (participants) => {
          const { container } = render(
            <ParticipantRegistrySection data={participants} />
          );

          // Check summary count text
          const summaryText = container.textContent;
          expect(summaryText).toContain(
            `Total Participants: ${participants.length}`
          );

          // Check rendered table rows (excluding header row)
          const bodyRows = container.querySelectorAll("tbody tr");
          expect(bodyRows.length).toBe(participants.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 7: Winner Position Order ─────────────────────────────────────────

/**
 * **Validates: Requirements 7.3**
 *
 * For any array of winners with random shuffled positions, the WinnerDetailsSection
 * always renders them sorted by position ascending (first row = lowest position).
 */
describe("Property 7: Winner Position Order", () => {
  it("random winners always sorted by position", () => {
    // Generate winners with unique positions by shuffling a range
    const winnersWithUniquePositionsArb = fc
      .integer({ min: 2, max: 10 })
      .chain((count) =>
        fc.tuple(
          fc.shuffledSubarray(
            Array.from({ length: 20 }, (_, i) => i + 1),
            { minLength: count, maxLength: count }
          ),
          fc.array(
            fc.record({
              fullName: fc.string({ minLength: 1, maxLength: 30 }),
              entryCode: fc.string({ minLength: 4, maxLength: 20 }),
              prizeAssigned: fc.string({ minLength: 1, maxLength: 30 }),
              claimStatus: fc.constantFrom("Claimed", "Pending", "Forfeited"),
              selectionTimestamp: isoTimestampArb,
            }),
            { minLength: count, maxLength: count }
          )
        ).map(([positions, records]) =>
          records.map((rec, i) => ({ ...rec, position: positions[i] }))
        )
      );

    fc.assert(
      fc.property(winnersWithUniquePositionsArb, (winners) => {
        const { container } = render(<WinnerDetailsSection data={winners} />);
        const rows = container.querySelectorAll("tbody tr");

        // Extract position values from first cell in each row
        const renderedPositions = Array.from(rows).map((row) =>
          parseInt(row.querySelector("td").textContent, 10)
        );

        // Verify sorted ascending
        for (let i = 1; i < renderedPositions.length; i++) {
          expect(renderedPositions[i]).toBeGreaterThanOrEqual(
            renderedPositions[i - 1]
          );
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 8: Claim Status Validity ─────────────────────────────────────────

/**
 * **Validates: Requirements 7.4**
 *
 * For any random claim status input string, the WinnerDetailsSection always
 * renders exactly "Claimed", "Pending", or "Forfeited" — never the raw input.
 */
describe("Property 8: Claim Status Validity", () => {
  const VALID_STATUSES = ["Claimed", "Pending", "Forfeited"];

  it("random status inputs always map to 'Claimed'/'Pending'/'Forfeited'", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            fullName: fc.string({ minLength: 1, maxLength: 30 }),
            entryCode: fc.string({ minLength: 4, maxLength: 20 }),
            position: fc.integer({ min: 1, max: 100 }),
            prizeAssigned: fc.string({ minLength: 1, maxLength: 30 }),
            // Intentionally use arbitrary strings including gibberish, nullish-like strings
            claimStatus: fc.oneof(
              fc.string({ minLength: 0, maxLength: 30 }),
              fc.constantFrom("claimed", "CLAIMED", "Forfeited", "forfeited", "FORFEITED", "pending", "PENDING", "unknown", "", "xyz")
            ),
            selectionTimestamp: isoTimestampArb,
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (winners) => {
          const { container } = render(<WinnerDetailsSection data={winners} />);

          // Get all claim status cells (5th column, index 4)
          const rows = container.querySelectorAll("tbody tr");
          rows.forEach((row) => {
            const cells = row.querySelectorAll("td");
            // Claim Status is the 5th column (index 4)
            const statusText = cells[4].textContent;
            expect(VALID_STATUSES).toContain(statusText);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 9: Audit Trail Chronological Order ───────────────────────────────

/**
 * **Validates: Requirements 9.6**
 *
 * For any array of audit events with randomly shuffled timestamps, the
 * AuditTrailSection always renders them in chronological order (oldest first).
 */
describe("Property 9: Audit Trail Chronological Order", () => {
  /**
   * Generate events with distinct timestamps and unique descriptions for ordering verification.
   * We use timestamps separated by years so the sort order is unambiguous in rendered text.
   */
  const distinctTimestampEventsArb = fc
    .integer({ min: 2, max: 8 })
    .chain((count) =>
      fc.tuple(
        // Generate `count` unique year offsets, then shuffle for random input order
        fc.shuffledSubarray(
          Array.from({ length: 20 }, (_, i) => i),
          { minLength: count, maxLength: count }
        ),
        fc.array(
          fc.record({
            eventType: fc.constantFrom("STATE_TRANSITION", "CONFIG_CHANGE", "ENTRY_MODIFICATION", "ADMIN_ACTION"),
            actor: fc.string({ minLength: 1, maxLength: 30 }),
            previousState: fc.constant(null),
            newState: fc.constant(null),
            details: fc.constant(null),
          }),
          { minLength: count, maxLength: count }
        )
      ).map(([offsets, records]) =>
        records.map((rec, i) => ({
          ...rec,
          // Use unique descriptions with index markers so we can identify ordering in DOM
          description: `Event_${offsets[i].toString().padStart(3, "0")}`,
          // Timestamps in different years so chronological order is clear
          timestamp: new Date(Date.UTC(2001 + offsets[i], 5, 15, 12, 0, 0)).toISOString(),
        }))
      )
    );

  it("random events always sorted oldest first", () => {
    fc.assert(
      fc.property(distinctTimestampEventsArb, (events) => {
        const { container } = render(<AuditTrailSection data={events} />);
        const text = container.textContent;

        // Sort input by timestamp to get expected chronological order
        const sorted = [...events].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Each event has a unique description like "Event_003", "Event_017".
        // Verify they appear in chronological order in the DOM text.
        const positions = sorted.map((e) => text.indexOf(e.description));

        // All descriptions should be found
        positions.forEach((pos) => expect(pos).toBeGreaterThanOrEqual(0));

        // They should be in ascending position order
        for (let i = 1; i < positions.length; i++) {
          expect(positions[i]).toBeGreaterThan(positions[i - 1]);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 11: Section Non-Empty Rendering ──────────────────────────────────

/**
 * **Validates: Requirements 12.5**
 *
 * For any random valid (non-empty) data, the section components always render
 * at least some text content — they never render as completely empty.
 */
describe("Property 11: Section Non-Empty Rendering", () => {
  it("random valid data never renders empty for EventInfoSection", () => {
    const validEventInfoArb = fc.record({
      experienceId: fc.string({ minLength: 1, maxLength: 20 }),
      eventId: fc.string({ minLength: 1, maxLength: 20 }),
      name: fc.string({ minLength: 1, maxLength: 40 }),
      eventName: fc.string({ minLength: 1, maxLength: 40 }),
      eventDate: fc.string({ minLength: 1, maxLength: 20 }),
      eventLocation: fc.string({ minLength: 1, maxLength: 40 }),
      organizerName: fc.string({ minLength: 1, maxLength: 40 }),
      organizerContact: fc.string({ minLength: 1, maxLength: 40 }),
      sponsorName: fc.string({ minLength: 1, maxLength: 40 }),
      sponsorOptedOut: fc.boolean(),
    });

    fc.assert(
      fc.property(validEventInfoArb, (data) => {
        const { container } = render(<EventInfoSection data={data} />);
        expect(container.textContent.trim().length).toBeGreaterThan(0);
        expect(container.textContent).toContain("Event & Organizer Information");
      }),
      { numRuns: 50 }
    );
  });

  it("random valid data never renders empty for RaffleConfigSection", () => {
    fc.assert(
      fc.property(raffleConfigArb, (config) => {
        const { container } = render(<RaffleConfigSection data={config} />);
        expect(container.textContent.trim().length).toBeGreaterThan(0);
        expect(container.textContent).toContain("Raffle Configuration");
      }),
      { numRuns: 50 }
    );
  });

  it("random valid data never renders empty for ParticipantRegistrySection", () => {
    fc.assert(
      fc.property(
        fc.array(participantArb, { minLength: 1, maxLength: 10 }),
        (participants) => {
          const { container } = render(
            <ParticipantRegistrySection data={participants} />
          );
          expect(container.textContent.trim().length).toBeGreaterThan(0);
          expect(container.textContent).toContain("Participant Registry");
        }
      ),
      { numRuns: 50 }
    );
  });

  it("random valid data never renders empty for WinnerDetailsSection", () => {
    fc.assert(
      fc.property(
        fc.array(winnerArb, { minLength: 1, maxLength: 5 }),
        (winners) => {
          const { container } = render(<WinnerDetailsSection data={winners} />);
          expect(container.textContent.trim().length).toBeGreaterThan(0);
          expect(container.textContent).toContain("Winner Details");
        }
      ),
      { numRuns: 50 }
    );
  });

  it("random valid data never renders empty for AuditTrailSection", () => {
    fc.assert(
      fc.property(
        fc.array(auditEventArb, { minLength: 1, maxLength: 10 }),
        (events) => {
          const { container } = render(<AuditTrailSection data={events} />);
          expect(container.textContent.trim().length).toBeGreaterThan(0);
          expect(container.textContent).toContain("Event Change History / Audit Trail");
        }
      ),
      { numRuns: 50 }
    );
  });
});
