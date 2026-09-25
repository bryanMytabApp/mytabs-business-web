import React, { useState, useEffect } from "react";
import { Box, CircularProgress, Typography, Button } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { isSuperAdmin } from "../utils/authUtils";
import { resolveAccountPlanLevel } from "../utils/resolveAccountPlanLevel";

/**
 * PlanLevelRouteGuard — gates a route by the account's subscription PLAN LEVEL.
 *
 * Plan levels: Starter=1, Growth=2, Pro=3, Enterprise=4 (match the Price_Card and
 * the backend planLevelResolver). Engagements/Experiences are a Growth+ feature
 * (minLevel=2) per the sales sheet ("available on every paid plan except Starter"),
 * so this replaces the old UrbanHTX-only gate.
 *
 * Resolution uses getCustomerSubscription with the selected business so the backend
 * resolves the owning account — including EXEMPT accounts, which carry a planId (and
 * thus a level) but no Stripe subscription. Super admins always pass. On error we
 * fail closed (deny), matching the previous guard's conservative behavior.
 *
 * @param {number} minLevel - minimum plan level required (default 2 = Growth)
 * @param {string} featureName - shown in the access-denied message
 */
const PlanLevelRouteGuard = ({ children, minLevel = 2, featureName = "This feature" }) => {
  const [status, setStatus] = useState("checking"); // 'checking' | 'allowed' | 'blocked'
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const settle = (next) => { if (!cancelled) setStatus(next); };

    const check = async () => {
      try {
        if (isSuperAdmin()) return settle("allowed");
      } catch { /* fall through */ }

      try {
        // Shared resolver: robust to exempt accounts (rows keyed by the account
        // owner's userId, not necessarily the login id). Same logic the sidebar uses.
        const level = await resolveAccountPlanLevel();
        if (cancelled) return;
        if (Number.isFinite(level) && level >= minLevel) return settle("allowed");
        return settle("blocked");
      } catch {
        return settle("blocked"); // fail closed
      }
    };

    check();
    return () => { cancelled = true; };
  }, [minLevel]);

  if (status === "checking") {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: "#F09925" }} />
      </Box>
    );
  }

  if (status === "blocked") {
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
        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1D1B20", mb: 1 }}>
          Upgrade required
        </Typography>
        <Typography sx={{ color: "#71727A", mb: 3, maxWidth: 480, lineHeight: 1.6 }}>
          {featureName} is included with the Growth plan and above. Upgrade your plan to unlock it.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate("/admin/home")}
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
          Go to Home
        </Button>
      </Box>
    );
  }

  return <>{children}</>;
};

export default PlanLevelRouteGuard;
