import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { getMyServices } from "../../services/entitlementService";

/**
 * Map tier IDs to display names.
 */
const TIER_NAMES = {
  ai_agent_starter: "Starter",
  ai_agent_pro: "Pro",
  ai_agent_enterprise: "Enterprise",
  ai_agent_organization: "Organization",
};

/**
 * AiAgentCheckoutSuccess
 *
 * Shown after Stripe Checkout completes for an AI Agent subscription.
 * Displays: "Subscription active!", the tier name, and next steps.
 */
const AiAgentCheckoutSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tierName, setTierName] = useState(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const fetchActiveTier = async () => {
      try {
        const services = await getMyServices();
        const aiService = (services || []).find(
          (s) => s.id?.startsWith("ai_agent_") && s.status === "active"
        );
        if (aiService) {
          setTierName(TIER_NAMES[aiService.id] || aiService.id);
        }
      } catch (err) {
        console.error("Failed to fetch entitlements after checkout:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchActiveTier();
  }, []);

  if (loading) {
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

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        p: { xs: 2, md: 4 },
      }}
    >
      <Paper
        elevation={3}
        sx={{
          maxWidth: 520,
          width: "100%",
          p: { xs: 3, md: 5 },
          borderRadius: 3,
          textAlign: "center",
        }}
      >
        {/* Success icon */}
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#E8F5E9",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mx: "auto",
            mb: 3,
          }}
        >
          <CheckCircleIcon sx={{ fontSize: 40, color: "#4CAF50" }} />
        </Box>

        {/* Title */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: "#1D1B20",
            mb: 1,
            fontSize: { xs: "1.5rem", md: "2rem" },
          }}
        >
          Subscription Active!
        </Typography>

        {/* Tier name */}
        {tierName && (
          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              color: "#F09925",
              mb: 3,
            }}
          >
            AI Agent {tierName} Plan
          </Typography>
        )}

        {/* Next steps */}
        <Box
          sx={{
            background: "#F8F9FA",
            borderRadius: 2,
            p: 3,
            mb: 3,
            textAlign: "left",
          }}
        >
          <Typography
            sx={{ fontWeight: 700, color: "#1D1B20", mb: 1.5, fontSize: 15 }}
          >
            Next Steps
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <RocketLaunchIcon sx={{ color: "#F09925", fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, color: "#555" }}>
                Create your first AI Sourcing Agent
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <AutoAwesomeIcon sx={{ color: "#F09925", fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, color: "#555" }}>
                Configure cities, categories, and trusted sources
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <CheckCircleIcon sx={{ color: "#F09925", fontSize: 20 }} />
              <Typography sx={{ fontSize: 14, color: "#555" }}>
                Agents will start discovering events automatically
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* CTA */}
        <Button
          variant="contained"
          fullWidth
          onClick={() => navigate("/admin/ai-agents/subscribe")}
          sx={{
            py: 1.4,
            borderRadius: 2,
            fontWeight: 700,
            fontSize: 14,
            textTransform: "none",
            background: "#F09925",
            "&:hover": { background: "#D88820", opacity: 0.95 },
          }}
        >
          Create Your First Agent
        </Button>

        {/* Session reference */}
        {sessionId && (
          <Typography
            sx={{ mt: 2, fontSize: 11, color: "#AEAEAE" }}
          >
            Session: {sessionId}
          </Typography>
        )}
      </Paper>
    </Box>
  );
};

export default AiAgentCheckoutSuccess;
