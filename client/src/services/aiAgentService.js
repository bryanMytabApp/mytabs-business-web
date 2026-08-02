import http from "../utils/axios/http";

/**
 * AI Agent Service — API client for the AI Event Discovery System.
 *
 * All endpoints target: /ai-agents/* on the existing API Gateway.
 * Authentication is handled by the shared http interceptor (Cognito JWT).
 */

// ─── Dashboard ─────────────────────────────────────────────────────────────────

/**
 * Fetches the aggregated dashboard metrics for all agents of the current account.
 * Returns per-agent metrics and an account-level summary.
 */
export const getDashboard = () => {
  // Always pass orgView=true — the backend will detect if the user is an org member
  // and aggregate agents across all linked businesses automatically.
  return http.get("ai-agents/dashboard", { params: { orgView: "true" } });
};

/**
 * Fetches the crawl history for a specific agent (most recent 50).
 * @param {string} agentId
 */
export const getCrawlHistory = (agentId) =>
  http.get(`ai-agents/${agentId}/crawl-history`);

/**
 * Fetches the AI cost summary for the current billing period.
 */
export const getCostSummary = () => http.get("ai-agents/cost-summary");

// ─── Agent CRUD ────────────────────────────────────────────────────────────────

/**
 * Creates a new AI agent.
 * @param {object} agentData - { agentType, name, cities, categories, keywords, crawlSchedule, ... }
 * @returns {Promise<{data: {agent: object}}>}
 */
export const createAgent = (agentData) => http.post("ai-agents", agentData);

/**
 * Lists all agents for the current account.
 */
export const listAgents = () => http.get("ai-agents");

/**
 * Gets a specific agent by ID.
 * @param {string} agentId
 */
export const getAgent = (agentId) => http.get(`ai-agents/${agentId}`);

/**
 * Updates an existing agent.
 * @param {string} agentId
 * @param {object} updates
 */
export const updateAgent = (agentId, updates) =>
  http.put(`ai-agents/${agentId}`, updates);

/**
 * Triggers an immediate crawl/discovery run for an agent.
 * @param {string} agentId
 */
export const triggerCrawl = (agentId) =>
  http.put(`ai-agents/${agentId}`, { triggerRun: true });

/**
 * Deletes an agent.
 * @param {string} agentId
 */
export const deleteAgent = (agentId) =>
  http.delete(`ai-agents/${agentId}`);

// ─── Source Management ─────────────────────────────────────────────────────────

/**
 * Adds a source to an agent.
 * @param {string} agentId
 * @param {object} sourceData - { url, name, connectorType, ... }
 */
export const addSource = (agentId, sourceData) =>
  http.post(`ai-agents/${agentId}/sources`, sourceData);

/**
 * Lists sources for an agent.
 * @param {string} agentId
 */
export const listSources = (agentId) =>
  http.get(`ai-agents/${agentId}/sources`);

/**
 * Removes a source from an agent.
 * @param {string} agentId
 * @param {string} sourceId
 */
export const removeSource = (agentId, sourceId) =>
  http.delete(`ai-agents/${agentId}/sources`, { data: { sourceId } });

/**
 * Approves a discovered source (moves to linked Event Creation Agent).
 * @param {string} agentId
 * @param {string} sourceId
 */
export const approveSource = (agentId, sourceId) =>
  http.post(`ai-agents/${agentId}/sources/${sourceId}/approve`);

/**
 * Triggers validation on all unvalidated sources for an agent.
 * @param {string} agentId
 */
export const validateSources = (agentId) =>
  http.post(`ai-agents/${agentId}/sources`, { action: "validate_all" });

// ─── Drafts ────────────────────────────────────────────────────────────────────

/**
 * Lists draft events for the current account.
 * @param {object} [params] - { status, limit, lastKey }
 */
export const listDrafts = (params) =>
  http.get("ai-agents/drafts", { params });

/**
 * Gets a specific draft event.
 * @param {string} draftId
 */
export const getDraft = (draftId) => http.get(`ai-agents/drafts/${draftId}`);

/**
 * Edits a draft event.
 * @param {string} draftId
 * @param {object} updates
 */
export const editDraft = (draftId, updates) =>
  http.put(`ai-agents/drafts/${draftId}`, updates);

/**
 * Approves a draft event (publishes to Tabs Events).
 * @param {string} draftId
 */
export const approveDraft = (draftId) =>
  http.post(`ai-agents/drafts/${draftId}/approve`);

/**
 * Rejects a draft event.
 * @param {string} draftId
 * @param {object} [body] - { reason }
 */
export const rejectDraft = (draftId, body) =>
  http.post(`ai-agents/drafts/${draftId}/reject`, body);

/**
 * Gets the provenance chain for a draft event.
 * @param {string} draftId
 */
export const getDraftProvenance = (draftId) =>
  http.get(`ai-agents/drafts/${draftId}/provenance`);

// ─── Notifications ─────────────────────────────────────────────────────────────

/**
 * Gets notification preferences.
 */
export const getNotificationPreferences = () =>
  http.get("ai-agents/notifications/preferences");

/**
 * Updates notification preferences.
 * @param {object} prefs
 */
export const updateNotificationPreferences = (prefs) =>
  http.put("ai-agents/notifications/preferences", prefs);
