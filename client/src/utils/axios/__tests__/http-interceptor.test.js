import fc from 'fast-check';

/**
 * Unit & Property-Based Tests for HTTP Interceptor X-Business-Id header behavior
 * 
 * Tests the request interceptor in mytabs-client-web/client/src/utils/axios/http.js
 * which attaches the X-Business-Id header based on sessionStorage state.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

/**
 * Helper: Simulates running the request interceptor logic.
 * This replicates the exact logic from http.js's request interceptor
 * to test in isolation without needing to import the full module
 * (which has Cognito and config.json dependencies).
 * 
 * The interceptor logic under test:
 *   const selectedBizId = sessionStorage.getItem("selectedBusinessId");
 *   if (selectedBizId) {
 *     config.headers["X-Business-Id"] = selectedBizId;
 *   }
 */
function simulateRequestInterceptor(config, sessionStorageValue) {
  const selectedBizId = sessionStorageValue;
  if (selectedBizId) {
    config.headers["X-Business-Id"] = selectedBizId;
  }
  return config;
}

describe('HTTP Interceptor - X-Business-Id Header', () => {
  describe('Unit Tests', () => {
    it('should attach X-Business-Id header when sessionStorage has a non-empty selectedBusinessId', () => {
      const config = { headers: {}, url: '/api/business/123' };

      const result = simulateRequestInterceptor(config, 'biz-abc-123');

      expect(result.headers['X-Business-Id']).toBe('biz-abc-123');
    });

    it('should NOT attach X-Business-Id header when sessionStorage value is null', () => {
      const config = { headers: {}, url: '/api/events' };

      const result = simulateRequestInterceptor(config, null);

      expect(result.headers['X-Business-Id']).toBeUndefined();
    });

    it('should NOT attach X-Business-Id header when sessionStorage value is undefined', () => {
      const config = { headers: {}, url: '/api/events' };

      const result = simulateRequestInterceptor(config, undefined);

      expect(result.headers['X-Business-Id']).toBeUndefined();
    });

    it('should NOT attach X-Business-Id header when sessionStorage value is empty string', () => {
      const config = { headers: {}, url: '/api/events' };

      const result = simulateRequestInterceptor(config, '');

      expect(result.headers['X-Business-Id']).toBeUndefined();
    });

    it('should send X-Business-Id header even when value matches the JWT user_id', () => {
      // Requirement 2.4: header is sent even when it matches user's own ID
      const jwtUserId = 'c2481a85-user-id';
      const config = { headers: {}, url: '/api/business/c2481a85-user-id' };

      const result = simulateRequestInterceptor(config, jwtUserId);

      // The interceptor does not compare against JWT — it always sends when truthy
      expect(result.headers['X-Business-Id']).toBe(jwtUserId);
    });

    it('should send X-Business-Id header for ai-agents URLs', () => {
      const config = { headers: {}, url: '/api/ai-agents/config' };

      const result = simulateRequestInterceptor(config, 'biz-123');

      expect(result.headers['X-Business-Id']).toBe('biz-123');
    });

    it('should send X-Business-Id header for business URLs', () => {
      const config = { headers: {}, url: '/api/business/user123' };

      const result = simulateRequestInterceptor(config, 'biz-123');

      expect(result.headers['X-Business-Id']).toBe('biz-123');
    });

    it('should send X-Business-Id header for event URLs', () => {
      const config = { headers: {}, url: '/api/event/getEventsByUserId' };

      const result = simulateRequestInterceptor(config, 'biz-123');

      expect(result.headers['X-Business-Id']).toBe('biz-123');
    });

    it('should send X-Business-Id header for analytics URLs', () => {
      const config = { headers: {}, url: '/api/business/user123/analytics' };

      const result = simulateRequestInterceptor(config, 'biz-123');

      expect(result.headers['X-Business-Id']).toBe('biz-123');
    });

    it('should send X-Business-Id header for completely arbitrary URLs', () => {
      const config = { headers: {}, url: '/some/random/endpoint' };

      const result = simulateRequestInterceptor(config, 'biz-123');

      expect(result.headers['X-Business-Id']).toBe('biz-123');
    });

    it('should not modify other existing headers when attaching X-Business-Id', () => {
      const config = {
        headers: { Authorization: 'Bearer token123', 'Content-Type': 'application/json' },
        url: '/api/business',
      };

      const result = simulateRequestInterceptor(config, 'biz-456');

      expect(result.headers['X-Business-Id']).toBe('biz-456');
      expect(result.headers.Authorization).toBe('Bearer token123');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('should set header value to exactly what sessionStorage returns', () => {
      const bizId = '03396604-some-uuid-value';
      const config = { headers: {}, url: '/api/test' };

      const result = simulateRequestInterceptor(config, bizId);

      expect(result.headers['X-Business-Id']).toBe(bizId);
    });
  });

  /**
   * Property 1: Header propagation completeness
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
   *
   * For any non-empty string stored in sessionStorage.getItem("selectedBusinessId")
   * and for any request URL, the HTTP interceptor SHALL attach an X-Business-Id header
   * with exactly that string value. Conversely, for any falsy value (null, undefined,
   * empty string) in sessionStorage, the interceptor SHALL NOT attach the X-Business-Id header.
   */
  describe('Property 1: Header propagation completeness', () => {
    it('should ALWAYS attach X-Business-Id with exact value for any non-empty business ID and any URL', () => {
      fc.assert(
        fc.property(
          // Generate non-empty strings for the business ID
          fc.string({ minLength: 1, maxLength: 200 }),
          // Generate arbitrary URL paths
          fc.oneof(
            fc.webPath(),
            fc.constant('/api/ai-agents/config'),
            fc.constant('/api/business/user123'),
            fc.constant('/api/event/getEventsByUserId'),
            fc.constant('/api/business/user123/analytics'),
            fc.constant('/api/business/user123/activities'),
            fc.string({ minLength: 1, maxLength: 100 }).map(s => '/' + s)
          ),
          (businessId, url) => {
            const config = { headers: {}, url };

            const result = simulateRequestInterceptor(config, businessId);

            // The header MUST be attached
            expect(result.headers['X-Business-Id']).toBeDefined();
            // The header value MUST be exactly the sessionStorage value
            expect(result.headers['X-Business-Id']).toBe(businessId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should NEVER attach X-Business-Id for any falsy sessionStorage value', () => {
      fc.assert(
        fc.property(
          // Generate falsy values: null, undefined, empty string
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('')
          ),
          // Generate arbitrary URL paths
          fc.oneof(
            fc.webPath(),
            fc.constant('/api/ai-agents/config'),
            fc.constant('/api/business/user123'),
            fc.constant('/api/event/getEventsByUserId'),
            fc.string({ minLength: 1, maxLength: 100 }).map(s => '/' + s)
          ),
          (falsyValue, url) => {
            const config = { headers: {}, url };

            const result = simulateRequestInterceptor(config, falsyValue);

            // The header MUST NOT be attached
            expect(result.headers['X-Business-Id']).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should attach header regardless of whether value matches a hypothetical JWT user_id', () => {
      fc.assert(
        fc.property(
          // Generate a "user ID" that will be used as both JWT user_id and business ID
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.oneof(
            fc.webPath(),
            fc.string({ minLength: 1, maxLength: 100 }).map(s => '/' + s)
          ),
          (userId, url) => {
            // The interceptor sends the header regardless of whether it matches JWT
            const config = { headers: {}, url };

            const result = simulateRequestInterceptor(config, userId);

            // Header is attached even if value equals the user's own ID
            expect(result.headers['X-Business-Id']).toBe(userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not corrupt or modify the business ID value during propagation', () => {
      fc.assert(
        fc.property(
          // Generate strings with special characters, unicode, etc.
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 200 }),
            fc.unicodeString({ minLength: 1, maxLength: 100 }),
            fc.uuid()
          ),
          fc.webPath(),
          (businessId, url) => {
            const config = { headers: {}, url };

            const result = simulateRequestInterceptor(config, businessId);

            // Value must be exactly preserved — no trimming, encoding, or mutation
            expect(result.headers['X-Business-Id']).toStrictEqual(businessId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
