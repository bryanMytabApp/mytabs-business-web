import http from "../utils/axios/http"
import configJSON from "../config.json"

// The organizer-payout endpoints live on a SEPARATE REST API (Stripe Connect), not
// the core backend. Override baseURL per-request so the shared `http` client's auth
// (Cognito token) + refresh interceptors still apply.
const PAYOUTS_BASE_URL = configJSON.payoutsUrl;

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

// ─── Organizer Payouts (Stripe Connect — TabsTickets account) ──────────────────
// These are the SELF-SERVE (business-owner) payout endpoints. They act on the
// caller's OWN business only (authorized server-side via the org/owner context).
// Distinct from subscription billing above — this is how an organizer connects a
// bank account to RECEIVE ticket revenue (not a card to PAY MyTabs).

// Fetch the caller's own Payout_Status (none | onboarding | enabled | restricted).
// `businessId` is the SPECIFIC business _id (required — the backend never guesses which
// business when an owner has several).
export const getPayoutStatus = async (businessId) => {
  try {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : "";
    const response = await http.get(`payouts/status${query}`, { baseURL: PAYOUTS_BASE_URL });
    return response.data;
  } catch (error) {
    console.error("Error getting payout status", error.response || error);
    throw error;
  }
};

// Provision (or reuse) the caller's connected account and return a Stripe-hosted
// onboarding link. The browser redirects to `url` to complete bank/KYC on Stripe.
// (Legacy redirect flow — the embedded flow below is preferred.)
export const createPayoutOnboardingLink = async () => {
  try {
    const response = await http.post("payouts/onboarding-link", {}, { baseURL: PAYOUTS_BASE_URL });
    return response.data;
  } catch (error) {
    console.error("Error creating payout onboarding link", error.response || error);
    throw error;
  }
};

// Provision (or reuse) the caller's connected account and return an Account Session
// client secret for EMBEDDED onboarding (Connect components) — the organizer completes
// bank/KYC inline on keeptabs.app, no redirect to Stripe.
// Returns { clientSecret, accountId, publishableKey }.
export const createPayoutAccountSession = async (businessId) => {
  try {
    const response = await http.post(
      "payouts/account-session",
      businessId ? { businessId } : {},
      { baseURL: PAYOUTS_BASE_URL }
    );
    return response.data;
  } catch (error) {
    console.error("Error creating payout account session", error.response || error);
    throw error;
  }
};

// Reset payout setup for the caller's own business: releases the connected account and
// clears payout fields so onboarding can start fresh. `businessId` is the specific _id.
export const resetPayouts = async (businessId) => {
  try {
    const response = await http.post(
      "payouts/reset",
      businessId ? { businessId } : {},
      { baseURL: PAYOUTS_BASE_URL }
    );
    return response.data;
  } catch (error) {
    console.error("Error resetting payouts", error.response || error);
    throw error;
  }
};

// Payout history (journal-derived) for the caller's own business — Payouts page.
// Returns { summary, rows, ownedByOrg, isChildInheriting }.
export const getPayoutHistory = async (businessId) => {
  try {
    const response = await http.get("payouts/history", {
      baseURL: PAYOUTS_BASE_URL,
      params: businessId ? { businessId } : {},
    });
    return response.data;
  } catch (error) {
    console.error("Error loading payout history", error.response || error);
    throw error;
  }
};

// Payout details for a specific event — Ticket Management page.
// Returns { eventId, summary, rows }.
export const getEventPayouts = async (eventId, businessId) => {
  try {
    const response = await http.get("payouts/event", {
      baseURL: PAYOUTS_BASE_URL,
      params: { eventId, ...(businessId ? { businessId } : {}) },
    });
    return response.data;
  } catch (error) {
    console.error("Error loading event payouts", error.response || error);
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
