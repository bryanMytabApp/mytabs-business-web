import http from "../utils/axios/http"

export const createCheckoutSession = async (sessionData) => {
  try {
    const {data, ...res} = await http.post("payments/checkout-session", sessionData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log( "Checkout Session Created:", data );
    console.log( "Response:", res );
    return data
  } catch (error) {
    console.error("Error creating checkout session:", error.response || error);
  }
};

export const getSystemSubscriptions = async () => {
  try {
    const response = await http.get( "payments/subscription/all" );
    return response;
  } catch ( error ) {
    console.error("Error getting system subscriptions", error.response || error)
  }
};

export const updateCustomerSubscription = async (subscriptionData) => {
  try {
    const response = await http.put( "payments/subscription/update", subscriptionData );
    console.log( "update response:", response );
    return response;
  } catch ( error ) {
    console.error("Error updating customer subscription", error.response || error)
  }
};

export const getCustomerSubscription = async (userIdObj) => {
  try {
    const response = await http.post( "payments/subscription/customer", userIdObj );
    console.log( "get response:", response );
    return response;
  } catch ( error ) {
    console.error("Error getting customer subscription", error.response || error)
  }
}