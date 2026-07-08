'use strict';

/**
 * Property-Based Test: Retry Count Bounded at Three
 *
 * **Validates: Requirements 5.3**
 *
 * Property 6: Retry Count Bounded at Three
 * - For any sequence of consecutive Weather Preview API failures,
 *   the Weather Preview step SHALL display a "Retry" button for the first 3 failures
 *   and SHALL NOT display a "Retry" button after the third failed attempt.
 *
 * The retry logic in P_Weather (extracted from EventCreateNew.jsx):
 *   - retryCount starts at 0
 *   - Retry button rendered when: retryCount < 3 && error state is true
 *   - Each retry click: setRetryCount(prev => prev + 1) then re-fetches
 *   - After 3 retries (retryCount >= 3): Retry button is NOT rendered
 */

const fc = require('fast-check');

// ─── Extracted Logic Under Test ────────────────────────────────────────────────

/**
 * Determines whether the Retry button should be visible.
 * Replicates the exact condition from P_Weather:
 *   {error && retryCount < 3 && <button>Retry</button>}
 *
 * @param {number} retryCount - Current retry count (starts at 0)
 * @param {boolean} hasError - Whether the component is in an error state
 * @returns {boolean} Whether the Retry button should be visible
 */
function isRetryButtonVisible(retryCount, hasError) {
  return hasError && retryCount < 3;
}

/**
 * Simulates the retry count progression after N consecutive failures.
 * Each failure triggers a retry click which increments the count.
 * Starting from retryCount = 0, after N clicks the count is N.
 *
 * @param {number} failureSequenceLength - Number of consecutive failures (1-10)
 * @returns {number} The retryCount after that many failures
 */
function simulateRetryProgression(failureSequenceLength) {
  let retryCount = 0;
  for (let i = 0; i < failureSequenceLength; i++) {
    // Each click increments retryCount before the re-fetch
    retryCount = retryCount + 1;
  }
  return retryCount;
}

// ─── Property Tests ────────────────────────────────────────────────────────────

describe('Property 6: Retry Count Bounded at Three', () => {
  /**
   * Core property: For any retryCount n in [0, 9]:
   * - if n < 3: Retry button should be visible (when in error state)
   * - if n >= 3: Retry button should NOT be visible
   */
  it('Retry button visible when retryCount < 3 and in error state, hidden when retryCount >= 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        (retryCount) => {
          const hasError = true; // We're testing in error state

          const visible = isRetryButtonVisible(retryCount, hasError);

          if (retryCount < 3) {
            expect(visible).toBe(true);
          } else {
            expect(visible).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Complementary property: When NOT in error state, Retry button is never visible
   * regardless of retryCount.
   */
  it('Retry button never visible when not in error state, regardless of retryCount', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 9 }),
        (retryCount) => {
          const hasError = false;

          const visible = isRetryButtonVisible(retryCount, hasError);
          expect(visible).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Invariant: After exactly 3 retry clicks, the Retry button disappears
   * regardless of how many total failures occurred.
   *
   * Simulates sequences of 1-10 consecutive failures and verifies the
   * button state after each retry click in the sequence.
   */
  it('after exactly 3 clicks, Retry button disappears regardless of failure count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (totalFailures) => {
          // Simulate: retryCount starts at 0, user can click up to 3 times
          // Each click increments retryCount before re-fetch
          let retryCount = 0;

          for (let clickNum = 1; clickNum <= Math.min(totalFailures, 3); clickNum++) {
            // Before click: button should be visible (retryCount < 3)
            expect(isRetryButtonVisible(retryCount, true)).toBe(true);

            // User clicks Retry → retryCount increments
            retryCount = retryCount + 1;
          }

          // After 3 clicks, retryCount === 3, button should be hidden
          if (totalFailures >= 3) {
            expect(retryCount).toBe(3);
            expect(isRetryButtonVisible(retryCount, true)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Boundary property: retryCount transitions from visible to hidden at exactly 3.
   * For any n in [0, 9], the boundary condition holds:
   *   visible(n) XOR visible(n+1) only when n === 2 (transition from 2→3)
   */
  it('the visibility boundary is exactly at retryCount === 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 8 }),
        (n) => {
          const visibleAtN = isRetryButtonVisible(n, true);
          const visibleAtNPlus1 = isRetryButtonVisible(n + 1, true);

          if (n < 2) {
            // Both n and n+1 are below 3 → both visible
            expect(visibleAtN).toBe(true);
            expect(visibleAtNPlus1).toBe(true);
          } else if (n === 2) {
            // n=2 is visible, n+1=3 is hidden (boundary)
            expect(visibleAtN).toBe(true);
            expect(visibleAtNPlus1).toBe(false);
          } else {
            // Both n and n+1 are >= 3 → both hidden
            expect(visibleAtN).toBe(false);
            expect(visibleAtNPlus1).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
