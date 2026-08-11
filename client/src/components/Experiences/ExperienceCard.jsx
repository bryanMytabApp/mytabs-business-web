import React, { useState } from "react";
import { Card, CardContent, Box, Typography, Chip, Modal } from "@mui/material";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
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
import LifecycleActions from "./LifecycleActions";

const ACCENT = "#00A9D6";
const NAVY = "#0D1B20";

const STATE_STYLES = {
  Draft: { bg: "#f2f4f6", color: "#8a94a0", dotColor: "#8a94a0" },
  Scheduled: { bg: "#e3f2fd", color: "#1565C0", dotColor: "#1565C0" },
  Live: { bg: "#e6f7ec", color: "#1f9d55", dotColor: "#1f9d55" },
  Paused: { bg: "#fff3e0", color: "#E65100", dotColor: "#E65100" },
  Closed: { bg: "#ffebee", color: "#C62828", dotColor: "#C62828" },
  Analytics: { bg: "#ede7f6", color: "#4527A0", dotColor: "#4527A0" },
};

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

const DefaultIcon = ConfirmationNumberOutlinedIcon;

/**
 * Shimmer keyframes for the trophy badge shine effect.
 */
const shimmerKeyframes = `
@keyframes badgeSweep {
  from { transform: skewX(-18deg) translateX(-180%); }
  to { transform: skewX(-18deg) translateX(360%); }
}
@keyframes pulseDot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
`;

/**
 * ExperienceCard — polished admin card for displaying an experience instance.
 * Design matches the RaffleAdminCard aesthetic: gradient icon badge, clean pills,
 * stat row with divider, and styled action buttons.
 *
 * Props:
 * - instance: { experienceId, name, experienceType, state, entryCount, eventId }
 * - onAction: (experienceId, action) => void
 * - onClick: (instance) => void
 */
const ExperienceCard = ({ instance, onAction, onClick }) => {
  const { experienceId, name, experienceType, state, entryCount, eventId } = instance;
  const stateStyle = STATE_STYLES[state] || STATE_STYLES.Draft;
  const [showPreview, setShowPreview] = useState(false);
  const [showConfigure, setShowConfigure] = useState(false);
  const Icon = TYPE_ICONS[experienceType] || DefaultIcon;

  const handleCardClick = () => {
    if (onClick) onClick(instance);
  };

  const previewUrl = `https://experience.keeptabs.app/e/${experienceId}/enter?test=true&eventId=${eventId || ''}&userToken=${encodeURIComponent(localStorage.getItem('idToken') || '')}`;
  const configureUrl = `/admin/my-events/${eventId}/experiences/${experienceId}/config?embedded=true`;

  return (
    <>
      <style>{shimmerKeyframes}</style>
      <Card
        elevation={0}
        sx={{
          borderRadius: "22px",
          cursor: onClick ? "pointer" : "default",
          transition: "border-color 0.2s, box-shadow 0.2s, transform 0.15s",
          border: "1px solid #eef1f3",
          boxShadow: "0 12px 32px -16px rgba(13,27,42,0.12)",
          position: "relative",
          overflow: "hidden",
          "&:hover": onClick
            ? {
                borderColor: ACCENT,
                boxShadow: "0 20px 44px -18px rgba(13,27,42,0.2)",
                transform: "translateY(-2px)",
              }
            : {},
        }}
        onClick={handleCardClick}
      >
        {/* Accent glow */}
        <Box
          sx={{
            position: "absolute",
            top: -70,
            right: -70,
            width: 180,
            height: 180,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${ACCENT}30, transparent 70%)`,
            pointerEvents: "none",
          }}
        />

        <CardContent sx={{ p: "26px 26px 24px", "&:last-child": { pb: "24px" }, position: "relative" }}>
          {/* Top row: title + pills + icon badge */}
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                sx={{
                  fontWeight: 900,
                  fontSize: 20,
                  color: NAVY,
                  fontFamily: "'Nunito', sans-serif",
                  letterSpacing: "-0.2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  mb: 0.75,
                }}
              >
                {name}
              </Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                {/* Type pill */}
                <Chip
                  label={experienceType?.replace(/_/g, " ")}
                  size="small"
                  sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    height: 28,
                    borderRadius: "999px",
                    background: `${ACCENT}14`,
                    color: ACCENT,
                    border: `1.5px solid ${ACCENT}40`,
                    textTransform: "capitalize",
                    fontFamily: "'Nunito', sans-serif",
                  }}
                />
                {/* Status pill */}
                <Chip
                  icon={
                    <Box
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: stateStyle.dotColor,
                        animation: state === "Live" ? "pulseDot 1.6s ease-in-out infinite" : "none",
                        ml: 0.5,
                      }}
                    />
                  }
                  label={state}
                  size="small"
                  sx={{
                    fontSize: 12,
                    fontWeight: 800,
                    height: 28,
                    borderRadius: "999px",
                    background: stateStyle.bg,
                    color: stateStyle.color,
                    fontFamily: "'Nunito', sans-serif",
                    "& .MuiChip-icon": { marginLeft: "8px", marginRight: "-2px" },
                  }}
                />
              </Box>
            </Box>

            {/* Gradient icon badge with shimmer */}
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: "16px",
                flexShrink: 0,
                background: `linear-gradient(150deg, ${ACCENT}, #007a9e)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 10px 20px -8px ${ACCENT}90`,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Shine sweep */}
              <Box
                sx={{
                  position: "absolute",
                  top: "-50%",
                  left: "-60%",
                  width: "50%",
                  height: "220%",
                  background: "linear-gradient(120deg, transparent, rgba(255,255,255,0.6), transparent)",
                  transform: "skewX(-18deg) translateX(-180%)",
                  animation: "badgeSweep 3.2s ease-in-out infinite",
                  animationDelay: "1s",
                }}
              />
              <Icon sx={{ color: "#fff", fontSize: 24, position: "relative", zIndex: 1 }} />
            </Box>
          </Box>

          {/* Stat row */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2 }}>
            <PeopleOutlineIcon sx={{ color: "#b7bfc7", fontSize: 18 }} />
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#6b7684", fontFamily: "'Nunito', sans-serif" }}>
              Entries:
            </Typography>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: NAVY, fontFamily: "'Nunito', sans-serif" }}>
              {entryCount ?? 0}
            </Typography>
          </Box>

          {/* Divider */}
          <Box sx={{ height: "1px", background: "#eef1f3", my: 2.25 }} />

          {/* Action buttons */}
          <Box onClick={(e) => e.stopPropagation()}>
            <LifecycleActions
              state={state}
              onAction={(action) => {
                if (action === "configure") {
                  setShowConfigure(true);
                } else {
                  onAction && onAction(experienceId, action);
                }
              }}
              onPreview={(e) => {
                if (e) e.stopPropagation();
                setShowPreview(true);
              }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Mobile Preview Modal */}
      <Modal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: 390,
            height: 720,
            borderRadius: "32px",
            background: "#1A1A1A",
            p: "12px",
            position: "relative",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Phone notch */}
          <Box sx={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            width: 80, height: 24, background: "#1A1A1A", borderRadius: 12, zIndex: 10,
          }} />
          {/* Iframe container */}
          <Box sx={{
            width: "100%", height: "100%", borderRadius: "22px", overflow: "hidden",
            background: "#fff",
          }}>
            <iframe
              src={previewUrl}
              title="Engagement Preview"
              style={{ width: "100%", height: "100%", border: "none" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </Box>
          {/* Close button */}
          <Box
            component="button"
            onClick={() => setShowPreview(false)}
            sx={{
              position: "absolute", top: -12, right: -12,
              width: 32, height: 32, borderRadius: "50%",
              background: "#fff", border: "2px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#666",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            ✕
          </Box>
        </Box>
      </Modal>

      {/* Configure/Edit Modal — same phone-frame style with iframe */}
      <Modal
        open={showConfigure}
        onClose={() => setShowConfigure(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: 390,
            height: 720,
            borderRadius: "32px",
            background: "#1A1A1A",
            p: "12px",
            position: "relative",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Phone notch */}
          <Box sx={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            width: 80, height: 24, background: "#1A1A1A", borderRadius: 12, zIndex: 10,
          }} />
          {/* Iframe container */}
          <Box sx={{
            width: "100%", height: "100%", borderRadius: "22px", overflow: "hidden",
            background: "#fff",
          }}>
            <iframe
              src={configureUrl}
              title="Engagement Configure"
              style={{ width: "100%", height: "100%", border: "none" }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </Box>
          {/* Close button */}
          <Box
            component="button"
            onClick={() => setShowConfigure(false)}
            sx={{
              position: "absolute", top: -12, right: -12,
              width: 32, height: 32, borderRadius: "50%",
              background: "#fff", border: "2px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#666",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            ✕
          </Box>
        </Box>
      </Modal>
    </>
  );
};

export default ExperienceCard;
