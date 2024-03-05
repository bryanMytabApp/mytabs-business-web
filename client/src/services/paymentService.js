import http from "../utils/axios/http"

export const createCheckoutSession = async (sessionData) => {
  try {
    const {data} = await http.post("payments/checkout-session", sessionData, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Checkout Session Created:", data);
    return data
  } catch (error) {
    console.error("Error creating checkout session:", error.response || error);
  }
};

