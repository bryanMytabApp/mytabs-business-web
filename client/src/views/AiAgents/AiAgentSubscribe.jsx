import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { getMyServices, createServiceCheckout } from "../../services/entitlementService";
import { updateCustomerSubscription } from "../../services/paymentService";

/**
 * AI Agent subscription tier definitions.
 * Mirrors backend config in stripe-ai-agent-products.js.
 */
const AI_AGENT_TIERS = [
  {
    id: "ai_agent_starter",
    name: "Starter",
    price: 99,
    icon: RocketLaunchIcon,
    color: "#4CAF50",
    popular: false,
    features: {
      sourcingAgents: 2,
      creationAgents: 5,
      tokenPool: "500K",
    },
    featureList: [
      "2 Sourcing Agents",
      "5 Event Creation Agents",
      "500K tokens/month",
      "All 22 pre-built connectors",
      "Duplicate detection",
      "Draft review workflow",
      "Email notifications",
    ],
  },
  {
    id: "ai_agent_pro",
    name: "Pro",
    price: 299,
    icon: AutoAwesomeIcon,
    color: "#F09925",
    popular: true,
    features: {
      sourcingAgents: 5,
      creationAgents: 15,
      tokenPool: "2M",
    },
    featureList: [
      "5 Sourcing Agents",
      "15 Event Creation Agents",
      "2M tokens/month",
      "All 22 pre-built connectors",
      "Duplicate detection",
      "Draft review workflow",
      "Priority notifications",
      "Advanced analytics dashboard",
    ],
  },
  {
    id: "ai_agent_enterprise",
    name: "Enterprise",
    price: 799,
    icon: WorkspacePremiumIcon,
    color: "#7C4DFF",
    popular: false,
    features: {
      sourcingAgents: 10,
      creationAgents: 25,
      tokenPool: "10M",
    },
    featureList: [
      "10 Sourcing Agents",
      "25 Event Creation Agents",
      "10M tokens/month",
      "All 22 pre-built connectors",
      "Duplicate detection",
      "Draft review workflow",
      "Priority notifications",
      "Advanced analytics dashboard",
      "Dedicated support",
      "Custom connector requests",
    ],
  },
];

const TIER_ORDER = ["ai_agent_starter", "ai_agent_pro", "ai_agent_enterprise"];

/**
 * Determines the button label based on the user's current plan vs. the card's plan.
 */
const getButtonState = (tierId, currentTierId) => {
  if (!currentTierId) return { label: "Subscribe", action: "subscribe" };
  if (tierId === currentTierId) return { label: "Current Plan", action: "current" };

  const currentIndex = TIER_ORDER.indexOf(currentTierId);
  const targetIndex = TIER_ORDER.indexOf(tierId);

  if (targetIndex > currentIndex) return { label: "Upgrade", action: "upgrade" };
  return { label: "Downgrade", action: "downgrade" };
};

const AiAgentSubscribe = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);
  const [currentTierId, setCurrentTierId] = useState(null);

  useEffect(() => {
    const fetchEntitlements = async () => {
      try {
        const response = await getMyServices();
        const services = Array.isArray(response) ? response : (response?.services || []);
        // Find active ai_agent_* entitlement
        const aiAgentService = services.find(
          (s) =>
            (s.id || s.serviceId)?.startsWith("ai_agent_") &&
            (s.status === "active" || s.subscribed === true)
        );
        if (aiAgentService) {
          setCurrentTierId(aiAgentService.id);
        }
      } catch (err) {
        console.error("Failed to fetch entitlements:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchEntitlements();
  }, []);

  const handleSubscribe = async (tierId) => {
    setActionLoading(tierId);
    setError(null);
    try {
      const { checkoutUrl } = await createServiceCheckout(tierId);
      window.location.href = checkoutUrl;
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Something went wrong. Please try again.";
      setError(message);
      setActionLoading(null);
    }
  };

  const handleUpgradeDowngrade = async (tierId) => {
    setActionLoading(tierId);
    setError(null);
    try {
      await updateCustomerSubscription({ newServiceId: tierId });
      setCurrentTierId(tierId);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to update subscription. Please try again.";
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = (tierId, action) => {
    if (action === "current") return;
    if (action === "subscribe") {
      handleSubscribe(tierId);
    } else {
      handleUpgradeDowngrade(tierId);
    }
  };

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
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Back button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate(-1)}
        sx={{
          mb: 3,
          color: "#555",
          textTransform: "none",
          fontWeight: 600,
          "&:hover": { background: "rgba(0,0,0,0.04)" },
        }}
      >
        Back
      </Button>

      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 5 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            color: "#1D1B20",
            mb: 1.5,
            fontSize: { xs: "1.6rem", md: "2.2rem" },
          }}
        >
          AI Event Discovery Agents
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "#71727A", maxWidth: 560, mx: "auto", lineHeight: 1.7 }}
        >
          Automated event discovery powered by AI. Configure agents to crawl
          trusted sources, extract events, and create draft listings — 24/7.
        </Typography>
      </Box>

      {/* Error alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, maxWidth: 600, mx: "auto" }}>
          {error}
        </Alert>
      )}

      {/* Pricing cards */}
      <Grid container spacing={3} justifyContent="center" alignItems="stretch">
        {AI_AGENT_TIERS.map((tier) => {
          const TierIcon = tier.icon;
          const { label, action } = getButtonState(tier.id, currentTierId);
          const isCurrent = action === "current";
          const isPopular = tier.popular;

          return (
            <Grid item xs={12} sm={6} md={4} key={tier.id}>
              <Card
                elevation={isPopular ? 8 : 2}
                sx={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  border: isCurrent
                    ? `2px solid ${tier.color}`
                    : isPopular
                    ? "2px solid #F09925"
                    : "1px solid #E0E0E0",
                  position: "relative",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
                  },
                }}
              >
                {/* Popular badge */}
                {isPopular && !isCurrent && (
                  <Chip
                    label="Most Popular"
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: "#F09925",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  />
                )}

                {/* Current plan badge */}
                {isCurrent && (
                  <Chip
                    label="Current Plan"
                    icon={<CheckCircleIcon sx={{ color: "#fff !important", fontSize: 16 }} />}
                    size="small"
                    sx={{
                      position: "absolute",
                      top: 12,
                      right: 12,
                      background: tier.color,
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: 11,
                    }}
                  />
                )}

                <CardContent
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    flexGrow: 1,
                    p: 3,
                  }}
                >
                  {/* Tier icon and name */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 2,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: `${tier.color}15`,
                      }}
                    >
                      <TierIcon sx={{ color: tier.color, fontSize: 24 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#1D1B20" }}>
                      {tier.name}
                    </Typography>
                  </Box>

                  {/* Price */}
                  <Box sx={{ mb: 2.5 }}>
                    <Typography
                      component="span"
                      sx={{ fontSize: 36, fontWeight: 800, color: "#1D1B20" }}
                    >
                      ${tier.price}
                    </Typography>
                    <Typography
                      component="span"
                      sx={{ fontSize: 14, color: "#71727A", ml: 0.5 }}
                    >
                      /month
                    </Typography>
                  </Box>

                  {/* Key metrics */}
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 1.5,
                      mb: 2.5,
                      p: 2,
                      borderRadius: 2,
                      background: "#F8F9FA",
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: tier.color }}>
                        {tier.features.sourcingAgents}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#71727A", fontWeight: 600 }}>
                        Sourcing Agents
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: tier.color }}>
                        {tier.features.creationAgents}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#71727A", fontWeight: 600 }}>
                        Creation Agents
                      </Typography>
                    </Box>
                    <Box sx={{ gridColumn: "1 / -1" }}>
                      <Typography sx={{ fontSize: 20, fontWeight: 700, color: tier.color }}>
                        {tier.features.tokenPool}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#71727A", fontWeight: 600 }}>
                        Token Pool / month
                      </Typography>
                    </Box>
                  </Box>

                  {/* Feature list */}
                  <Box sx={{ flexGrow: 1, mb: 3 }}>
                    {tier.featureList.map((feature, idx) => (
                      <Box
                        key={idx}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 1,
                          mb: 1,
                        }}
                      >
                        <CheckCircleIcon
                          sx={{ fontSize: 16, color: tier.color, flexShrink: 0 }}
                        />
                        <Typography sx={{ fontSize: 13, color: "#555", fontWeight: 500 }}>
                          {feature}
                        </Typography>
                      </Box>
                    ))}
                  </Box>

                  {/* CTA button */}
                  <Button
                    fullWidth
                    variant={isCurrent ? "outlined" : "contained"}
                    disabled={isCurrent || actionLoading === tier.id}
                    onClick={() => handleAction(tier.id, action)}
                    sx={{
                      py: 1.4,
                      borderRadius: 2,
                      fontWeight: 700,
                      fontSize: 14,
                      textTransform: "none",
                      ...(isCurrent
                        ? {
                            borderColor: tier.color,
                            color: tier.color,
                          }
                        : {
                            background: tier.color,
                            "&:hover": {
                              background: tier.color,
                              opacity: 0.9,
                            },
                          }),
                    }}
                  >
                    {actionLoading === tier.id ? (
                      <CircularProgress size={20} sx={{ color: "#fff" }} />
                    ) : (
                      label
                    )}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Organization tier callout */}
      <Box
        sx={{
          mt: 5,
          p: 3,
          borderRadius: 3,
          background: "linear-gradient(135deg, #F8F9FA 0%, #EEF2FF 100%)",
          border: "1px solid #E0E0E0",
          textAlign: "center",
        }}
      >
        <Typography sx={{ fontWeight: 700, color: "#1D1B20", mb: 0.5 }}>
          Need unlimited agents and tokens?
        </Typography>
        <Typography sx={{ fontSize: 14, color: "#71727A", mb: 2 }}>
          Our Organization tier offers unlimited Sourcing Agents, Creation Agents,
          and tokens with custom pricing.
        </Typography>
        <Button
          variant="outlined"
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderColor: "#7C4DFF",
            color: "#7C4DFF",
            "&:hover": { borderColor: "#5E35B1", background: "rgba(124,77,255,0.04)" },
          }}
          onClick={() => navigate("/admin/service/organization")}
        >
          Contact Sales →
        </Button>
      </Box>
    </Box>
  );
};

export default AiAgentSubscribe;
