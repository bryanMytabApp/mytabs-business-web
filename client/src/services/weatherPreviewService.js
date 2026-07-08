import http from "../utils/axios/http";
import axios from "axios";
import configJSON from "../config.json";

/**
 * Fetches weather preview data for event creation.
 * Uses a standalone axios instance (no 401 interceptor) because weather is
 * non-critical and should never trigger a forced logout.
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} eventDate - ISO-8601 date-time string
 * @param {AbortSignal} [signal] - AbortController signal for cancellation
 * @returns {Promise<Object>} Weather preview response
 */
export const getWeatherPreview = (latitude, longitude, eventDate, signal) => {
  const token = localStorage.getItem("idToken");
  return axios.get(`${configJSON.backendUrl}weather/preview`, {
    params: { latitude, longitude, eventDate },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
    timeout: 15000,
  });
};
