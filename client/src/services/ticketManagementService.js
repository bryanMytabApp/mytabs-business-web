import http from "../utils/axios/http";

/**
 * Ticket Management Service
 * Handles ticket cancellation, customer detail editing, and ticket resend operations
 */

/**
 * Cancel a ticket with optional refund
 * @param {string} ticketId - Ticket ID to cancel
 * @param {boolean} withRefund - Whether to process a refund
 * @param {string} reason - Cancellation reason
 * @param {string} userId - Admin user ID
 * @returns {Promise} Cancellation result
 */
export const cancelTicket = async (ticketId, withRefund, reason, userId) => {
  try {
    const response = await http.post("payments/cancelTicket", {
      ticketId,
      withRefund,
      reason,
      userId
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error cancelling ticket:", error.response || error);
    throw error;
  }
};

/**
 * Update customer details for a ticket
 * @param {string} ticketId - Ticket ID
 * @param {Object} customerDetails - Updated customer information
 * @param {string} customerDetails.email - Customer email
 * @param {string} customerDetails.name - Customer name
 * @param {string} customerDetails.phone - Customer phone
 * @param {string} userId - Admin user ID
 * @returns {Promise} Update result
 */
export const updateCustomerDetails = async (ticketId, customerDetails, userId) => {
  try {
    const response = await http.post("payments/updateCustomerDetails", {
      ticketId,
      customerDetails,
      userId
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error updating customer details:", error.response || error);
    throw error;
  }
};

/**
 * Resend ticket to customer
 * @param {string} ticketId - Ticket ID to resend
 * @param {string} userId - Admin user ID
 * @returns {Promise} Resend result
 */
export const resendTicket = async (ticketId, userId) => {
  try {
    const response = await http.post("payments/resendTicket", {
      ticketId,
      userId
    }, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error resending ticket:", error.response || error);
    throw error;
  }
};

/**
 * Get ticket details by ticket ID
 * @param {string} ticketId - Ticket ID
 * @returns {Promise} Ticket details
 */
export const getTicketDetails = async (ticketId) => {
  try {
    const response = await http.get(`payments/ticket/${ticketId}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error getting ticket details:", error.response || error);
    throw error;
  }
};

/**
 * Get customer service logs for a ticket
 * @param {string} ticketId - Ticket ID
 * @returns {Promise} Service logs
 */
export const getServiceLogs = async (ticketId) => {
  try {
    const response = await http.get(`payments/ticket/${ticketId}/logs`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error getting service logs:", error.response || error);
    throw error;
  }
};

/**
 * Get all tickets for a specific event
 * @param {string} eventId - Event ID
 * @returns {Promise} List of tickets for the event
 */
export const getTicketsByEvent = async (eventId) => {
  try {
    const response = await http.get(`payments/tickets/event/${eventId}`, {
      headers: {
        "Content-Type": "application/json",
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error getting tickets by event:", error.response || error);
    throw error;
  }
};

/**
 * Get ticket statistics for an event
 * @param {string} eventId - Event ID
 * @returns {Promise} Ticket statistics
 */
export const getEventTicketStats = async (eventId) => {
  try {
    const response = await http.get(`payments/tickets/event/${eventId}/stats`, {
      headers: {
        "Content-Type": "application/json",
      }
    });
    
    return response.data;
  } catch (error) {
    console.error("Error getting event ticket stats:", error.response || error);
    throw error;
  }
};

export default {
  cancelTicket,
  updateCustomerDetails,
  resendTicket,
  getTicketDetails,
  getServiceLogs,
  getTicketsByEvent,
  getEventTicketStats
};
