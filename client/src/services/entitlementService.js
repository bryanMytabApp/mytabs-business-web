import http from "../utils/axios/http";

/**
 * Fetch the current user's service entitlements.
 * Returns a merged list of free services (always active) and paid/contract entitlements.
 */
export const getMyServices = async () => {
  try {
    const response = await http.get("entitlements/my-services");
    return response.data;
  } catch (error) {
    console.error("Error fetching entitlements:", error.response || error);
    throw error;
  }
};

/**
 * Create a Stripe Checkout session for a paid service subscription.
 * @param {string} serviceId - The service catalog ID to subscribe to
 * @returns {{ checkoutUrl: string, sessionId: string }}
 */
export const createServiceCheckout = async (serviceId) => {
  try {
    const response = await http.post("entitlements/checkout", { serviceId });
    return response.data;
  } catch (error) {
    console.error("Error creating service checkout:", error.response || error);
    throw error;
  }
};

/**
 * Deactivate (cancel) a service subscription.
 * For paid services this cancels the Stripe subscription; for contract services it marks the entitlement as cancelled.
 * @param {string} serviceId - The service catalog ID to deactivate
 * @returns {{ success: boolean, message: string }}
 */
export const deactivateService = async (serviceId) => {
  try {
    const response = await http.post("entitlements/deactivate", { serviceId });
    return response.data;
  } catch (error) {
    console.error("Error deactivating service:", error.response || error);
    throw error;
  }
};

/**
 * Admin-only: activate a contract service for a specific user.
 * @param {string} userId - The target user's ID
 * @param {string} serviceId - The service catalog ID to activate
 * @param {object} contractDetails - Custom pricing and contract terms
 * @returns {{ entitlement: object }}
 */
export const activateServiceAdmin = async (userId, serviceId, contractDetails) => {
  try {
    const response = await http.post("entitlements/activate", {
      userId,
      serviceId,
      contractDetails,
    });
    return response.data;
  } catch (error) {
    console.error("Error activating service (admin):", error.response || error);
    throw error;
  }
};
