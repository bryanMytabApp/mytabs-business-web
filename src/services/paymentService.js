import http from "../utils/axios/http"

export const createCheckoutSession = async (sessionData) => {
  try {
    const {data, ...res} = await http.post("payments/checkout-session", sessionData, {
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

export const cancelCustomerSubscription = async (userId) => {
  try {
    const response = await http.post( "payments/subscription/cancel", {userId} );
    return response.data;
  } catch ( error ) {
    console.error("Error canceling customer subscription", error.response || error)
    throw error;
  }
}