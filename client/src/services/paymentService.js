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
    console.log("System Subscriptions:", response);
    return response;
  } catch ( error ) {
    console.error("Error getting system subscriptions", error.response || error)
  }
}