/**
 * Property-Based Test: Token Non-Persistence After Exchange
 *
 * **Validates: Requirements 8.4, 9.1**
 *
 * For any successful social auth (Google, Apple, Facebook) on web,
 * after the backend returns Cognito tokens, localStorage SHALL contain
 * ONLY Cognito tokens (idToken, accessToken, refToken, username) —
 * never the provider's original identity token (Google credential JWT,
 * Apple id_token, Facebook access_token).
 *
 * Property: For any generated provider token string (random JWT-like strings),
 * after successful auth, localStorage contains exactly
 * {idToken, accessToken, refToken, username} and NONE of them match
 * the original provider token.
 */

import * as fc from "fast-check";

// ─── localStorage Mock ─────────────────────────────────────────────────────────

let localStorageStore = {};

const localStorageMock = (() => {
  const mock = {
    getItem: (key) => localStorageStore[key] ?? null,
    setItem: (key, value) => {
      localStorageStore[key] = String(value);
    },
    removeItem: (key) => {
      delete localStorageStore[key];
    },
    clear: () => {
      localStorageStore = {};
    },
    get length() {
      return Object.keys(localStorageStore).length;
    },
    key: (i) => Object.keys(localStorageStore)[i] || null,
  };
  return mock;
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

// ─── Mock Setup ────────────────────────────────────────────────────────────────

// Mock http module — we control the post response per test run
const mockPost = jest.fn();
jest.mock("../utils/axios/http", () => ({
  __esModule: true,
  default: {
    post: (...args) => mockPost(...args),
  },
}));

// ─── Import after mocks ────────────────────────────────────────────────────────

import {
  signInWithGoogle,
  signInWithApple,
  signInWithFacebook,
} from "./webSocialAuth";

// ─── fast-check Arbitraries ─────────────────────────────────────────────────────

/**
 * Generates random JWT-like provider tokens (3 dot-separated base64 parts).
 * These simulate the identity tokens that providers return.
 */
const providerTokenArb = fc
  .tuple(
    fc.base64String({ minLength: 10, maxLength: 50 }),
    fc.base64String({ minLength: 10, maxLength: 80 }),
    fc.base64String({ minLength: 10, maxLength: 40 })
  )
  .map(([h, p, s]) => `${h}.${p}.${s}`);

/**
 * Generates random Cognito token values that are distinct from provider tokens.
 * Prefixed with "cognito-" / "access-" to ensure they differ from provider tokens.
 */
const cognitoResponseArb = fc.record({
  IdToken: fc
    .tuple(
      fc.base64String({ minLength: 8, maxLength: 20 }),
      fc.base64String({ minLength: 8, maxLength: 30 }),
      fc.base64String({ minLength: 8, maxLength: 20 })
    )
    .map(([h, p, s]) => `cognitoId.${h}.${p}.${s}`),
  AccessToken: fc
    .tuple(
      fc.base64String({ minLength: 8, maxLength: 20 }),
      fc.base64String({ minLength: 8, maxLength: 30 }),
      fc.base64String({ minLength: 8, maxLength: 20 })
    )
    .map(([h, p, s]) => `cognitoAccess.${h}.${p}.${s}`),
  RefreshToken: fc
    .hexaString({ minLength: 20, maxLength: 60 })
    .map((s) => `cognitoRefresh_${s}`),
  userId: fc.uuid(),
  user: fc.record({
    email: fc
      .tuple(
        fc.stringOf(
          fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"),
          { minLength: 3, maxLength: 10 }
        ),
        fc.constantFrom("gmail.com", "icloud.com", "outlook.com", "test.org")
      )
      .map(([local, domain]) => `${local}@${domain}`),
  }),
  isNewUser: fc.boolean(),
});

// ─── Test Suite ─────────────────────────────────────────────────────────────────

describe("Property 3: Token Non-Persistence After Exchange", () => {
  beforeEach(() => {
    localStorageStore = {};
    mockPost.mockReset();
  });

  it("after successful Google sign-in, localStorage contains only Cognito tokens and never the provider's original token", async () => {
    await fc.assert(
      fc.asyncProperty(
        providerTokenArb,
        cognitoResponseArb,
        async (providerToken, cognitoResponse) => {
          // Clear storage for this iteration
          localStorageStore = {};

          // Setup: backend returns Cognito tokens
          mockPost.mockResolvedValue({ data: cognitoResponse });

          // Act: call signInWithGoogle with the random provider token
          await signInWithGoogle(providerToken);

          // ── Invariant checks ──

          // 1. localStorage keys are ONLY the allowed Cognito token keys
          const storedKeys = Object.keys(localStorageStore);
          const allowedKeys = [
            "idToken",
            "accessToken",
            "refToken",
            "username",
          ];
          for (const key of storedKeys) {
            expect(allowedKeys).toContain(key);
          }

          // 2. None of the stored values match the original provider token
          for (const key of storedKeys) {
            expect(localStorageStore[key]).not.toBe(providerToken);
          }

          // 3. Stored values ARE the Cognito tokens from backend response
          expect(localStorageStore["idToken"]).toBe(cognitoResponse.IdToken);
          expect(localStorageStore["accessToken"]).toBe(
            cognitoResponse.AccessToken
          );
          expect(localStorageStore["refToken"]).toBe(
            cognitoResponse.RefreshToken
          );
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it("after successful Apple sign-in, localStorage contains only Cognito tokens and never the provider's original token", async () => {
    await fc.assert(
      fc.asyncProperty(
        providerTokenArb,
        cognitoResponseArb,
        async (providerToken, cognitoResponse) => {
          // Clear storage for this iteration
          localStorageStore = {};

          // Setup: mock Apple SDK returns the provider token as id_token
          window.AppleID = {
            auth: {
              init: jest.fn(),
              signIn: jest.fn().mockResolvedValue({
                authorization: { id_token: providerToken },
                user: null,
              }),
            },
          };

          // Setup: backend returns Cognito tokens
          mockPost.mockResolvedValue({ data: cognitoResponse });

          // Act: call signInWithApple
          await signInWithApple();

          // ── Invariant checks ──

          // 1. localStorage keys are ONLY the allowed Cognito token keys
          const storedKeys = Object.keys(localStorageStore);
          const allowedKeys = [
            "idToken",
            "accessToken",
            "refToken",
            "username",
          ];
          for (const key of storedKeys) {
            expect(allowedKeys).toContain(key);
          }

          // 2. None of the stored values match the original provider token
          for (const key of storedKeys) {
            expect(localStorageStore[key]).not.toBe(providerToken);
          }

          // 3. Stored values ARE the Cognito tokens from backend response
          expect(localStorageStore["idToken"]).toBe(cognitoResponse.IdToken);
          expect(localStorageStore["accessToken"]).toBe(
            cognitoResponse.AccessToken
          );
          expect(localStorageStore["refToken"]).toBe(
            cognitoResponse.RefreshToken
          );
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);

  it("after successful Facebook sign-in, localStorage contains only Cognito tokens and never the provider's original token", async () => {
    await fc.assert(
      fc.asyncProperty(
        providerTokenArb,
        cognitoResponseArb,
        async (providerToken, cognitoResponse) => {
          // Clear storage for this iteration
          localStorageStore = {};

          // Setup: mock FB SDK returns the provider token as accessToken
          window.FB = {
            init: jest.fn(),
            login: jest.fn((callback) => {
              callback({
                status: "connected",
                authResponse: { accessToken: providerToken },
              });
            }),
          };

          // Setup: backend returns Cognito tokens
          mockPost.mockResolvedValue({ data: cognitoResponse });

          // Act: call signInWithFacebook
          await signInWithFacebook();

          // ── Invariant checks ──

          // 1. localStorage keys are ONLY the allowed Cognito token keys
          const storedKeys = Object.keys(localStorageStore);
          const allowedKeys = [
            "idToken",
            "accessToken",
            "refToken",
            "username",
          ];
          for (const key of storedKeys) {
            expect(allowedKeys).toContain(key);
          }

          // 2. None of the stored values match the original provider token
          for (const key of storedKeys) {
            expect(localStorageStore[key]).not.toBe(providerToken);
          }

          // 3. Stored values ARE the Cognito tokens from backend response
          expect(localStorageStore["idToken"]).toBe(cognitoResponse.IdToken);
          expect(localStorageStore["accessToken"]).toBe(
            cognitoResponse.AccessToken
          );
          expect(localStorageStore["refToken"]).toBe(
            cognitoResponse.RefreshToken
          );
        }
      ),
      { numRuns: 100 }
    );
  }, 60000);
});
