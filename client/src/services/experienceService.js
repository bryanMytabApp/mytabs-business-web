import http from "../utils/axios/http";

/**
 * Experience Service — API client for the Event Experiences Framework.
 *
 * All endpoints target: /v1/events/{eventId}/experiences/* on the existing API Gateway.
 * Authentication is handled by the shared http interceptor (Cognito JWT).
 */

// ─── Catalog ───────────────────────────────────────────────────────────────────

/**
 * Fetches the full experience catalog for an event.
 * Returns all available experience types with name, description, icon, and category.
 * @param {string} eventId
 */
export const getCatalog = (eventId) =>
  http.get(`v1/events/${eventId}/experiences/catalog`);

/**
 * Fetches the experience catalog filtered by event attributes (type, venue, attendance tier).
 * @param {string} eventId
 * @param {object} [params] - { eventType, venueType, attendanceTier }
 */
export const getFilteredCatalog = (eventId, params) =>
  http.get(`v1/events/${eventId}/experiences/catalog`, { params });

// ─── Instance CRUD ─────────────────────────────────────────────────────────────

/**
 * Creates a new experience instance for an event.
 * @param {string} eventId
 * @param {object} instanceData - { experienceType, name, config, ... }
 */
export const createInstance = (eventId, instanceData) =>
  http.post(`v1/events/${eventId}/experiences`, instanceData);

/**
 * Gets a specific experience instance by ID.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const getInstance = (eventId, experienceId) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}`);

/**
 * Updates an existing experience instance.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} updates
 */
export const updateInstance = (eventId, experienceId, updates) =>
  http.put(`v1/events/${eventId}/experiences/${experienceId}`, updates);

/**
 * Deletes an experience instance.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const deleteInstance = (eventId, experienceId) =>
  http.delete(`v1/events/${eventId}/experiences/${experienceId}`);

/**
 * Lists all experience instances for an event.
 * Supports cursor-based pagination.
 * @param {string} eventId
 * @param {object} [params] - { cursor, limit, state }
 */
export const listInstances = (eventId, params) =>
  http.get(`v1/events/${eventId}/experiences`, { params });

/**
 * Fetches all experiences across multiple events in a single batch request.
 * @param {string[]} eventIds - Array of event IDs
 * @returns {Promise} - { data: { events: [{ eventId, eventName, instances: [...] }] } }
 */
export const listAllExperiences = (eventIds) =>
  http.post(`v1/events/_batch/experiences`, { eventIds });

// ─── Lifecycle ─────────────────────────────────────────────────────────────────

/**
 * Transitions an experience instance to a new state.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} transitionData - { action: 'activate'|'pause'|'resume'|'close'|'submit' }
 */
export const transitionState = (eventId, experienceId, transitionData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/transition`, transitionData);

// ─── Participation ─────────────────────────────────────────────────────────────

/**
 * Submits a participation entry for an experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} participationData - { channel, accessCode, ... }
 */
export const participate = (eventId, experienceId, participationData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/participate`, participationData);

/**
 * Checks eligibility for an attendee to participate in an experience.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const getEligibility = (eventId, experienceId) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/eligibility`);

/**
 * Gets the current user's entries for an experience.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const getMyEntries = (eventId, experienceId) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/my-entries`);

// ─── Live Stats ────────────────────────────────────────────────────────────────

/**
 * Gets real-time stats for a live experience (entries, participants, pot amount).
 * Supports ETag-based conditional requests for efficient polling.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [config] - Axios config, e.g. { headers: { 'If-None-Match': etag } }
 */
export const getLiveStats = (eventId, experienceId, config) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/live-stats`, config);

// ─── Entries (Admin) ───────────────────────────────────────────────────────────

/**
 * Gets entries for an experience (admin view with search/pagination).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { search, code, cursor, limit }
 */
export const getEntries = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/entries`, { params });

/**
 * Invalidates an entry (removes from future drawings).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} invalidateData - { entryId, reason }
 */
export const invalidateEntry = (eventId, experienceId, invalidateData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/entries/invalidate`, invalidateData);

// ─── Drawings ──────────────────────────────────────────────────────────────────

/**
 * Triggers a manual drawing for a raffle experience.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const triggerDraw = (eventId, experienceId) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/draw`);

/**
 * Triggers a redraw (selects new winners from remaining eligible entries).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [redrawData] - { excludeEntryIds }
 */
export const redraw = (eventId, experienceId, redrawData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/redraw`, redrawData);

/**
 * Gets the drawing history for a raffle experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { cursor, limit }
 */
export const getDrawings = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/drawings`, { params });

// ─── Analytics ─────────────────────────────────────────────────────────────────

/**
 * Gets analytics data for an experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { metric, from, to }
 */
export const getAnalytics = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/analytics`, { params });

/**
 * Exports analytics data as CSV.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { format }
 */
export const exportAnalytics = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/export`, {
    params,
    responseType: "blob",
  });

// ─── Draw Status ───────────────────────────────────────────────────────────────

/**
 * Gets the provably fair draw status for an experience.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const getDrawStatus = (eventId, experienceId) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/draw/status`);

// ─── Fulfillment ───────────────────────────────────────────────────────────────

/**
 * Gets fulfillment status for an experience's prizes.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { status, cursor, limit }
 */
export const getFulfillment = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/fulfillment`, { params });

/**
 * Updates fulfillment status for a prize (carrier, tracking number, status transition).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} fulfillmentData - { entryId, status, carrierName, trackingNumber }
 */
export const updateFulfillment = (eventId, experienceId, fulfillmentData) =>
  http.put(`v1/events/${eventId}/experiences/${experienceId}/fulfillment`, fulfillmentData);

// ─── Payments ──────────────────────────────────────────────────────────────────

/**
 * Creates a payment intent for a sponsor-funded experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} paymentData - { amount, currency, sponsorPaymentMethodId }
 */
export const createPayment = (eventId, experienceId, paymentData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/payment`, paymentData);

/**
 * Purchases tickets for a paid raffle experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} purchaseData - { bundleTier, quantity, paymentMethodId }
 */
export const purchaseTickets = (eventId, experienceId, purchaseData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/tickets/purchase`, purchaseData);

/**
 * Requests a refund for a payment (only allowed before Live state).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} refundData - { paymentIntentId, reason }
 */
export const refund = (eventId, experienceId, refundData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/refund`, refundData);

// ─── Permissions ───────────────────────────────────────────────────────────────

/**
 * Gets permission assignments for an experience's event.
 * @param {string} eventId
 * @param {string} experienceId
 */
export const getPermissions = (eventId, experienceId) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/permissions`);

/**
 * Updates permission assignments (assign, update, or revoke).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} permissionData - { userId, level: 'View'|'Manage'|'Operate'|'Admin', action: 'assign'|'revoke' }
 */
export const updatePermissions = (eventId, experienceId, permissionData) =>
  http.put(`v1/events/${eventId}/experiences/${experienceId}/permissions`, permissionData);

// ─── Compliance ────────────────────────────────────────────────────────────────

/**
 * Validates a jurisdiction for an experience (returns compliance status and required disclosures).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} jurisdictionData - { jurisdiction }
 */
export const validateJurisdiction = (eventId, experienceId, jurisdictionData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/compliance/validate`, jurisdictionData);

/**
 * Acknowledges compliance warnings for an experience.
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} acknowledgmentData - { jurisdiction, warnings }
 */
export const acknowledgeCompliance = (eventId, experienceId, acknowledgmentData) =>
  http.post(`v1/events/${eventId}/experiences/${experienceId}/compliance/acknowledge`, acknowledgmentData);

// ─── Timeline ──────────────────────────────────────────────────────────────────

/**
 * Gets the activity timeline for an experience (lifecycle events, participation, drawings).
 * @param {string} eventId
 * @param {string} experienceId
 * @param {object} [params] - { cursor, limit, from, to }
 */
export const getTimeline = (eventId, experienceId, params) =>
  http.get(`v1/events/${eventId}/experiences/${experienceId}/timeline`, { params });
