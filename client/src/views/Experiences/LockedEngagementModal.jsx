import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Button,
  IconButton,
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { getEngagementInfo } from "./engagementInfoContent";

const ACCENT = "#F09925";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/**
 * LockedEngagementModal — shown when a business clicks a LOCKED engagement in the
 * catalog. It explains the engagement (description + why it's valuable), shows an
 * animated how-it-works image/GIF, states the plan tier required, and offers an
 * Upgrade path. It never creates the engagement — locked types are gated both here
 * and server-side.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {object|null} props.type - the catalog type: { typeId|id|key, name, description, category, requiredTier }
 * @param {string|null} props.requiredTier - the tier required (e.g. "growth", "pro")
 * @param {string} [props.accentColor] - category color for accents
 * @param {function} props.onUpgrade - called when the user clicks Upgrade
 */
const LockedEngagementModal = ({
  open,
  onClose,
  type,
  requiredTier,
  accentColor = ACCENT,
  onUpgrade,
}) => {
  const typeKey = type ? type.typeId || type.id || type.key : null;
  const info = getEngagementInfo(typeKey, {
    name: type?.name,
    description: type?.description,
  });

  // Ordered how-it-works slides (real product screenshots) for this engagement.
  const slides = Array.isArray(info.slides) ? info.slides : [];
  const hasSlides = slides.length > 0;

  // Track whether the single media (GIF) loaded; fall back to a static illustration
  // (lock + category-colored block) when the asset is missing/404s so the modal
  // is always coherent, even before media is generated.
  const [mediaOk, setMediaOk] = useState(true);
  // Current slide index for the auto-advancing carousel.
  const [slideIdx, setSlideIdx] = useState(0);

  useEffect(() => {
    // Reset media/carousel state whenever the shown engagement changes.
    setMediaOk(true);
    setSlideIdx(0);
  }, [typeKey]);

  // Auto-advance the carousel every 2.5s while the modal is open and there are
  // multiple slides. Cleared on close/unmount or when the engagement changes.
  useEffect(() => {
    if (!open || slides.length <= 1) return undefined;
    const id = setInterval(() => {
      setSlideIdx((i) => (i + 1) % slides.length);
    }, 2500);
    return () => clearInterval(id);
  }, [open, slides.length, typeKey]);

  if (!type) return null;

  const tierLabel = cap(requiredTier || type.requiredTier || "");

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      aria-labelledby="locked-engagement-title"
      PaperProps={{ sx: { borderRadius: "20px", overflow: "hidden" } }}
    >
      {/* Close */}
      <IconButton
        onClick={onClose}
        aria-label="Close"
        sx={{ position: "absolute", top: 10, right: 10, zIndex: 2, color: "#fff", background: "rgba(0,0,0,0.28)", "&:hover": { background: "rgba(0,0,0,0.45)" } }}
        size="small"
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      {/* Animated how-it-works media (with graceful fallback) */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: 220,
          background: `linear-gradient(150deg, ${accentColor}, color-mix(in srgb, ${accentColor} 65%, black))`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {hasSlides ? (
          // Auto-advancing carousel of real how-it-works screenshots.
          <>
            {slides.map((src, i) => (
              <Box
                key={src}
                component="img"
                src={src}
                alt={`How ${info.title} works — step ${i + 1}`}
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transition: "opacity 500ms ease",
                  opacity: i === slideIdx ? 1 : 0,
                }}
              />
            ))}
            {/* Slide dots */}
            {slides.length > 1 && (
              <Box sx={{ position: "absolute", bottom: 12, right: 14, display: "flex", gap: 0.75, zIndex: 1 }}>
                {slides.map((s, i) => (
                  <Box
                    key={s}
                    onClick={() => setSlideIdx(i)}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      cursor: "pointer",
                      background: i === slideIdx ? "#fff" : "rgba(255,255,255,0.5)",
                    }}
                  />
                ))}
              </Box>
            )}
          </>
        ) : info.media && mediaOk ? (
          <Box
            component="img"
            src={info.media}
            alt={`How ${info.title} works`}
            onError={() => setMediaOk(false)}
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          // Fallback illustration when no animated asset is available yet.
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, color: "#fff", opacity: 0.95 }}>
            <LockOutlinedIcon sx={{ fontSize: 44 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 13, letterSpacing: 0.4 }}>
              PREVIEW COMING SOON
            </Typography>
          </Box>
        )}

        {/* Locked pill */}
        <Chip
          icon={<LockOutlinedIcon sx={{ fontSize: 14, color: "#fff !important" }} />}
          label={tierLabel ? `${tierLabel} plan` : "Locked"}
          size="small"
          sx={{
            position: "absolute",
            bottom: 12,
            left: 12,
            color: "#fff",
            fontWeight: 800,
            background: "rgba(0,0,0,0.35)",
            "& .MuiChip-icon": { color: "#fff" },
          }}
        />
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Typography id="locked-engagement-title" sx={{ fontWeight: 900, fontSize: 20, color: "#0D1B2A", mb: 0.5 }}>
          {info.title}
        </Typography>
        {info.tagline && (
          <Typography sx={{ fontSize: 14, color: "#6b7684", mb: 2 }}>
            {info.tagline}
          </Typography>
        )}

        {/* Why it's valuable */}
        {info.value && (
          <Box sx={{ mb: info.howItWorks?.length ? 2.5 : 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: accentColor, mb: 0.75 }}>
              Why it's valuable
            </Typography>
            <Typography sx={{ fontSize: 14, lineHeight: 1.5, color: "#3a4450" }}>
              {info.value}
            </Typography>
          </Box>
        )}

        {/* How it works */}
        {Array.isArray(info.howItWorks) && info.howItWorks.length > 0 && (
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, color: accentColor, mb: 0.75 }}>
              How it works
            </Typography>
            <Box component="ol" sx={{ m: 0, pl: 2.4, display: "flex", flexDirection: "column", gap: 0.5 }}>
              {info.howItWorks.map((step, i) => (
                <Typography key={i} component="li" sx={{ fontSize: 13.5, lineHeight: 1.5, color: "#3a4450" }}>
                  {step}
                </Typography>
              ))}
            </Box>
          </Box>
        )}

        {/* Upgrade CTA */}
        <Box sx={{ mt: 3, display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="contained"
            onClick={onUpgrade}
            endIcon={<ArrowForwardIcon />}
            sx={{
              textTransform: "none",
              fontWeight: 800,
              borderRadius: "12px",
              px: 2.5,
              background: accentColor,
              "&:hover": { background: "color-mix(in srgb, " + accentColor + " 85%, black)" },
            }}
          >
            {tierLabel ? `Upgrade to ${tierLabel}` : "Upgrade"}
          </Button>
          <Button
            variant="text"
            onClick={onClose}
            sx={{ textTransform: "none", fontWeight: 700, color: "#6b7684" }}
          >
            Not now
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default LockedEngagementModal;
