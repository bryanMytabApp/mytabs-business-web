import React, { useState, useEffect } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { getMyOrganizations } from "../services/organizationService";

/**
 * Route guard wrapper for `/admin/ai-agents/*` routes.
 *
 * Access is restricted to accounts belonging to the UrbanHTX organization only.
 * - If loading: shows a spinner
 * - If not in UrbanHTX org: shows access denied
 * - If in UrbanHTX org: renders children with full access
 */
const AiAgentRouteGuard = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isUrbanHTX, setIsUrbanHTX] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const checkAccess = async () => {
      try {
        const res = await getMyOrganizations();
        if (cancelled) return;
        const orgs = res?.data?.organizations || res?.data || [];
        const hasUrbanHTX = orgs.some(
          (org) => {
            const name = (org.name || '').replace(/\s+/g, '').toLowerCase();
            return name === 'urbanhtx' || org.platformOwned === true;
          }
        );
        setIsUrbanHTX(hasUrbanHTX);
      } catch {
        // If we can't verify org membership, deny access
        setIsUrbanHTX(false);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    checkAccess();
    return () => { cancelled = true; };
  }, []);

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

  // Not in UrbanHTX organization — block access
  if (!isUrbanHTX) {
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
          Access Restricted
        </Typography>
        <Typography
          sx={{ color: "#71727A", mb: 3, maxWidth: 480, lineHeight: 1.6 }}
        >
          The AI Event Discovery Dashboard is only available to UrbanHTX
          organization accounts. Contact your administrator for access.
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

  // UrbanHTX org member — allow full access
  return <>{children}</>;
};

export default AiAgentRouteGuard;
