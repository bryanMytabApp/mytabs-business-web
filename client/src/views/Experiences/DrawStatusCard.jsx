import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Chip from "@mui/material/Chip";
import Button from "@mui/material/Button";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";

const ACCENT = "#F09925";

/**
 * Resolves chip color and label for the draw state.
 */
function getStateChip(drawState) {
  if (!drawState) {
    return { label: "Pending", color: "default" };
  }

  const state = drawState.toUpperCase();

  if (state === "VERIFIED" || state === "DRAW_COMPLETE") {
    return { label: state.replace("_", " "), color: "success" };
  }

  if (
    state === "DRAWING" ||
    state === "AWAITING_RANDOMNESS" ||
    state === "RANDOMNESS_COMMITTED" ||
    state === "LOCKING" ||
    state === "CLOSING" ||
    state === "ENTRIES_LOCKED"
  ) {
    return { label: state.replace(/_/g, " "), color: "warning" };
  }

  if (state === "DRAW_FAILED") {
    return { label: "DRAW FAILED", color: "error" };
  }

  return { label: state.replace(/_/g, " "), color: "default" };
}

/**
 * Formats a timestamp string to a readable locale date/time.
 */
function formatTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return ts;
  }
}

/**
 * Truncates a hex string (e.g. draw seed) with ellipsis for display.
 */
function truncateHex(hex, maxLen = 16) {
  if (!hex) return "—";
  if (hex.length <= maxLen) return hex;
  return hex.slice(0, maxLen) + "…";
}

/**
 * DrawStatusCard — Displays provably fair draw status on the Engagement Analytics page.
 *
 * Only renders when drawType === 'provably-fair'. Shows draw state, entry count,
 * lock timestamp, randomness source, winning ticket, draw seed, and a verification link.
 *
 * Props:
 *   drawStatus  — object from GET /draw/status (may be null/undefined if no draw started)
 *   drawType    — string indicating the draw type (e.g. "provably-fair")
 *   drawId      — string identifier for the draw
 */
const DrawStatusCard = ({ drawStatus, drawType, drawId }) => {
  if (drawType !== "provably-fair") {
    return null;
  }

  const isDrawPending = !drawStatus || !drawStatus.drawState;
  const stateChip = getStateChip(drawStatus?.drawState);
  const isComplete =
    drawStatus?.drawState === "DRAW_COMPLETE" ||
    drawStatus?.drawState === "VERIFIED";

  const handleViewVerification = () => {
    window.open(`/verify/raffle/${drawId}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Section Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <ShieldOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#0d1b35" }}
        >
          Provably Fair Draw
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: "1px solid rgba(0,0,0,0.08)",
        }}
      >
        {isDrawPending ? (
          /* Draw Pending State */
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              py: 4,
              gap: 1.5,
            }}
          >
            <HourglassEmptyIcon sx={{ fontSize: 40, color: "rgba(0,0,0,0.25)" }} />
            <Typography
              variant="body1"
              sx={{ fontWeight: 700, color: "#6a7f9a", fontFamily: "'Outfit', sans-serif" }}
            >
              Draw Pending
            </Typography>
            <Typography variant="body2" sx={{ color: "#9aa8ba" }}>
              The provably fair draw has not started yet.
            </Typography>
          </Box>
        ) : (
          /* Active/Complete Draw State */
          <>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
                gap: 2.5,
              }}
            >
              {/* Draw State */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "#6a7f9a",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 10,
                  }}
                >
                  Draw State
                </Typography>
                <Box sx={{ mt: 0.5 }}>
                  <Chip
                    label={stateChip.label}
                    color={stateChip.color}
                    size="small"
                    sx={{ fontWeight: 700, fontFamily: "'Outfit', sans-serif" }}
                  />
                </Box>
              </Box>

              {/* Entry Count */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "#6a7f9a",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 10,
                  }}
                >
                  Entry Count
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 900, color: "#0d1b35", mt: 0.5 }}>
                  {drawStatus.entryCount != null
                    ? drawStatus.entryCount.toLocaleString()
                    : "—"}
                </Typography>
              </Box>

              {/* Entries Locked */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "#6a7f9a",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 10,
                  }}
                >
                  Entries Locked
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#0d1b35", mt: 0.5 }}>
                  {formatTimestamp(drawStatus.lockedAt)}
                </Typography>
              </Box>

              {/* Randomness Source */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "#6a7f9a",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 10,
                  }}
                >
                  Randomness Source
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: "#0d1b35", mt: 0.5 }}>
                  NIST Beacon v2.0
                </Typography>
              </Box>

              {/* Winning Ticket ID (only if draw complete) */}
              {isComplete && drawStatus.winningTicketId && (
                <Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 700,
                      color: "#6a7f9a",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontSize: 10,
                    }}
                  >
                    Winning Ticket ID
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 700,
                      color: ACCENT,
                      mt: 0.5,
                      fontFamily: "monospace",
                      wordBreak: "break-all",
                    }}
                  >
                    {drawStatus.winningTicketId}
                  </Typography>
                </Box>
              )}

              {/* Draw Seed */}
              <Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 700,
                    color: "#6a7f9a",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontSize: 10,
                  }}
                >
                  Draw Seed
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: "#0d1b35",
                    mt: 0.5,
                    fontFamily: "monospace",
                  }}
                  title={drawStatus.drawSeed || ""}
                >
                  {truncateHex(drawStatus.drawSeed)}
                </Typography>
              </Box>
            </Box>

            {/* Verification Button */}
            {drawId && (
              <Box sx={{ mt: 3, pt: 2, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <Button
                  variant="outlined"
                  size="small"
                  endIcon={<OpenInNewIcon />}
                  onClick={handleViewVerification}
                  sx={{
                    textTransform: "none",
                    fontWeight: 700,
                    fontFamily: "'Outfit', sans-serif",
                    borderColor: ACCENT,
                    color: ACCENT,
                    borderRadius: 2,
                    "&:hover": {
                      borderColor: "#d9841f",
                      backgroundColor: "rgba(240, 153, 37, 0.04)",
                    },
                  }}
                >
                  View Verification
                </Button>
              </Box>
            )}
          </>
        )}
      </Paper>
    </Box>
  );
};

export default DrawStatusCard;
