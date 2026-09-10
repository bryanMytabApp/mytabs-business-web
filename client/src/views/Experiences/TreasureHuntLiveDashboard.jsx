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
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 11.2)

// The plugin returns the leaderboard as a bare array of entries
// [{ attendeeId, score, claimedCount, completionState, rank }]. Tolerate a
// wrapped { entries: [...] } shape too so the component is robust to either.
function leaderboardEntries(leaderboard) {
  if (!leaderboard) return [];
  if (Array.isArray(leaderboard)) return leaderboard;
  return Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
}

// The plugin returns counts as { totalClaims, checkpoints: [{ checkpointId,
// hint, claimCount }] }. Tolerate a bare array too.
function checkpointCounts(counts) {
  if (!counts) return [];
  if (Array.isArray(counts)) return counts;
  return Array.isArray(counts.checkpoints) ? counts.checkpoints : [];
}

// Convert a total number of seconds into an mm:ss (or hh:mm:ss) countdown label.
function formatRemaining(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

/**
 * TreasureHuntLiveDashboard — organizer-facing live dashboard for a Treasure
 * Hunts instance. Mirrors CheckInChallengeLiveDashboard/RaffleLiveDashboard: a
 * LIVE/CLOSED header chip with a time-remaining readout when a Time_Limit is
 * configured, a 2s ETag-optimized polling loop over getLiveStats, a
 * per-checkpoint claim-count section (each checkpoint's hint + distinct-claimer
 * count as a proportional bar against the greatest count), and a leaderboard
 * ordered by ascending rank. A failed refresh surfaces an Alert while the
 * interval keeps running to retry next tick (Requirement 11.6).
 */
const TreasureHuntLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // A ticking "now" so the time-remaining countdown re-renders each second even
  // when the polled stats are unchanged (304).
  const [now, setNow] = useState(() => Date.now());
  const etagRef = useRef(null);
  const pollRef = useRef(null);
  const clockRef = useRef(null);

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
          setError(err.response?.data?.message || "Failed to load hunt results");
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

  // Set up a single 2s interval on mount (Requirement 11.2). A failed refresh
  // sets the error while the interval keeps running so the next tick retries
  // (Requirement 11.6).
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

  // A 1s clock so the time-remaining countdown updates smoothly (Requirement 11.5).
  useEffect(() => {
    clockRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (clockRef.current) {
        clearInterval(clockRef.current);
        clockRef.current = null;
      }
    };
  }, []);

  const checkpoints = checkpointCounts(stats?.counts);
  const entries = leaderboardEntries(stats?.leaderboard);
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";

  // The greatest per-checkpoint claim count anchors every bar's proportional
  // width (Requirement 11.3). Guard against divide-by-zero when all counts are 0.
  const maxCount = checkpoints.reduce((max, c) => Math.max(max, c.claimCount || 0), 0);

  // Time remaining (Requirement 11.5): derived from timeLimit (minutes) +
  // liveStartedAt. remaining = max(0, timeLimit*60 - (now - liveStartedAt)/1000).
  const hasTimeLimit =
    stats?.timeLimit !== null && stats?.timeLimit !== undefined && stats?.timeLimit !== "";
  let remainingSeconds = null;
  if (hasTimeLimit && stats?.liveStartedAt) {
    const startedMs = new Date(stats.liveStartedAt).getTime();
    if (!Number.isNaN(startedMs)) {
      remainingSeconds = Math.max(0, Number(stats.timeLimit) * 60 - (now - startedMs) / 1000);
    }
  }

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Treasure Hunt
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
        {remainingSeconds !== null && (
          <Chip
            icon={<TimerOutlinedIcon sx={{ fontSize: 16 }} />}
            label={`${formatRemaining(remainingSeconds)} left`}
            size="small"
            data-testid="time-remaining"
            sx={{
              background: "#EFF6FF",
              color: "#1D4ED8",
              fontWeight: 700,
              fontSize: 12,
              height: 24,
              fontFamily: "monospace",
            }}
          />
        )}
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Per-checkpoint claim counts (Requirement 11.1, 11.3, 11.7). */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="checkpoints">
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <PlaceOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
              Checkpoints
            </Typography>
          </Box>

          {checkpoints.length === 0 ? (
            <Typography sx={{ color: "#9CA3AF", fontSize: 14, py: 2 }}>
              No checkpoints configured yet.
            </Typography>
          ) : (
            checkpoints.map((cp, idx) => {
              const count = cp.claimCount || 0;
              const isZero = count === 0;
              const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
              return (
                <Box key={cp.checkpointId} sx={{ mb: 1.75 }} data-testid={`checkpoint-row-${cp.checkpointId}`}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>
                      {cp.hint || `Checkpoint ${idx + 1}`}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 14, color: isZero ? "#9CA3AF" : "#6B7280", fontWeight: 700 }}
                      data-testid={`checkpoint-count-${cp.checkpointId}`}
                    >
                      {count}
                    </Typography>
                  </Box>
                  <Box sx={{ height: 10, borderRadius: 5, background: "#F3F4F6", overflow: "hidden" }}>
                    <Box
                      data-testid={`checkpoint-bar-${cp.checkpointId}`}
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
                      data-testid={`checkpoint-zero-${cp.checkpointId}`}
                    >
                      Not found yet
                    </Typography>
                  )}
                </Box>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Leaderboard / attendee standings (Requirement 11.4). */}
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
              No checkpoints found yet.
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
                      {entry.claimedCount} found
                    </Typography>
                    <Chip
                      label={entry.completionState === "complete" ? "Complete" : "In progress"}
                      size="small"
                      data-testid={`leaderboard-state-${entry.attendeeId}`}
                      sx={{
                        height: 20,
                        fontSize: 11,
                        fontWeight: 700,
                        background: entry.completionState === "complete" ? "#E8F5E9" : "#F3F4F6",
                        color: entry.completionState === "complete" ? "#2E7D32" : "#6B7280",
                      }}
                    />
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>
                      {entry.score} pts
                    </Typography>
                  </Box>
                </Box>
              ))
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default TreasureHuntLiveDashboard;
