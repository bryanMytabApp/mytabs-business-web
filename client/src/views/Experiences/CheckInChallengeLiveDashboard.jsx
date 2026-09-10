import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 12.2)

// Normalize the leaderboard, which the plugin returns as
// { enabled, entries: [...] } (or { enabled:false }). Tolerate a bare array too.
function leaderboardEntries(leaderboard) {
  if (!leaderboard) return [];
  if (Array.isArray(leaderboard)) return leaderboard;
  return Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
}

function leaderboardIsEnabled(stats) {
  if (!stats) return false;
  if (stats.leaderboard && typeof stats.leaderboard.enabled === "boolean") {
    return stats.leaderboard.enabled;
  }
  return stats.leaderboardEnabled === true;
}

/**
 * CheckInChallengeLiveDashboard — organizer-facing live dashboard for a Check-In
 * Challenges instance. Mirrors PredictionLiveDashboard/RaffleLiveDashboard: a
 * LIVE/CLOSED header chip, a 2s ETag-optimized polling loop over getLiveStats, a
 * per-check-in-point section (label + count as a proportional bar), a
 * milestone-completion section (each rewardLabel + granted count), and — when
 * enabled — a leaderboard ordered by ascending rank. A failed refresh surfaces
 * an Alert while the interval keeps running to retry next tick.
 */
const CheckInChallengeLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const etagRef = useRef(null);
  const pollRef = useRef(null);

  const fetchStats = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const config = {};
        if (etagRef.current) {
          config.headers = { "If-None-Match": etagRef.current };
          config.validateStatus = (status) => status === 200 || status === 304;
        }
        const res = await getLiveStats(eventId, experienceId, config);
        if (res.status === 304) {
          // Unchanged since last poll — skip re-render.
          return;
        }
        const etag = res.headers?.etag || res.headers?.["etag"];
        if (etag) etagRef.current = etag;
        setStats(res.data?.data || res.data);
        setError(null);
      } catch (err) {
        if (err.response?.status !== 304) {
          setError(err.response?.data?.message || "Failed to load check-in results");
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [eventId, experienceId]
  );

  // Initial load.
  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  // Set up a single 2s interval on mount (Requirement 12.2). A failed refresh
  // sets the error while the interval keeps running so the next tick retries
  // (Requirement 12.7).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchStats]);

  const points = stats?.counts?.points || [];
  const milestones = stats?.milestones || [];
  const entries = leaderboardEntries(stats?.leaderboard);
  const showLeaderboard = leaderboardIsEnabled(stats);
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";

  // The greatest per-point count anchors every bar's proportional width
  // (Requirement 12.3). Guard against divide-by-zero when all counts are 0.
  const maxCount = points.reduce((max, p) => Math.max(max, p.count || 0), 0);

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Check-In Challenges
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          sx={{
            background: isClosed ? "#FEE2E2" : "#E8F5E9",
            color: isClosed ? "#DC2626" : "#2E7D32",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Per-check-in-point counts (Requirement 12.1, 12.3, 12.8). */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="checkin-points">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <PlaceOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
              Check-In Points
            </Typography>
          </Box>

          {points.length === 0 ? (
            <Typography sx={{ color: "#9CA3AF", fontSize: 14, py: 2 }}>
              No check-in points configured yet.
            </Typography>
          ) : (
            points.map((pt) => {
              const count = pt.count || 0;
              const isZero = count === 0;
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <Box key={pt.pointId} sx={{ mb: 1.75 }} data-testid={`point-row-${pt.pointId}`}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                      {pt.label || pt.pointId}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 14, color: isZero ? "#9CA3AF" : "#6B7280", fontWeight: 700 }}
                      data-testid={`point-count-${pt.pointId}`}
                    >
                      {count}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 10, borderRadius: 5, background: "#F3F4F6", overflow: "hidden" }}>
                    <Box
                      data-testid={`point-bar-${pt.pointId}`}
                      sx={{
                        height: "100%",
                        width: `${width}%`,
                        background: ACCENT,
                        borderRadius: 5,
                        transition: "width 0.7s cubic-bezier(.2,.9,.25,1)",
                      }}
                    />
                  </Box>
                  {isZero && (
                    <Typography
                      sx={{ fontSize: 12, color: "#9CA3AF", mt: 0.5 }}
                      data-testid={`point-zero-${pt.pointId}`}
                    >
                      No check-ins yet
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Milestone completions (Requirement 12.4). */}
      {milestones.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="milestones">
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CardGiftcardOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                Milestone Completions
              </Typography>
            </Box>
            {milestones.map((ms) => (
              <Box
                key={ms.id}
                data-testid={`milestone-row-${ms.id}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                  borderBottom: "1px solid #F3F4F6",
                }}
              >
                <Typography sx={{ fontSize: 14, color: "#374151" }}>
                  {ms.rewardLabel || ms.id}
                </Typography>
                <Typography
                  sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}
                  data-testid={`milestone-count-${ms.id}`}
                >
                  {ms.grantedCount || 0} granted
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard (Requirement 12.5, 12.6) — omitted when disabled. */}
      {showLeaderboard && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }} data-testid="leaderboard">
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <EmojiEventsOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                Leaderboard
              </Typography>
            </Box>
            {entries.length === 0 ? (
              <Typography sx={{ color: "#9CA3AF", fontSize: 14, py: 1 }}>
                No check-ins recorded yet.
              </Typography>
            ) : (
              [...entries]
                .sort((a, b) => (a.rank || 0) - (b.rank || 0))
                .map((entry) => (
                  <Box
                    key={entry.attendeeId}
                    data-testid={`leaderboard-row-${entry.attendeeId}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      py: 1,
                      borderBottom: "1px solid #F3F4F6",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography sx={{ fontWeight: 800, color: ACCENT, minWidth: 28 }}>
                        #{entry.rank}
                      </Typography>
                      <Typography sx={{ fontSize: 14, color: "#374151" }}>
                        {entry.attendeeId}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        {entry.checkInCount} check-in{entry.checkInCount === 1 ? "" : "s"}
                      </Typography>
                      <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                        {entry.milestonesGranted} milestone{entry.milestonesGranted === 1 ? "" : "s"}
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>
                        {entry.score} pts
                      </Typography>
                    </Box>
                  </Box>
                ))
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CheckInChallengeLiveDashboard;
