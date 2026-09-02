import React, { useState, useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { Navigate } from "react-router-dom";
import { getCurrentUserId, isSuperAdmin } from "../utils/authUtils";
import { getCustomerSubscription, getUserPremiumSubscription } from "../services/paymentService";
import { getMyOrganizations } from "../services/organizationService";

/**
 * SubscriptionGuard — gates the authenticated app shell.
 *
 * A logged-in customer must NOT reach the main app pages without an active
 * subscription; if they have none they are redirected to /subscription until they
 * subscribe. An account counts as subscribed when ANY of the following holds:
 *   1. Super_Admin — always allowed (they operate the console).
 *   2. A live Stripe subscription (getCustomerSubscription → hasSubscription).
 *   3. Organization membership (org members ride the org's plan).
 *   4. An active DynamoDB Subscription row — INCLUDING exempt (billingMode='exempt'):
 *      exempt accounts have a real, never-charged subscription and full access, but
 *      NO Stripe subscription, so the Stripe-only check (#2) would miss them.
 *
 * While the async checks run we render a spinner so the app never flashes before a
 * redirect. Any allow-signal short-circuits the remaining checks. If every check
 * fails (or errors) the customer is sent to /subscription.
 */
const SubscriptionGuard = ({ children }) => {
  const [status, setStatus] = useState("checking"); // 'checking' | 'allowed' | 'blocked'

  useEffect(() => {
    let cancelled = false;
    const settle = (next) => { if (!cancelled) setStatus(next); };

    const check = async () => {
      // 1. Super admins always pass.
      try {
        if (isSuperAdmin()) return settle("allowed");
      } catch { /* fall through */ }

      const userId = getCurrentUserId();

      // 2. Live Stripe subscription (paid).
      if (userId) {
        try {
          const res = await getCustomerSubscription({ userId });
          if (cancelled) return;
          if (res?.data?.hasSubscription && res.data.priceId) return settle("allowed");
        } catch { /* no Stripe subscription */ }
      }

      // 3. Organization membership.
      try {
        const orgsRes = await getMyOrganizations();
        if (cancelled) return;
        const orgs = orgsRes?.data?.organizations || orgsRes?.data || [];
        if (Array.isArray(orgs) && orgs.length > 0) return settle("allowed");
      } catch { /* not in an org */ }

      // 4. Active DynamoDB Subscription row — including EXEMPT (no Stripe sub).
      if (userId) {
        try {
          const res = await getUserPremiumSubscription(userId);
          if (cancelled) return;
          const row = res?.data || null;
          const active = row && row.isActive === true;
          const exempt = row && row.billingMode === "exempt";
          if (active || exempt) return settle("allowed");
        } catch { /* no DynamoDB subscription row */ }
      }

      // No subscription (paid, org, or exempt) — send to the subscription page.
      settle("blocked");
    };

    check();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress sx={{ color: "#F09925" }} />
      </Box>
    );
  }

  if (status === "blocked") {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default SubscriptionGuard;
