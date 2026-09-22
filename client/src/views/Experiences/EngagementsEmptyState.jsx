import React, { useState } from "react";
import { Box, Typography, Button } from "@mui/material";
import CardGiftcardIcon from "@mui/icons-material/CardGiftcard";
import StarIcon from "@mui/icons-material/Star";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import AddIcon from "@mui/icons-material/Add";

const BRAND = {
  cyan: "#18a8d8",
  amber: "#f5a623",
  orange: "#e8641f",
};

// Same five groups the catalog uses — this list doubles as a legend, so the
// colors here are the colors a host will actually see once they browse.
const CATEGORIES = [
  {
    key: "contests",
    icon: CardGiftcardIcon,
    title: "Contests & Giveaways",
    copy: "Raffles and scratch-offs that hand out a prize.",
    tile: BRAND.amber,
  },
  {
    key: "loyalty",
    icon: StarIcon,
    title: "Engagement & Loyalty",
    copy: "Points that bring the same people back.",
    tile: "#7c5cd6",
  },
  {
    key: "feedback",
    icon: ChatBubbleOutlineIcon,
    title: "Feedback & Surveys",
    copy: "Polls that turn a reaction into real data.",
    tile: BRAND.cyan,
  },
  {
    key: "games",
    icon: EmojiEventsIcon,
    title: "Games & Challenges",
    copy: "Trivia and leaderboards that hold attention.",
    tile: "#3fa66a",
  },
  {
    key: "social",
    icon: GroupsIcon,
    title: "Social & Community",
    copy: "Photo walls built from what attendees post.",
    tile: "#d1367f",
  },
];

// One button style for every action in the card — only the color changes.
function ActionButton({ color, icon: Icon, children, onClick }) {
  return (
    <Button
      onClick={onClick}
      startIcon={<Icon sx={{ fontSize: 18 }} />}
      fullWidth
      sx={{
        py: 1.25,
        px: 2.5,
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 800,
        textTransform: "none",
        backgroundColor: color,
        color: "#ffffff",
        boxShadow: "none",
        "&:hover": { backgroundColor: color, filter: "brightness(0.94)", boxShadow: "none" },
      }}
    >
      {children}
    </Button>
  );
}

/**
 * EngagementsEmptyState — shown on the All Engagements dashboard when the
 * business has no engagements yet. Explains what an engagement is (left) and
 * walks the host through getting their first one live (right).
 */
export default function EngagementsEmptyState({
  onGoToEvents = () => {},
  onAddEngagement = () => {},
  onVerifyEngagements = () => {},
  // When false, hides the hero headline + description (used on pages that
  // already have their own title/subtitle, to avoid duplicate messaging).
  // The category legend and action card still render.
  showIntro = true,
}) {
  const [hovered, setHovered] = useState(null);

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        overflow: "hidden",
        py: { xs: 1, md: 2 },
        background: "transparent",
      }}
    >
      <Box
        sx={{
          position: "relative",
          display: "flex",
          flexDirection: { xs: "column", lg: "row" },
          alignItems: { lg: "flex-start" },
          gap: { xs: 5, lg: 8 },
        }}
      >
        {/* LEFT — what an engagement is */}
        <Box sx={{ flex: { lg: "1.2 1 0%" }, minWidth: 0 }}>
          {showIntro ? (
            <>
              <Typography
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.15,
                  color: "#0f172a",
                  fontSize: { xs: "1.5rem", md: "1.875rem" },
                }}
              >
                Give attendees something to
                <br />
                <span style={{ color: BRAND.orange }}>do</span>, not just attend
              </Typography>
              <Typography sx={{ mt: 2, maxWidth: 448, lineHeight: 1.6, color: "#64748b", fontSize: 15 }}>
                An engagement is a small interactive activity attached to an event — a
                raffle, a poll, a trivia round. Once it's added, every attendee sees it
                live from their Tab.
              </Typography>
            </>
          ) : (
            // Compact explainer for pages that already have their own title —
            // still tells the host what an engagement is, without repeating a
            // big hero headline.
            <Typography sx={{ maxWidth: 560, lineHeight: 1.6, color: "#64748b", fontSize: 15 }}>
              An engagement is a small interactive activity you attach to an event — a
              raffle, a poll, a trivia round. Pick a type below to give attendees
              something to do, live from their Tab.
            </Typography>
          )}

          <Box
            sx={{
              mt: 3,
              display: "grid",
              gap: 1.5,
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            }}
          >
            {CATEGORIES.map((cat, i) => {
              const Icon = cat.icon;
              const isHovered = hovered === cat.key;
              const spanFull = i === CATEGORIES.length - 1;
              return (
                <Box
                  key={cat.key}
                  onMouseEnter={() => setHovered(cat.key)}
                  onMouseLeave={() => setHovered(null)}
                  sx={{
                    gridColumn: spanFull ? { sm: "1 / -1" } : undefined,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    borderRadius: 3,
                    p: 2,
                    backgroundColor: "#ffffff",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    boxShadow: isHovered
                      ? "0 14px 28px -8px rgba(15,23,42,0.16)"
                      : "0 2px 8px -2px rgba(15,23,42,0.06)",
                    transform: isHovered ? "translateY(-2px)" : "none",
                  }}
                >
                  <Box
                    sx={{
                      flexShrink: 0,
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      backgroundColor: cat.tile,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon sx={{ fontSize: 20, color: "#ffffff" }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, color: "#1e293b", fontSize: 14.5 }}>
                      {cat.title}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: 14, lineHeight: 1.35, color: "#64748b" }}>
                      {cat.copy}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* RIGHT — every action, organized in one place, same button style throughout */}
        <Box
          sx={{
            width: { xs: "100%", lg: 400 },
            flexShrink: 0,
            position: { lg: "sticky" },
            top: { lg: 40 },
          }}
        >
          <Box
            sx={{
              borderRadius: 4,
              p: 3.5,
              backgroundColor: "#ffffff",
              boxShadow: "0 24px 48px -12px rgba(15,23,42,0.18)",
            }}
          >
            <Typography
              sx={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94a3b8" }}
            >
              0 engagements
            </Typography>
            <Typography sx={{ mt: 0.5, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              Get your first one live
            </Typography>

            <Box sx={{ mt: 3 }}>
              {/* Step 1 — Pick an event */}
              <Box sx={{ display: "flex", gap: 2 }}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "#eef2ff",
                    color: BRAND.cyan,
                    fontSize: 14,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  1
                </Box>
                <Box sx={{ minWidth: 0, flex: 1, pb: 2.5 }}>
                  <Typography sx={{ fontWeight: 700, color: "#1e293b" }}>Pick an event</Typography>
                  <Typography sx={{ mt: 0.25, fontSize: 14, lineHeight: 1.35, color: "#64748b" }}>
                    Engagements attach to an event — start there if you haven't created one.
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ borderTop: "1px solid #f1f5f9" }} />

              {/* Step 2 — Add an engagement */}
              <Box sx={{ display: "flex", gap: 2, pt: 2.5 }}>
                <Box
                  sx={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "#eef2ff",
                    color: BRAND.cyan,
                    fontSize: 14,
                    fontWeight: 800,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  2
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, color: "#1e293b" }}>Add an engagement</Typography>
                  <Typography sx={{ mt: 0.25, fontSize: 14, lineHeight: 1.35, color: "#64748b" }}>
                    Browse the catalog and attach one to that event.
                  </Typography>
                  <Box sx={{ mt: 1.5 }}>
                    <ActionButton color={BRAND.cyan} icon={AddIcon} onClick={onAddEngagement}>
                      Add Engagement
                    </ActionButton>
                  </Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ mt: 3, pt: 2.5, borderTop: "1px solid #f1f5f9" }}>
              <Typography sx={{ fontSize: 14, color: "#64748b" }}>
                Already added a few?{" "}
                <Typography
                  component="span"
                  onClick={onVerifyEngagements}
                  sx={{
                    display: "inline",
                    fontSize: 14,
                    fontWeight: 700,
                    color: BRAND.cyan,
                    cursor: "pointer",
                    "&:hover": { textDecoration: "underline" },
                  }}
                >
                  Verify engagements
                </Typography>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
