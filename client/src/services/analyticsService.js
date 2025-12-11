import http from "../utils/axios/http";

// Get business analytics including followers count
export const getBusinessAnalytics = (userId) => {
  return http.get(`/business/${userId}/analytics`);
};

// Get PTA count for a specific event
export const getEventPTACount = (eventId) => {
  return http.get(`/event/pta/${eventId}`);
};
