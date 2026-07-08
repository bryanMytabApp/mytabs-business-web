import http from '../utils/axios/http';

/**
 * Submit user feedback (rating + optional text) to the backend.
 * @param {number} rating - Integer 1–5
 * @param {string} feedback - Text, 0–2000 characters
 * @returns {Promise<object>} Response data from the API
 */
export const sendFeedback = async (rating, feedback) => {
  try {
    const response = await http.post('email/sendFeedback', { rating, feedback });
    return response.data;
  } catch (error) {
    console.error('Error sending feedback:', error);
    throw error;
  }
};
