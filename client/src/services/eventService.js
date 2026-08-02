import http from "../utils/axios/http";

export const createEvent = (params) => {
  return http.post('/event', params)
};

export const updateEvent = (params) => {
  return http.put('/event', params)
};

export const deleteEvent = (params) => {
  return http.post('/event/delete', params)
};

export const getEventsByUserId = async (userId) => {
  // Fetch events using the X-Business-Id header (business context).
  const bizRes = await http.get(`/event/${userId}/all`).catch(() => ({ data: [] }));
  const bizEvents = bizRes.data || [];

  // Also fetch events without the business header (events stored under user's own ID).
  // This handles events created before business context was added.
  const selectedBiz = sessionStorage.getItem("selectedBusinessId");
  if (selectedBiz && selectedBiz !== userId) {
    const userRes = await http.get(`/event/${userId}/all`, { skipBusinessContext: true }).catch(() => ({ data: [] }));
    const userEvents = userRes.data || [];
    // Merge without duplicates
    const existingIds = new Set(bizEvents.map(e => e._id));
    const merged = [...bizEvents, ...userEvents.filter(e => !existingIds.has(e._id))];
    return { data: merged };
  }

  return bizRes;
};

export const getEvent = (userId, eventId) => {
  return http.get(`/event/${userId}/id/${eventId}`)
};

export const getPresignedUrlForEvent = (data) => {
  return http.post(`/event/presigned-url`, data)
};
