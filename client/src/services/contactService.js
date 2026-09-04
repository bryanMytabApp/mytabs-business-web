import http from '../utils/axios/http';

/**
 * Submit the marketing-site "Talk to sales" contact form to the public backend
 * endpoint, which emails the lead to the sales inbox (michael@mytabs.app) via SES.
 * Public endpoint — no auth required.
 *
 * @param {{ fullName: string, email: string, organization?: string, describes?: string, message?: string }} payload
 * @returns {Promise<object>} Response data ({ ok: true } on success)
 */
export const sendContactSales = async (payload) => {
  const response = await http.post('email/contact-sales', payload);
  return response.data;
};
