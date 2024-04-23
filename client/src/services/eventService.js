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

export const getEventsByUserId = (userId) => {
  return http.get(`/event/${userId}/all`)
};

export const getEvent = (userId, eventId) => {
  return http.get(`/event/${userId}/id/${eventId}`)
};

export const getPresignedUrlForEvent = (userId) => {
  return http.post(`/event/presigned-url`, { userId })
};


function enhanceError(error) {
  if (error.response && typeof error.response.data === "string") {
    try {
      const parsedData = JSON.parse(error.response.data);
      if (parsedData.error) {
        error.enhancedMessage = parsedData.error;
      }
    } catch (parseError) {
      console.error("Error parsing error response data:", parseError);
    }
  }
  return error;
}
