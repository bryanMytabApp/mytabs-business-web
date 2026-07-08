import http from "../utils/axios/http";

const BASE_PATH = "/authMobile/domains";

/**
 * List all domains for an organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<{domains: Array}>}
 */
export const listDomains = (orgId) => {
  return http.get(`${BASE_PATH}/${orgId}`);
};

/**
 * Add a new domain to verify
 * @param {string} orgId - Organization ID
 * @param {string} domain - Domain to add (e.g., "company.com")
 * @returns {Promise<{domain, verificationCode, verified, instructions}>}
 */
export const addDomain = (orgId, domain) => {
  return http.post(`${BASE_PATH}/${orgId}`, { domain });
};

/**
 * Verify a domain by checking DNS TXT records
 * @param {string} orgId - Organization ID
 * @param {string} domain - Domain to verify
 * @returns {Promise<{verified: boolean, message?: string, error?: string}>}
 */
export const verifyDomain = (orgId, domain) => {
  return http.post(`${BASE_PATH}/${orgId}/verify`, { domain });
};

/**
 * Remove a domain from the organization
 * @param {string} orgId - Organization ID
 * @param {string} domain - Domain to remove
 * @returns {Promise<{success: boolean}>}
 */
export const removeDomain = (orgId, domain) => {
  return http.delete(`${BASE_PATH}/${orgId}`, { data: { domain } });
};
