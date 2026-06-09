'use strict';

/**
 * Property-Based Test: Cancellation No-Error
 *
 * **Validates: Requirements 1.9, 2.8, 3.8**
 *
 * Property 9: Cancellation No-Error
 * - For any social auth flow cancelled by user (Apple/Google/Facebook),
 *   no error alert shown and app returns to previous screen.
 * - Generate random cancellation scenarios per provider with fast-check.
 *
 * The cancellation architecture works as follows:
 * - Apple: popup_closed_by_user error → signInWithApple throws with code: "CANCELLED"
 * - Facebook: status "unknown" or "not_authorized" → signInWithFacebook throws with code: "CANCELLED"
 * - SocialLoginButtons: catches errors from Apple/Facebook, checks error.code !== "CANCELLED"
 *   before calling onError — so CANCELLED errors are silently swallowed (no error alert).
 * - Google: cancellation is handled by the GoogleLogin component itself (calls onError callback),
 *   but this is a UX-level cancel — no CANCELLED code is produced from the service layer.
 */

const fc = require('fast-check');

// ─── Mock Setup ────────────────────────────────────────────────────────────────

// Mock the http module (used by webSocialAuth.js)
jest.mock('../utils/axios/http', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────────

const { signInWithApple, signInWithFacebook } = require('./webSocialAuth');

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Apple cancellation scenarios: the Apple SDK throws an error object with
 * either `type: "popup_closed_by_user"` or `error: "popup_closed_by_user"`.
 */
const appleCancellationArbitrary = fc.record({
  errorShape: fc.constantFrom('type', 'error'),
  // Random extra fields that might exist on the error object
  extraField: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
});

/**
 * Facebook cancellation scenarios: FB.login returns a response with
 * status "unknown" or "not_authorized".
 */
const facebookCancellationArbitrary = fc.record({
  status: fc.constantFrom('unknown', 'not_authorized'),
  // authResponse can be null or absent when cancelled
  authResponse: fc.constantFrom(null, undefined),
});

/**
 * Provider selector for combined tests.
 */
const providerArbitrary = fc.constantFrom('apple', 'facebook');

/**
 * Combined cancellation scenario: a provider and its cancellation config.
 */
const cancellationScenarioArbitrary = fc.oneof(
  appleCancellationArbitrary.map(config => ({ provider: 'apple', config })),
  facebookCancellationArbitrary.map(config => ({ provider: 'facebook', config }))
);

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Sets up the Apple SDK mock to simulate a cancellation (popup closed by user).
 */
function setupAppleCancellation(config) {
  const errorObj = {};
  if (config.errorShape === 'type') {
    errorObj.type = 'popup_closed_by_user';
  } else {
    errorObj.error = 'popup_closed_by_user';
  }
  if (config.extraField !== undefined) {
    errorObj.extra = config.extraField;
  }

  window.AppleID = {
    auth: {
      init: jest.fn(),
      signIn: jest.fn().mockRejectedValue(errorObj),
    },
  };
}

/**
 * Sets up the Facebook SDK mock to simulate a cancellation.
 */
function setupFacebookCancellation(config) {
  window.FB = {
    init: jest.fn(),
    login: jest.fn((callback) => {
      callback({
        status: config.status,
        authResponse: config.authResponse,
      });
    }),
  };
}

/**
 * Simulates what SocialLoginButtons does: calls the provider auth function,
 * catches errors, and only calls onError if error.code !== "CANCELLED".
 * Returns { errorPropagated: boolean, error: Error|null }.
 */
async function simulateSocialLoginButtonsHandler(provider) {
  let errorPropagated = false;
  let caughtError = null;

  const signInFn = provider === 'apple' ? signInWithApple : signInWithFacebook;

  try {
    await signInFn();
  } catch (error) {
    caughtError = error;
    // This is the exact logic from SocialLoginButtons.jsx:
    // if (error.code !== "CANCELLED") { onError(error); }
    if (error.code !== 'CANCELLED') {
      errorPropagated = true;
    }
  }

  return { errorPropagated, caughtError };
}

// ─── Property Tests ────────────────────────────────────────────────────────────

describe('Property 9: Cancellation No-Error', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete window.AppleID;
    delete window.FB;
    delete window.fbAsyncInit;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Apple cancellation SHALL always produce an error with code "CANCELLED"', async () => {
    await fc.assert(
      fc.asyncProperty(
        appleCancellationArbitrary,
        async (config) => {
          setupAppleCancellation(config);

          let thrownError = null;
          try {
            await signInWithApple();
          } catch (error) {
            thrownError = error;
          }

          // Property: cancellation MUST throw an error
          expect(thrownError).not.toBeNull();
          // Property: the error MUST have code "CANCELLED"
          expect(thrownError.code).toBe('CANCELLED');
          // Property: the error message indicates cancellation
          expect(thrownError.message).toBe('Apple sign-in was cancelled.');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Facebook cancellation SHALL always produce an error with code "CANCELLED"', async () => {
    await fc.assert(
      fc.asyncProperty(
        facebookCancellationArbitrary,
        async (config) => {
          setupFacebookCancellation(config);

          let thrownError = null;
          try {
            await signInWithFacebook();
          } catch (error) {
            thrownError = error;
          }

          // Property: cancellation MUST throw an error
          expect(thrownError).not.toBeNull();
          // Property: the error MUST have code "CANCELLED"
          expect(thrownError.code).toBe('CANCELLED');
          // Property: the error message indicates cancellation
          expect(thrownError.message).toBe('Facebook sign-in was cancelled.');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('CANCELLED errors SHALL never be propagated to onError by SocialLoginButtons', async () => {
    await fc.assert(
      fc.asyncProperty(
        cancellationScenarioArbitrary,
        async (scenario) => {
          const { provider, config } = scenario;

          if (provider === 'apple') {
            setupAppleCancellation(config);
          } else {
            setupFacebookCancellation(config);
          }

          const result = await simulateSocialLoginButtonsHandler(provider);

          // Property: the error was caught
          expect(result.caughtError).not.toBeNull();
          // Property: the error has code "CANCELLED"
          expect(result.caughtError.code).toBe('CANCELLED');
          // Property: the error was NOT propagated to onError (no alert shown)
          expect(result.errorPropagated).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any randomly-selected provider with cancellation, no error alert is triggered', async () => {
    await fc.assert(
      fc.asyncProperty(
        providerArbitrary,
        facebookCancellationArbitrary,
        appleCancellationArbitrary,
        async (provider, fbConfig, appleConfig) => {
          if (provider === 'apple') {
            setupAppleCancellation(appleConfig);
          } else {
            setupFacebookCancellation(fbConfig);
          }

          const result = await simulateSocialLoginButtonsHandler(provider);

          // Property: cancellation NEVER produces an error propagation
          expect(result.errorPropagated).toBe(false);
          // Property: the error code is always CANCELLED
          expect(result.caughtError.code).toBe('CANCELLED');
        }
      ),
      { numRuns: 100 }
    );
  });
});
