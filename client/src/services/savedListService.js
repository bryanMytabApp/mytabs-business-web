import http from "../utils/axios/http";

// Get all saved lists for a business
export const getSavedLists = (businessId) => {
  return http.get(`/business/${businessId}/saved-lists`);
};

// Create a new saved list
export const createSavedList = (businessId, data) => {
  return http.post(`/business/${businessId}/saved-lists`, data);
};

// Get a single saved list by ID
export const getSavedList = (businessId, listId) => {
  return http.get(`/business/${businessId}/saved-lists/${listId}`);
};

// Update a saved list
export const updateSavedList = (businessId, listId, data) => {
  return http.put(`/business/${businessId}/saved-lists/${listId}`, data);
};

// Delete a saved list
export const deleteSavedList = (businessId, listId) => {
  return http.delete(`/business/${businessId}/saved-lists/${listId}`);
};

// Add members to a saved list
export const addSavedListMembers = (businessId, listId, members) => {
  return http.post(`/business/${businessId}/saved-lists/${listId}/members`, { members });
};

// Remove a member from a saved list
export const removeSavedListMember = (businessId, listId, email) => {
  return http.delete(`/business/${businessId}/saved-lists/${listId}/members/${encodeURIComponent(email)}`);
};

// Import members from an uploaded file (S3 key from presigned upload)
export const importSavedListMembers = (businessId, listId, fileKey) => {
  return http.post(`/business/${businessId}/saved-lists/${listId}/import`, { fileKey });
};

// Get a presigned URL for uploading the import file to S3
export const getImportPresignedUrl = (businessId, listId, filename, contentType) => {
  return http.post(`/business/${businessId}/saved-lists/${listId}/import/presign`, { filename, contentType });
};

// Apply a saved list to an event (add all list members as event members)
export const applySavedListToEvent = (eventId, listId, businessId) => {
  return http.post(`/events/${eventId}/members/apply-saved-list`, { listId, businessId });
};
