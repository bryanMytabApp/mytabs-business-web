import React from "react";
import { Box, Typography, Button, CircularProgress, Alert } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import { useNavigate } from "react-router-dom";
import useAiAgentEntitlement from "../hooks/useAiAgentEntitlement";

/**
 * Route guard wrapper for `/business/ai-agents/*` routes.
 *
 * - If loading: shows a spinner
 * - If no subscription: shows the pricing page / subscribe CTA
 * - If subscription lapsed: shows a renewal prompt and blocks agent operations
 * - If subscription active: renders children with full access
 */
const AiAgentRouteGuard = ({ children }) => {
  // TEMPORARY: Bypass subscription check — always allow access
  // TODO: Re-enable once entitlements API is fully wired
  return <>{children}</>;

  // eslint-disable-next-line no-unreachable
  const { hasSubscription, isLapsed, isLoading, error } = useAiAgentEntitlement();
  const navigate = useNavigate();

  if (isLoading) {
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

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 600, mx: "auto" }}>
        <Alert severity="error">
          Unable to verify subscription status. Please try again later.
        </Alert>
      </Box>
    );
  }

  // No subscription — show subscribe CTA
  if (!hasSubscription && !isLapsed) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          textAlign: "center",
          p: 4,
        }}
      >
        <LockOutlinedIcon sx={{ fontSize: 64, color: "#F09925", mb: 2 }} />
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: "#1D1B20", mb: 1 }}
        >
          AI Event Discovery Agents
        </Typography>
        <Typography
          sx={{ color: "#71727A", mb: 3, maxWidth: 480, lineHeight: 1.6 }}
        >
          Subscribe to AI Event Discovery to unlock automated event sourcing,
          intelligent extraction, and draft management — all powered by AI.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/admin/ai-agents/subscribe")}
          sx={{
            background: "#F09925",
            textTransform: "none",
            fontWeight: 700,
            px: 4,
            py: 1.5,
            borderRadius: 2,
            "&:hover": { background: "#D4820F" },
          }}
        >
          View Plans & Subscribe
        </Button>
      </Box>
    );
  }

  // Subscription lapsed — show renewal prompt, block operations
  if (isLapsed) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          textAlign: "center",
          p: 4,
        }}
      >
        <AutorenewIcon sx={{ fontSize: 64, color: "#E65100", mb: 2 }} />
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, color: "#1D1B20", mb: 1 }}
        >
          Subscription Expired
        </Typography>
        <Typography
          sx={{ color: "#71727A", mb: 1, maxWidth: 480, lineHeight: 1.6 }}
        >
          Your AI Agent subscription has lapsed. Your agents are paused and
          draft events are retained for 30 days. Renew now to resume operations.
        </Typography>
        <Typography
          sx={{ color: "#E65100", fontSize: 13, mb: 3, fontWeight: 600 }}
        >
          Agent operations are blocked until your subscription is renewed.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/admin/ai-agents/subscribe")}
          sx={{
            background: "#E65100",
            textTransform: "none",
            fontWeight: 700,
            px: 4,
            py: 1.5,
            borderRadius: 2,
            "&:hover": { background: "#BF360C" },
          }}
        >
          Renew Subscription
        </Button>
      </Box>
    );
  }

  // Active subscription — allow full access
  return <>{children}</>;
};

export default AiAgentRouteGuard;
