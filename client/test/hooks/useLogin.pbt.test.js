import fc from 'fast-check';
import { isValidReturnUrl, buildAuthenticatedReturnUrl } from '../../src/utils/authUtils';

/**
 * Property-Based Tests for Login Page returnUrl Handling
 * Validates: Requirements 2.1, 2.2, 5.1, 5.2
 */

describe('useLogin Hook - Property-Based Tests', () => {
  /**
   * Property 1: Return URL Preservation
   * Validates: Requirements 2.1, 2.2
   * 
   * After successful login:
   * - The returnUrl parameter MUST be preserved
   * - The token and userId MUST be appended to returnUrl
   * - The user MUST be redirected to the modified URL
   */
  describe('Property 1: returnUrl is preserved and auth params appended', () => {
    it('should preserve returnUrl and append auth params for any valid URL', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.base64String({ minLength: 20, maxLength: 500 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (baseUrl, token, userId) => {
            // Build authenticated URL
            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: Original URL is preserved
            expect(authenticatedUrl).toContain(baseUrl);

            // Verify: Token is appended
            expect(authenticatedUrl).toContain(`token=${encodeURIComponent(token)}`);

            // Verify: UserId is appended
            expect(authenticatedUrl).toContain(`userId=${encodeURIComponent(userId)}`);

            // Verify: URL is properly formatted
            expect(authenticatedUrl).toMatch(/[?&]token=/);
            expect(authenticatedUrl).toMatch(/[?&]userId=/);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should use correct separator (? or &) based on existing query params', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.base64String({ minLength: 20, maxLength: 500 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (hasQueryParams, token, userId) => {
            const baseUrl = hasQueryParams
              ? 'http://ticket.keeptabs.app/#/verification?existing=param'
              : 'http://ticket.keeptabs.app/#/verification';

            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: Correct separator is used
            if (hasQueryParams) {
              expect(authenticatedUrl).toContain('existing=param&token=');
            } else {
              expect(authenticatedUrl).toContain('#/verification?token=');
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should URL-encode token and userId to prevent injection', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.string({ minLength: 5, maxLength: 100 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (baseUrl, token, userId) => {
            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: Token and userId are encoded
            const encodedToken = encodeURIComponent(token);
            const encodedUserId = encodeURIComponent(userId);

            expect(authenticatedUrl).toContain(`token=${encodedToken}`);
            expect(authenticatedUrl).toContain(`userId=${encodedUserId}`);

            // Verify: Special characters are encoded
            if (token.includes('&') || token.includes('?') || token.includes('=')) {
              expect(authenticatedUrl).not.toContain(`token=${token}`);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 2: Return URL Validation
   * Validates: Requirements 5.1
   * 
   * For any returnUrl:
   * - Same domain URLs MUST be valid
   * - keeptabs.app subdomain URLs MUST be valid
   * - Different domain URLs MUST be invalid
   * - Invalid URLs MUST be rejected gracefully
   */
  describe('Property 2: returnUrl validation prevents open redirect attacks', () => {
    it('should accept same domain URLs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          (path) => {
            // Setup: Same domain
            delete (window as any).location;
            (window as any).location = {
              href: 'http://keeptabs.app/login',
              origin: 'http://keeptabs.app',
            };

            const returnUrl = `http://keeptabs.app/${path}`;

            // Verify: Same domain is valid
            expect(isValidReturnUrl(returnUrl)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should accept keeptabs.app subdomain URLs', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          (subdomain, path) => {
            // Setup: Current domain
            delete (window as any).location;
            (window as any).location = {
              href: 'http://keeptabs.app/login',
              origin: 'http://keeptabs.app',
            };

            const returnUrl = `http://${subdomain}.keeptabs.app/${path}`;

            // Verify: Subdomain is valid
            expect(isValidReturnUrl(returnUrl)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should reject different domain URLs', () => {
      fc.assert(
        fc.property(
          fc.domain(),
          fc.string({ minLength: 1, maxLength: 50 }),
          (domain, path) => {
            // Filter out keeptabs.app domains
            if (domain.includes('keeptabs.app')) {
              return;
            }

            // Setup: Current domain
            delete (window as any).location;
            (window as any).location = {
              href: 'http://keeptabs.app/login',
              origin: 'http://keeptabs.app',
            };

            const returnUrl = `http://${domain}/${path}`;

            // Verify: Different domain is invalid
            expect(isValidReturnUrl(returnUrl)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle invalid URLs gracefully', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          (invalidUrl) => {
            // Filter out valid URLs
            try {
              new URL(invalidUrl);
              return; // Skip valid URLs
            } catch {
              // This is an invalid URL, test it
            }

            // Setup: Current domain
            delete (window as any).location;
            (window as any).location = {
              href: 'http://keeptabs.app/login',
              origin: 'http://keeptabs.app',
            };

            // Verify: Invalid URLs are rejected gracefully (no exception)
            expect(() => isValidReturnUrl(invalidUrl)).not.toThrow();
            expect(isValidReturnUrl(invalidUrl)).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 3: URL Construction Consistency
   * Validates: Requirements 5.2
   * 
   * For any combination of returnUrl, token, and userId:
   * - The constructed URL MUST contain all three components
   * - The URL MUST be properly formatted
   * - The URL MUST be decodable
   */
  describe('Property 3: Authenticated URL construction is consistent', () => {
    it('should construct valid URLs for any input combination', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.base64String({ minLength: 20, maxLength: 500 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (baseUrl, token, userId) => {
            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: URL is a string
            expect(typeof authenticatedUrl).toBe('string');

            // Verify: URL contains all components
            expect(authenticatedUrl).toContain(baseUrl);
            expect(authenticatedUrl).toContain('token=');
            expect(authenticatedUrl).toContain('userId=');

            // Verify: URL can be parsed
            expect(() => new URL(authenticatedUrl)).not.toThrow();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve hash fragments in returnUrl', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.base64String({ minLength: 20, maxLength: 500 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (hashFragment, token, userId) => {
            const baseUrl = `http://ticket.keeptabs.app/#/${hashFragment}`;

            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: Hash fragment is preserved
            expect(authenticatedUrl).toContain(`#/${hashFragment}`);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should handle multiple query parameters in returnUrl', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.string({ minLength: 1, maxLength: 20 })
            ),
            { minLength: 1, maxLength: 5 }
          ),
          fc.base64String({ minLength: 20, maxLength: 500 }),
          fc.string({ minLength: 5, maxLength: 100 }),
          (params, token, userId) => {
            const queryString = params.map(([k, v]) => `${k}=${v}`).join('&');
            const baseUrl = `http://ticket.keeptabs.app/#/verification?${queryString}`;

            const authenticatedUrl = buildAuthenticatedReturnUrl(baseUrl, token, userId);

            // Verify: All original params are preserved
            params.forEach(([k, v]) => {
              expect(authenticatedUrl).toContain(`${k}=${v}`);
            });

            // Verify: New params are added
            expect(authenticatedUrl).toContain('token=');
            expect(authenticatedUrl).toContain('userId=');
          }
        ),
        { numRuns: 15 }
      );
    });
  });
});
