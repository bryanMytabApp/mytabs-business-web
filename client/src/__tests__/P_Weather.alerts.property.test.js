'use strict';

/**
 * Property-Based Test: Alerts Capped and Ordered by Severity
 *
 * **Validates: Requirements 3.5**
 *
 * Property 5: Alerts Capped and Ordered by Severity
 * - For any list of NWS alerts returned by the Weather Preview API,
 *   the Weather Preview step SHALL display at most 5 alerts,
 *   ordered from most severe to least severe.
 *
 * The alert sorting/capping logic (extracted from P_Weather in EventCreateNew.jsx):
 *   const SEVERITY_ORDER = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };
 *   const sortedAlerts = (alerts || [])
 *     .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
 *     .slice(0, 5);
 */

const fc = require('fast-check');

// ─── Extracted Logic Under Test ────────────────────────────────────────────────

const SEVERITY_ORDER = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 };

/**
 * Replicates the exact alert sorting and capping logic from P_Weather.
 * @param {Array} alerts - Array of alert objects with severity field
 * @returns {Array} Sorted and capped alert array (max 5, most severe first)
 */
function sortAndCapAlerts(alerts) {
  return (alerts || [])
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4))
    .slice(0, 5);
}

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generate a severity level — one of the four known levels.
 */
const severityArbitrary = fc.oneof(
  fc.constant('Extreme'),
  fc.constant('Severe'),
  fc.constant('Moderate'),
  fc.constant('Minor')
);

/**
 * Generate a single alert object with random headline, description, and severity.
 */
const alertArbitrary = fc.record({
  headline: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 1, maxLength: 100 }),
  severity: severityArbitrary,
});

/**
 * Generate an array of alerts with length between 0 and 20.
 */
const alertsArrayArbitrary = fc.array(alertArbitrary, { minLength: 0, maxLength: 20 });

// ─── Property Tests ────────────────────────────────────────────────────────────

describe('Property 5: Alerts Capped and Ordered by Severity', () => {
  it('displayed alerts SHALL be at most 5', () => {
    fc.assert(
      fc.property(
        alertsArrayArbitrary,
        (alerts) => {
          const result = sortAndCapAlerts(alerts);
          expect(result.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('displayed alerts SHALL be ordered from most severe to least severe', () => {
    fc.assert(
      fc.property(
        alertsArrayArbitrary,
        (alerts) => {
          const result = sortAndCapAlerts(alerts);

          // For every consecutive pair, severity order must be non-decreasing
          for (let i = 0; i < result.length - 1; i++) {
            const currentOrder = SEVERITY_ORDER[result[i].severity] ?? 4;
            const nextOrder = SEVERITY_ORDER[result[i + 1].severity] ?? 4;
            expect(currentOrder).toBeLessThanOrEqual(nextOrder);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('displayed alerts SHALL be capped at 5 AND ordered by severity (combined)', () => {
    fc.assert(
      fc.property(
        alertsArrayArbitrary,
        (alerts) => {
          const result = sortAndCapAlerts(alerts);

          // Cap: never more than 5
          expect(result.length).toBeLessThanOrEqual(5);

          // Cap: result length is min(input length, 5)
          expect(result.length).toBe(Math.min(alerts.length, 5));

          // Order: severity is non-decreasing (most severe first)
          for (let i = 0; i < result.length - 1; i++) {
            const currentOrder = SEVERITY_ORDER[result[i].severity] ?? 4;
            const nextOrder = SEVERITY_ORDER[result[i + 1].severity] ?? 4;
            expect(currentOrder).toBeLessThanOrEqual(nextOrder);
          }

          // Completeness: the most severe alerts from input are retained
          // (all returned alerts should have severity <= any dropped alert)
          if (alerts.length > 5) {
            const returnedSeverities = result.map(a => SEVERITY_ORDER[a.severity] ?? 4);
            const maxReturnedSeverity = Math.max(...returnedSeverities);
            const droppedAlerts = alerts.filter(a => !result.includes(a));
            for (const dropped of droppedAlerts) {
              const droppedSeverity = SEVERITY_ORDER[dropped.severity] ?? 4;
              expect(droppedSeverity).toBeGreaterThanOrEqual(maxReturnedSeverity);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
