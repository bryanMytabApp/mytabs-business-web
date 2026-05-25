import http from "../utils/axios/http";

export const addMember = (eventId, userId, role) => {
  return http.post(`/events/${eventId}/members`, { userId, role })
};

export const removeMember = (eventId, userId) => {
  return http.delete(`/events/${eventId}/members/${userId}`)
};

export const getMembers = (eventId) => {
  return http.get(`/events/${eventId}/members`)
};
