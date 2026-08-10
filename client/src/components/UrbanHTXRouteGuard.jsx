import React, { useState, useEffect } from "react";
import { Box, Typography, Button, CircularProgress } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import { getMyOrganizations } from "../services/organizationService";

/**
 * Generic route guard that restricts access to UrbanHTX organization accounts only.
 *
 * Use this to wrap any route/page that should only be visible to UrbanHTX
 * org payers, linked businesses, or members.
 *
 * Props:
 * - children: content to render when access is granted
 * - featureName: human-readable name of the restricted feature (for the denied message)
 */
const UrbanHTXRouteGuard = ({ children, featureName = "This feature" }) => {
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
          {featureName} is only available to UrbanHTX organization accounts.
          Contact your administrator for access.
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

export default UrbanHTXRouteGuard;
