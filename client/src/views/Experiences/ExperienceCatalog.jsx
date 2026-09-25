import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  TextField,
  InputAdornment,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import AutoFixHighOutlinedIcon from "@mui/icons-material/AutoFixHighOutlined";
import EngagementWizard from "./EngagementWizard";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PollOutlinedIcon from "@mui/icons-material/PollOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import FeedbackOutlinedIcon from "@mui/icons-material/FeedbackOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import CameraAltOutlinedIcon from "@mui/icons-material/CameraAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
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
import LockedEngagementModal from "./LockedEngagementModal";

const ACCENT = "#F09925";

/**
 * Category → brand color map (categories match the API exactly).
 */
const CATEGORY_COLORS = {
  "Contests & Giveaways": "#F47A20",
  "Engagement & Loyalty": "#8B5CF6",
  "Feedback & Surveys": "#3B82F6",
  "Games & Challenges": "#22C55E",
  "Social & Community": "#EC4899",
};

/**
 * Capitalize the first letter of a string (e.g. "growth" → "Growth").
 */
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * Map experience type keys to MUI icons.
 */
const TYPE_ICONS = {
  'raffles': EmojiEventsOutlinedIcon,
  'live-polls': PollOutlinedIcon,
  'trivia-challenges': QuizOutlinedIcon,
  'surveys': AssignmentOutlinedIcon,
  'pulse-feedback': FeedbackOutlinedIcon,
  'prediction-challenges': InsightsOutlinedIcon,
  'instant-win': CasinoOutlinedIcon,
  'digital-scratch-offs': CardGiftcardOutlinedIcon,
  'treasure-hunts': PlaceOutlinedIcon,
  'check-in-challenges': CheckCircleOutlineIcon,
  'photo-contests': CameraAltOutlinedIcon,
  'social-wall': ForumOutlinedIcon,
  'digital-coupons': LocalOfferOutlinedIcon,
  'sponsor-promotions': CampaignOutlinedIcon,
  'loyalty-rewards': StarOutlinedIcon,
  'leaderboards': LeaderboardOutlinedIcon,
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
  const [searchQuery, setSearchQuery] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  // The locked engagement currently shown in the info/upgrade modal (null = closed).
  const [lockedInfo, setLockedInfo] = useState(null);

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

    // Entitlement gate: an engagement is locked ONLY when the account's own
    // subscription tier does not include it. `isExperienceTypeAvailable` resolves
    // that from the real subscription plan (via useExperienceEntitlement) — the same
    // single source of truth the card's visual lock uses, so the click behavior and
    // the lock badge never disagree. We intentionally do NOT OR in the API's
    // `type.locked` flag: it is derived from the Cognito `custom:subscription_tier`
    // claim, which can be stale/missing and would then wrongly lock an engagement the
    // plan actually includes. The backend still enforces the tier on create as a
    // safety net. When entitlement is still loading, treat as available (don't flash
    // a lock) — the backend guard covers the race.
    const locked = !entitlementLoading && !isExperienceTypeAvailable(typeKey);
    if (locked) {
      setLockedInfo(type);
      return;
    }

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

  // Filter by selected category and search query
  const filteredTypes = useMemo(() => {
    let result = catalogTypes;
    if (selectedCategory) {
      result = result.filter((t) => t.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          (t.name || "").toLowerCase().includes(query) ||
          (t.description || "").toLowerCase().includes(query) ||
          (t.category || "").toLowerCase().includes(query)
      );
    }
    return result;
  }, [catalogTypes, selectedCategory, searchQuery]);

  /**
   * Handle wizard recommendation selection — find the type in catalog and select it.
   */
  const handleWizardSelect = (typeId) => {
    const type = catalogTypes.find(
      (t) => (t.typeId || t.id || t.key) === typeId
    );
    if (type) {
      handleSelectType(type);
    }
  };

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

      {/* Search and Wizard row */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 2.5, alignItems: "center" }}>
        <TextField
          size="small"
          placeholder="Search engagements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#9E9E9E", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flex: 1,
            maxWidth: 400,
            "& .MuiOutlinedInput-root": {
              borderRadius: 2,
              fontSize: 13,
              "& fieldset": { borderColor: "#E0E0E0" },
              "&:hover fieldset": { borderColor: "#BDBDBD" },
              "&.Mui-focused fieldset": { borderColor: ACCENT },
            },
          }}
        />
        <Button
          variant="outlined"
          startIcon={<AutoFixHighOutlinedIcon />}
          onClick={() => setWizardOpen(true)}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            fontSize: 13,
            borderColor: ACCENT,
            color: ACCENT,
            borderRadius: 2,
            px: 2,
            "&:hover": { borderColor: "#D4820F", background: `${ACCENT}08` },
          }}
        >
          Help Me Choose
        </Button>
      </Box>

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
          // Locked strictly by the account's subscription tier (single source of
          // truth). While entitlement is still loading, treat as available so we
          // don't flash a lock badge before the plan resolves.
          const isAvailable = entitlementLoading || isExperienceTypeAvailable(typeKey);
          // Prefer the entitlement hook's tier; fall back to the catalog item's
          // own tier (from the API) so the "Upgrade to <tier>" label is never blank.
          const requiredTier = getRequiredTier(typeKey) || type.requiredTier || type.tier || null;
          const Icon = TYPE_ICONS[typeKey] || DefaultIcon;
          const isCreatingThis = creating === typeKey;
          const catColor = CATEGORY_COLORS[type.category] || "#F09925";
          // Tier shown in the top-right badge: prefer catalog-provided tier, else
          // fall back to the entitlement-derived required tier.
          const badgeTier = cap(type.tier || type.requiredTier || requiredTier);

          return (
            <Grid item xs={12} sm={6} md={4} key={typeKey}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: "18px",
                  height: "100%",
                  cursor: "pointer",
                  opacity: isAvailable ? 1 : 0.9,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                  position: "relative",
                  borderColor: "#eef1f3",
                  boxShadow: "0 10px 24px -16px rgba(13,27,42,0.18)",
                  "&:hover": {
                    transform: "translateY(-3px)",
                    boxShadow: `0 16px 32px -16px rgba(13,27,42,0.28), 0 0 0 1.5px ${catColor}`,
                    borderColor: catColor,
                  },
                  "&:hover .upgrade-link": { textDecoration: "underline" },
                }}
                onClick={() => handleSelectType(type)}
              >
                <CardContent sx={{ p: "20px 20px 18px", "&:last-child": { pb: "18px" } }}>
                  {/* Tier badge (top-right) */}
                  {badgeTier && (
                    <Box
                      sx={{
                        position: "absolute",
                        top: 18,
                        right: 20,
                        fontSize: "10.5px",
                        fontWeight: 800,
                        color: "#6b7684",
                        background: "#f2f4f6",
                        px: "9px",
                        py: "3px",
                        borderRadius: "999px",
                      }}
                    >
                      {badgeTier}
                    </Box>
                  )}

                  {/* Category-colored gradient icon tile */}
                  <Box
                    sx={{
                      position: "relative",
                      width: 52,
                      height: 52,
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `linear-gradient(150deg, ${catColor}, color-mix(in srgb, ${catColor} 70%, black))`,
                      boxShadow: `0 8px 16px -8px color-mix(in srgb, ${catColor} 60%, transparent)`,
                      mb: "14px",
                    }}
                  >
                    <Icon sx={{ color: "#fff", fontSize: 24 }} />
                    {/* Lock badge for gated types */}
                    {!isAvailable && (
                      <Box
                        sx={{
                          position: "absolute",
                          right: -6,
                          bottom: -6,
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "#fff",
                          color: "#8a94a0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 0 0 1px #e3e7eb, 0 3px 6px -2px rgba(13,27,42,0.25)",
                        }}
                      >
                        <LockOutlinedIcon sx={{ fontSize: 13 }} />
                      </Box>
                    )}
                  </Box>

                  {/* Name */}
                  <Typography sx={{ fontWeight: 900, fontSize: 17, color: "#0D1B2A", mb: "6px" }}>
                    {type.name}
                  </Typography>

                  {/* Description */}
                  <Typography sx={{ fontSize: 13, lineHeight: 1.45, color: "#6b7684", mb: 2, minHeight: 38 }}>
                    {type.description || "Interactive engagement for your event."}
                  </Typography>

                  {/* Footer row: category pill + action */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 1,
                      pt: "12px",
                      borderTop: "1px solid #f0f2f4",
                    }}
                  >
                    {type.category ? (
                      <Box
                        sx={{
                          fontSize: "10.5px",
                          fontWeight: 800,
                          px: "9px",
                          py: "4px",
                          borderRadius: "999px",
                          color: catColor,
                          background: `color-mix(in srgb, ${catColor} 12%, white)`,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {type.category}
                      </Box>
                    ) : (
                      <Box />
                    )}
                    {isAvailable ? (
                      <Button
                        size="small"
                        disabled={isCreatingThis}
                        sx={{
                          textTransform: "none",
                          fontWeight: 800,
                          fontSize: 12,
                          color: catColor,
                          minWidth: 0,
                          px: 1,
                          "&:hover": { background: `color-mix(in srgb, ${catColor} 8%, white)` },
                        }}
                      >
                        {isCreatingThis ? <CircularProgress size={14} sx={{ color: catColor }} /> : "Add"}
                      </Button>
                    ) : (
                      <Box
                        className="upgrade-link"
                        component="span"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Show the info/upgrade modal (value + how-it-works) rather
                          // than jumping straight to billing.
                          setLockedInfo(type);
                        }}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          fontSize: 12,
                          fontWeight: 800,
                          color: catColor,
                          whiteSpace: "nowrap",
                          cursor: "pointer",
                        }}
                      >
                        Upgrade to {cap(requiredTier)}
                        <ArrowForwardIcon sx={{ fontSize: 14 }} />
                      </Box>
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
          {(selectedCategory || searchQuery) && (
            <Button
              size="small"
              onClick={() => {
                setSelectedCategory(null);
                setSearchQuery("");
              }}
              sx={{ mt: 1, textTransform: "none", fontWeight: 600, color: ACCENT }}
            >
              Clear filters
            </Button>
          )}
        </Box>
      )}

      {/* Engagement Wizard Modal */}
      <EngagementWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSelectType={handleWizardSelect}
        catalogTypes={catalogTypes}
      />

      {/* Locked engagement info/upgrade modal — shown when a locked engagement is
          clicked. Explains the engagement, its value, and how it works, and offers
          an upgrade path. Never creates the engagement. */}
      <LockedEngagementModal
        open={Boolean(lockedInfo)}
        type={lockedInfo}
        requiredTier={
          lockedInfo
            ? getRequiredTier(lockedInfo.typeId || lockedInfo.id || lockedInfo.key) ||
              lockedInfo.requiredTier ||
              lockedInfo.tier ||
              null
            : null
        }
        accentColor={lockedInfo ? CATEGORY_COLORS[lockedInfo.category] || ACCENT : ACCENT}
        onClose={() => setLockedInfo(null)}
        onUpgrade={() => {
          setLockedInfo(null);
          navigate("/admin/settings/subscription");
        }}
      />
    </Box>
  );
};

export default ExperienceCatalog;
