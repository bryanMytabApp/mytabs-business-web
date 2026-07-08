import http from "../utils/axios/http";

/**
 * Get current SSO configuration for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise} - SSO configuration object
 */
export const getSSOConfig = (orgId) => {
  return http.get(`/authWeb/sso-config/${orgId}`);
};

/**
 * Save (create/update) SSO configuration for an organization
 * @param {string} orgId - Organization ID
 * @param {object} config - SSO config payload
 * @param {boolean} config.ssoEnabled - Whether SSO is enabled
 * @param {string} config.ssoType - "email-verification" | "saml" | "oidc"
 * @param {string[]} config.allowedDomains - List of allowed email domains
 * @param {string} [config.samlMetadataUrl] - SAML metadata URL (if ssoType is "saml")
 * @param {string} [config.oidcIssuerUrl] - OIDC issuer URL (if ssoType is "oidc")
 * @param {string} [config.oidcClientId] - OIDC client ID (if ssoType is "oidc")
 * @param {string} [config.oidcClientSecret] - OIDC client secret (if ssoType is "oidc")
 * @returns {Promise}
 */
export const saveSSOConfig = (orgId, config) => {
  return http.put(`/authWeb/sso-config/${orgId}`, config);
};

/**
 * Test SSO configuration before enabling for all members
 * @param {string} orgId - Organization ID
 * @param {object} config - SSO config to test
 * @returns {Promise} - Test result with success/failure details
 */
export const testSSOConfig = (orgId, config) => {
  return http.post(`/authWeb/sso-config/${orgId}/test`, config);
};

/**
 * Get list of SSO members with last login date
 * @param {string} orgId - Organization ID
 * @returns {Promise} - List of SSO members
 */
export const getSSOMembers = (orgId) => {
  return http.get(`/authWeb/sso-members/${orgId}`);
};

// ─── SSO Login Flow Functions ─────────────────────────────────────────────────

/**
 * Check if an email domain supports Organization SSO.
 * Calls the backend to determine if a given domain is SSO-enabled.
 *
 * @param {string} domain - e.g., "student.pvamu.org"
 * @returns {Promise<{ssoEnabled: boolean, provider?: string, type?: string, authUrl?: string}>}
 */
export const checkSSODomain = async (domain) => {
  const response = await http.get(`authWeb/sso-check`, {
    params: { domain },
  });
  return response.data;
};

/**
 * Authenticate via Organization SSO (email-verification flow).
 * Handles both sending a verification code and verifying it.
 *
 * @param {string} email - User's organization email
 * @param {string} action - "send-code" or "verify-code"
 * @param {string} [code] - Verification code (required for "verify-code" action)
 * @param {string} [sessionId] - Session ID from send-code response (required for "verify-code")
 * @param {string} [token] - SAML/OIDC token (for non-email-verification SSO types)
 * @returns {Promise<object>} For "send-code": { success, sessionId }. For "verify-code": { IdToken, AccessToken, RefreshToken, userId, user, isNewUser, organizationId }
 */
export const ssoAuth = async (email, action, code, sessionId, token) => {
  const payload = { email, action };
  if (code) payload.code = code;
  if (sessionId) payload.sessionId = sessionId;
  if (token) payload.token = token;

  const response = await http.post("authWeb/sso-auth", payload);
  return response.data;
};
