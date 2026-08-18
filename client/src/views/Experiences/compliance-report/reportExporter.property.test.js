import { TextEncoder, TextDecoder } from "util";

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

import fc from "fast-check";
import {
  computeIntegrityHash,
  generateReportJSON,
  generateFilename,
} from "./reportExporter";

// ─── Mock Web Crypto API ───────────────────────────────────────────────────────
// Use a real SHA-256 implementation for property tests to verify determinism.
// Node's crypto module provides the same algorithm as the Web Crypto API.

const { createHash } = require("crypto");

beforeAll(() => {
  Object.defineProperty(global, "crypto", {
    value: {
      subtle: {
        digest: async (algorithm, data) => {
          const hash = createHash("sha256");
          hash.update(Buffer.from(data));
          return hash.digest().buffer;
        },
      },
    },
    writable: true,
  });
});

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Arbitrary for a single participant record with an entryCode field.
 */
const participantArb = fc.record({
  entryCode: fc.string({ minLength: 1, maxLength: 20 }),
  firstName: fc.string({ minLength: 1, maxLength: 30 }),
  lastName: fc.string({ minLength: 1, maxLength: 30 }),
  enteredAt: fc.date().map((d) => d.toISOString()),
  channel: fc.constantFrom("In-App", "QR Code", "Manual"),
  consentStatus: fc.constantFrom("Yes", "No"),
  consentTimestamp: fc.option(fc.date().map((d) => d.toISOString()), { nil: null }),
  giftSelection: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
});

/**
 * Arbitrary for a complete report data input matching generateReportJSON's expected shape.
 */
const reportDataArb = fc.record({
  event: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    eventId: fc.string({ minLength: 1, maxLength: 20 }),
    eventName: fc.string({ minLength: 1, maxLength: 50 }),
  }),
  raffleConfiguration: fc.record({
    name: fc.string({ minLength: 1, maxLength: 50 }),
    winnersPerDrawing: fc.integer({ min: 1, max: 10 }),
  }),
  participants: fc.array(participantArb, { minLength: 0, maxLength: 15 }),
  winners: fc.array(
    fc.record({
      fullName: fc.string({ minLength: 1, maxLength: 40 }),
      entryCode: fc.string({ minLength: 1, maxLength: 20 }),
      position: fc.integer({ min: 1, max: 10 }),
      prizeAssigned: fc.string({ minLength: 1, maxLength: 30 }),
      claimStatus: fc.constantFrom("Claimed", "Pending", "Forfeited"),
      selectionTimestamp: fc.date().map((d) => d.toISOString()),
    }),
    { minLength: 0, maxLength: 5 }
  ),
  cryptographicProof: fc.record({
    protocolVersion: fc.constant("tabs-raffle-v1"),
    entryListHash: fc.stringMatching(/^[0-9a-f]{64}$/),
  }),
  auditTrail: fc.array(
    fc.record({
      timestamp: fc.date().map((d) => d.toISOString()),
      eventType: fc.constantFrom("STATE_TRANSITION", "CONFIG_CHANGE", "ADMIN_ACTION"),
      description: fc.string({ minLength: 1, maxLength: 80 }),
      actor: fc.string({ minLength: 1, maxLength: 30 }),
    }),
    { minLength: 0, maxLength: 8 }
  ),
  legalAttestation: fc.record({
    statements: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
      minLength: 1,
      maxLength: 5,
    }),
  }),
});

// ─── Property 1: Participant Sort Order Invariant ──────────────────────────────

/**
 * **Validates: Requirements 3.5**
 *
 * For any array of participant records, when processed through generateReportJSON,
 * the participants in the output SHALL always be sorted by entryCode in ascending
 * lexicographic order.
 */
describe("Property 1: Participant Sort Order Invariant", () => {
  it("random participant arrays are always sorted by entryCode ASC in the exported JSON", async () => {
    await fc.assert(
      fc.asyncProperty(reportDataArb, async (data) => {
        const json = await generateReportJSON(data);
        const parsed = JSON.parse(json);
        const codes = parsed.participants.map((p) => p.entryCode);

        for (let i = 1; i < codes.length; i++) {
          expect(codes[i - 1].localeCompare(codes[i])).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Export Filename Format ────────────────────────────────────────

/**
 * **Validates: Requirements 3.4**
 *
 * For any raffle name string and any valid date, the generated export filename
 * SHALL match the pattern for a valid filename: kebab-case name + date suffix + .json,
 * OR the fallback pattern draw-report-{YYYY-MM-DD}.json for empty/special-char names.
 */
describe("Property 2: Export Filename Format", () => {
  // Pattern for the full filename with a name portion
  const namedPattern = /^[a-z0-9]+(-[a-z0-9]+)*-draw-report-\d{4}-\d{2}-\d{2}\.json$/;
  // Pattern for the fallback (no name portion)
  const fallbackPattern = /^draw-report-\d{4}-\d{2}-\d{2}\.json$/;

  it("random names and dates always produce a valid filename pattern", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 120 }),
        fc.date({ min: new Date("2000-01-01"), max: new Date("2099-12-31") }),
        (name, date) => {
          const filename = generateFilename(name, date);

          // Must end with .json
          expect(filename).toMatch(/\.json$/);

          // Must match either the named pattern or fallback pattern
          const matchesNamed = namedPattern.test(filename);
          const matchesFallback = fallbackPattern.test(filename);
          expect(matchesNamed || matchesFallback).toBe(true);

          // Must not exceed 100 characters
          expect(filename.length).toBeLessThanOrEqual(100);

          // Must contain the date portion in YYYY-MM-DD format
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, "0");
          const dd = String(date.getDate()).padStart(2, "0");
          expect(filename).toContain(`${yyyy}-${mm}-${dd}`);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ─── Property 3: JSON Export Completeness ──────────────────────────────────────

/**
 * **Validates: Requirements 3.3**
 *
 * For any valid report data, the generated JSON export SHALL contain all input
 * data fields without loss. Parsing the JSON back should produce values equal
 * to the original input data (for non-metadata fields).
 */
describe("Property 3: JSON Export Completeness", () => {
  it("random data round-trips through generateReportJSON/JSON.parse without loss", async () => {
    await fc.assert(
      fc.asyncProperty(reportDataArb, async (data) => {
        const json = await generateReportJSON(data);
        const parsed = JSON.parse(json);

        // All top-level sections must be present
        expect(parsed.reportMetadata).toBeDefined();
        expect(parsed.event).toBeDefined();
        expect(parsed.raffleConfiguration).toBeDefined();
        expect(parsed.participants).toBeDefined();
        expect(parsed.winners).toBeDefined();
        expect(parsed.cryptographicProof).toBeDefined();
        expect(parsed.auditTrail).toBeDefined();
        expect(parsed.legalAttestation).toBeDefined();

        // Event data preserved
        expect(parsed.event).toEqual(data.event);

        // Raffle configuration preserved
        expect(parsed.raffleConfiguration).toEqual(data.raffleConfiguration);

        // Participants preserved (sorted, but same content)
        const sortedInput = [...data.participants].sort((a, b) =>
          (a.entryCode || "").localeCompare(b.entryCode || "")
        );
        expect(parsed.participants).toEqual(sortedInput);

        // Winners preserved
        expect(parsed.winners).toEqual(data.winners);

        // Cryptographic proof preserved
        expect(parsed.cryptographicProof).toEqual(data.cryptographicProof);

        // Audit trail preserved
        expect(parsed.auditTrail).toEqual(data.auditTrail);

        // Legal attestation preserved
        expect(parsed.legalAttestation).toEqual(data.legalAttestation);

        // Report metadata has required fields
        expect(parsed.reportMetadata.protocolVersion).toBe("tabs-raffle-v1");
        expect(parsed.reportMetadata.reportVersion).toBe("1.0.0");
        expect(parsed.reportMetadata.integrityHash).toMatch(/^[0-9a-f]{64}$/);
        expect(parsed.reportMetadata.generatedAt).toBeDefined();
      }),
      { numRuns: 100 }
    );
  });
});

// ─── Property 10: Integrity Hash Determinism ───────────────────────────────────

/**
 * **Validates: Requirements 10.6**
 *
 * For any valid report data:
 * 1. Computing the hash twice on the same data always produces the same result.
 * 2. Mutating any field in the data produces a different hash.
 */
describe("Property 10: Integrity Hash Determinism", () => {
  /**
   * Arbitrary for report content matching what computeIntegrityHash expects
   * (the fields it includes in the canonical hash).
   */
  const hashInputArb = fc.record({
    event: fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      eventId: fc.string({ minLength: 1, maxLength: 20 }),
    }),
    raffleConfiguration: fc.record({
      name: fc.string({ minLength: 1, maxLength: 50 }),
      winnersPerDrawing: fc.integer({ min: 1, max: 10 }),
    }),
    participants: fc.array(
      fc.record({
        entryCode: fc.string({ minLength: 1, maxLength: 20 }),
        firstName: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      { minLength: 0, maxLength: 10 }
    ),
    winners: fc.array(
      fc.record({
        fullName: fc.string({ minLength: 1, maxLength: 30 }),
        position: fc.integer({ min: 1, max: 5 }),
      }),
      { minLength: 0, maxLength: 5 }
    ),
    cryptographicProof: fc.record({
      protocolVersion: fc.constant("tabs-raffle-v1"),
    }),
    auditTrail: fc.array(
      fc.record({
        timestamp: fc.date().map((d) => d.toISOString()),
        eventType: fc.constant("STATE_TRANSITION"),
      }),
      { minLength: 0, maxLength: 5 }
    ),
  });

  it("same data always produces the same hash (deterministic)", async () => {
    await fc.assert(
      fc.asyncProperty(hashInputArb, async (data) => {
        const hash1 = await computeIntegrityHash(data);
        const hash2 = await computeIntegrityHash(data);
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[0-9a-f]{64}$/);
      }),
      { numRuns: 100 }
    );
  });

  it("mutating the event field produces a different hash", async () => {
    await fc.assert(
      fc.asyncProperty(
        hashInputArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        async (data, newName) => {
          fc.pre(newName !== data.event.name);
          const original = await computeIntegrityHash(data);
          const mutated = await computeIntegrityHash({
            ...data,
            event: { ...data.event, name: newName },
          });
          expect(mutated).not.toBe(original);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("mutating the participants array produces a different hash", async () => {
    await fc.assert(
      fc.asyncProperty(
        hashInputArb,
        fc.record({
          entryCode: fc.string({ minLength: 1, maxLength: 20 }),
          firstName: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (data, extraParticipant) => {
          const original = await computeIntegrityHash(data);
          const mutated = await computeIntegrityHash({
            ...data,
            participants: [...data.participants, extraParticipant],
          });
          expect(mutated).not.toBe(original);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("mutating the auditTrail produces a different hash", async () => {
    await fc.assert(
      fc.asyncProperty(
        hashInputArb,
        fc.record({
          timestamp: fc.date().map((d) => d.toISOString()),
          eventType: fc.constant("CONFIG_CHANGE"),
        }),
        async (data, extraEvent) => {
          const original = await computeIntegrityHash(data);
          const mutated = await computeIntegrityHash({
            ...data,
            auditTrail: [...data.auditTrail, extraEvent],
          });
          expect(mutated).not.toBe(original);
        }
      ),
      { numRuns: 100 }
    );
  });
});
