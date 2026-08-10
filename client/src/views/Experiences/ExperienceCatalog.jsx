import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PollOutlinedIcon from "@mui/icons-material/PollOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import { getCatalog, getFilteredCatalog, createInstance } from "../../services/experienceService";
import useExperienceEntitlement from "../../hooks/useExperienceEntitlement";

const ACCENT = "#F09925";

/**
 * Map experience type keys to MUI icons.
 */
const TYPE_ICONS = {
  raffles: EmojiEventsOutlinedIcon,
  live_polls: PollOutlinedIcon,
  trivia: QuizOutlinedIcon,
  surveys: InsightsOutlinedIcon,
  pulse_feedback: FeedbackOutlinedIcon,
  prediction_challenges: InsightsOutlinedIcon,
  instant_win: CasinoOutlinedIcon,
  digital_scratch_offs: CardGiftcardOutlinedIcon,
  treasure_hunts: PlaceOutlinedIcon,
  check_in_challenges: CheckCircleOutlineIcon,
  photo_contests: CameraAltOutlinedIcon,
  social_wall: ForumOutlinedIcon,
  ai_concierge: SmartToyOutlinedIcon,
  digital_coupons: LocalOfferOutlinedIcon,
  sponsor_promotions: CampaignOutlinedIcon,
  loyalty_rewards: StarOutlinedIcon,
  leaderboards: LeaderboardOutlinedIcon,
};

/**
 * Fallback icon for unknown types.
 */
const DefaultIcon = ConfirmationNumberOutlinedIcon;

/**
 * ExperienceCatalog — grid of available experience types for an event.
 * Shows icons, descriptions, locked state for subscription-gated types,
 * and supports filtering by event attributes.
 *
 * Route: /admin/my-events/:eventId/experiences/catalog
 */
const ExperienceCatalog = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { isExperienceTypeAvailable, getRequiredTier, isLoading: entitlementLoading } = useExperienceEntitlement();

  const [catalogTypes, setCatalogTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFilteredCatalog(eventId);
      const data = res.data?.data?.types || res.data?.data || res.data?.types || res.data || [];
      setCatalogTypes(Array.isArray(data) ? data : []);
    } catch (err) {
      // Fallback to unfiltered catalog
      try {
        const res = await getCatalog(eventId);
        const data = res.data?.data?.types || res.data?.data || res.data?.types || res.data || [];
        setCatalogTypes(Array.isArray(data) ? data : []);
      } catch (fallbackErr) {
        const msg = fallbackErr.response?.data?.message || fallbackErr.message || "Failed to load catalog";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  /**
   * Handle selecting an experience type to create an instance.
   */
  const handleSelectType = async (type) => {
    const typeKey = type.typeId || type.id || type.key;

    setCreating(typeKey);
    try {
      const res = await createInstance(eventId, { experienceType: typeKey, name: type.name });
      const newInstance = res.data?.data || res.data;
      const experienceId = newInstance?.experienceId || newInstance?.id;
      if (experienceId) {
        navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
      } else {
        navigate(`/admin/my-events/${eventId}/experiences`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to create engagement";
      setError(msg);
    } finally {
      setCreating(null);
    }
  };

  // Extract unique categories from catalog
  const categories = [...new Set(catalogTypes.map((t) => t.category).filter(Boolean))].sort();

  // Filter by selected category
  const filteredTypes = selectedCategory
    ? catalogTypes.filter((t) => t.category === selectedCategory)
    : catalogTypes;

  if (loading || entitlementLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <IconButton
          size="small"
          onClick={() => navigate(`/admin/my-events/${eventId}/experiences`)}
          sx={{ color: "#616161" }}
        >
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
          Engagement Catalog
        </Typography>
        <Box sx={{ flex: 1 }} />
        <IconButton onClick={fetchCatalog} size="small" disabled={loading} sx={{ color: ACCENT }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography sx={{ color: "#71727A", fontSize: 14, mb: 3, ml: 5 }}>
        Select an experience type to add to your event.
      </Typography>

      {/* Error */}
      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={fetchCatalog} sx={{ textTransform: "none", fontWeight: 600 }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Category filter chips */}
      {categories.length > 0 && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
          <Chip
            label="All"
            onClick={() => setSelectedCategory(null)}
            sx={{
              fontWeight: 600,
              fontSize: 12,
              background: !selectedCategory ? ACCENT : "#F5F5F5",
              color: !selectedCategory ? "#fff" : "#616161",
              "&:hover": { background: !selectedCategory ? "#D4820F" : "#EEEEEE" },
            }}
          />
          {categories.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setSelectedCategory(cat)}
              sx={{
                fontWeight: 600,
                fontSize: 12,
                background: selectedCategory === cat ? ACCENT : "#F5F5F5",
                color: selectedCategory === cat ? "#fff" : "#616161",
                "&:hover": { background: selectedCategory === cat ? "#D4820F" : "#EEEEEE" },
              }}
            />
          ))}
        </Box>
      )}

      {/* Catalog grid */}
      <Grid container spacing={2.5}>
        {filteredTypes.map((type) => {
          const typeKey = type.typeId || type.id || type.key;
          const isAvailable = isExperienceTypeAvailable(typeKey);
          const requiredTier = getRequiredTier(typeKey);
          const Icon = TYPE_ICONS[typeKey] || DefaultIcon;
          const isCreatingThis = creating === typeKey;

          return (
            <Grid item xs={12} sm={6} md={4} key={typeKey}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2.5,
                  height: "100%",
                  cursor: "pointer",
                  opacity: isAvailable ? 1 : 0.85,
                  transition: "border-color 0.2s, box-shadow 0.2s",
                  position: "relative",
                  "&:hover": { borderColor: ACCENT, boxShadow: "0 4px 20px rgba(240,153,37,0.1)" },
                }}
                onClick={() => handleSelectType(type)}
              >
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  {/* Lock overlay for gated types */}
                  {!isAvailable && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                      }}
                    >
                      <LockOutlinedIcon sx={{ fontSize: 16, color: "#9E9E9E" }} />
                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#9E9E9E", textTransform: "capitalize" }}>
                        {requiredTier}
                      </Typography>
                    </Box>
                  )}

                  {/* Icon */}
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isAvailable ? `${ACCENT}14` : "#F5F5F5",
                      mb: 1.5,
                    }}
                  >
                    <Icon sx={{ color: isAvailable ? ACCENT : "#BDBDBD", fontSize: 24 }} />
                  </Box>

                  {/* Name */}
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#1D1B20", mb: 0.5 }}>
                    {type.name}
                  </Typography>

                  {/* Description */}
                  <Typography sx={{ fontSize: 12, color: "#71727A", mb: 1.5, minHeight: 36 }}>
                    {type.description || "Interactive engagement for your event."}
                  </Typography>

                  {/* Category + action */}
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    {type.category && (
                      <Chip
                        label={type.category}
                        size="small"
                        sx={{ fontSize: 10, fontWeight: 600, height: 20, background: "#F5F5F5", color: "#757575" }}
                      />
                    )}
                    {isAvailable && (
                      <Button
                        size="small"
                        disabled={isCreatingThis}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 12,
                          color: ACCENT,
                          minWidth: 0,
                          px: 1,
                          "&:hover": { background: `${ACCENT}0A` },
                        }}
                      >
                        {isCreatingThis ? <CircularProgress size={14} sx={{ color: ACCENT }} /> : "Add"}
                      </Button>
                    )}
                    {!isAvailable && (
                      <Button
                        size="small"
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          fontSize: 11,
                          color: "#9E9E9E",
                          minWidth: 0,
                          px: 1,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate("/admin/settings/subscription");
                        }}
                      >
                        Upgrade to {requiredTier}
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Empty catalog state */}
      {filteredTypes.length === 0 && !error && (
        <Box sx={{ textAlign: "center", py: 8, border: "1.5px dashed #E0E0E0", borderRadius: 3, background: "#FAFAFA" }}>
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 14 }}>
            No experience types available for this filter.
          </Typography>
          {selectedCategory && (
            <Button
              size="small"
              onClick={() => setSelectedCategory(null)}
              sx={{ mt: 1, textTransform: "none", fontWeight: 600, color: ACCENT }}
            >
              Clear filter
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ExperienceCatalog;
