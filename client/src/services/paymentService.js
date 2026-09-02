import http from "../utils/axios/http"

export const createCheckoutSession = async (sessionData) => {
  try {
    const {data} = await http.post("payments/checkout-session", sessionData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    return data
  } catch (error) {
    console.error("Error creating checkout session:", error.response || error);
    throw error;
  }
};

export const getSystemSubscriptions = async () => {
  try {
    const response = await http.get( "payments/subscription/all" );
    return response;
  } catch ( error ) {
    console.error("Error getting system subscriptions", error.response || error)
    throw error;
  }
};

export const updateCustomerSubscription = async (subscriptionData) => {
  try {
    const response = await http.put( "payments/subscription/update", subscriptionData );
    return response;
  } catch ( error ) {
    console.error("Error updating customer subscription", error.response || error)
    throw error;
  }
};

export const getCustomerSubscription = async (userIdObj) => {
  try {
    const response = await http.post( "payments/subscription/customer", userIdObj );
    return response;
  } catch ( error ) {
    console.error("Error getting customer subscription", error.response || error)
    throw error;
  }
};

// Reads the DynamoDB Subscription entity row for a user (the source of truth that
// includes EXEMPT accounts — billingMode='exempt' rows have no Stripe subscription).
// Used by the subscription gate so exempt customers are recognized as subscribed.
// Returns the first row (or null); may 404/empty for users with no row.
export const getUserPremiumSubscription = async (userId) => {
  const response = await http.get(`subscription/${encodeURIComponent(userId)}`);
  return response;
};

export const cancelCustomerSubscription = async (userId) => {
  try {
    const response = await http.post( "payments/subscription/cancel", {userId} );
    return response.data;
  } catch ( error ) {
    console.error("Error canceling customer subscription", error.response || error)
    throw error;
  }
}

export const getCustomerInvoices = async (userId) => {
  try {
    const response = await http.post("payments/invoices", { userId });
    return response.data;
  } catch (error) {
    console.error("Error getting customer invoices", error.response || error);
    throw error;
  }
};

export const getCustomerPaymentMethods = async (userId) => {
  try {
    const response = await http.post("payments/payment-methods", { userId });
    return response.data;
  } catch (error) {
    console.error("Error getting payment methods", error.response || error);
    throw error;
  }
};

export const createSetupSession = async (userId) => {
  try {
    // Get email from the ID token
    let email = '';
    const idToken = localStorage.getItem('idToken');
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        email = payload.email || '';
      } catch (e) { /* ignore */ }
    }
    const response = await http.post("payments/setup-session", { userId, email });
    return response.data;
  } catch (error) {
    console.error("Error creating setup session", error.response || error);
    throw error;
  }
};
