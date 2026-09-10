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
  IconButton,
  Collapse,
} from "@mui/material";
import LeaderboardOutlinedIcon from "@mui/icons-material/LeaderboardOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand accent
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 9.2)

// Medal tints for the top-three ranks (Requirement 9.3). Ranks outside the
// podium render without a medal treatment.
const MEDAL_COLORS = {
  1: "#F5C518", // gold
  2: "#9CA3AF", // silver
  3: "#b08d57", // bronze
};

// Coerce a possibly-missing numeric metric to a non-negative number so the
// score cells always render a concrete value.
function num(value) {
  return Number(value) || 0;
}

/**
 * LeaderboardLiveDashboard — organizer-facing live standings dashboard for a
 * Leaderboards experience instance. Mirrors PhotoContestLiveDashboard /
 * LoyaltyLiveDashboard: a LIVE/CLOSED header chip, a 2s ETag-optimized polling
 * loop over getLiveStats while Live (304 skips re-render; the interval stops
 * while Closed — Requirement 9.2/9.4), and a ranked standings list rendering one
 * row per Leaderboard_Entry with rank, attendee, Combined_Score, and an
 * expandable per-source Weighted_Source_Score breakdown, with medal-tinted
 * top-three ranks (Requirement 9.1/9.3).
 *
 * The /live-stats payload for leaderboards carries:
 *   { experienceType:'leaderboards', state, experienceName, engagementCode,
 *     mode:'aggregation'|'manual', displaySize, tieBreak,
 *     standings:[{ attendeeId, combinedScore, rank,
 *                  breakdown:[{ sourceExperienceId, weightedSourceScore }] }],
 *     analytics:{ configuredSources, uniqueContributingAttendees,
 *                 totalAcceptedContributions, greatestCombinedScore } }
 *
 * The standings array is already ordered by ascending rank and truncated to the
 * Display_Size server-side, so rows render as-is. A Manual_Mode chip + indicator
 * surface when mode === 'manual' (Requirement 9.7), a closed indicator surfaces
 * while Closed (Requirement 9.4), an empty-standings indicator surfaces when
 * there are zero accepted contributions (Requirement 9.6), and a failed refresh
 * surfaces an Alert while the interval keeps running to retry next tick
 * (Requirement 9.5).
 */
const LeaderboardLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Per-row expand/collapse state for the source-score breakdown, keyed by
  // attendeeId (Requirement 9.3).
  const [expanded, setExpanded] = useState({});
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
          // Unchanged since last poll — skip re-render (Requirement 9.2).
          return;
        }
        const etag = res.headers?.etag || res.headers?.["etag"];
        if (etag) etagRef.current = etag;
        setStats(res.data?.data || res.data);
        setError(null);
      } catch (err) {
        if (err.response?.status !== 304) {
          setError(err.response?.data?.message || "Failed to load standings");
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

  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";

  // Set up the 2s polling interval while Live (Requirement 9.2). While Closed the
  // dashboard shows the final standings and stops polling (Requirement 9.4). A
  // failed refresh sets the error while the interval keeps running so the next
  // tick retries (Requirement 9.5).
  useEffect(() => {
    if (isClosed) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return undefined;
    }
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchStats, isClosed]);

  const toggleRow = useCallback((attendeeId) => {
    setExpanded((prev) => ({ ...prev, [attendeeId]: !prev[attendeeId] }));
  }, []);

  const isManual = stats?.mode === "manual";
  // Standings arrive already ordered by ascending rank and truncated to the
  // Display_Size server-side; render as-is (Requirement 9.3).
  const standings = Array.isArray(stats?.standings) ? stats.standings : [];
  const hasStandings = standings.length > 0;

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header (Requirement 9.1). */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <LeaderboardOutlinedIcon sx={{ color: ACCENT, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          {stats?.experienceName || "Leaderboard"}
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          data-testid="state-chip"
          sx={{
            background: isClosed ? "#FEE2E2" : "#DCFCE7",
            color: isClosed ? "#DC2626" : "#15803D",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
        {isManual && (
          <Chip
            label="Manual Mode"
            size="small"
            data-testid="manual-mode-chip"
            sx={{
              background: "#F3F4F6",
              color: "#374151",
              fontWeight: 700,
              fontSize: 11,
              height: 22,
            }}
          />
        )}
        {isClosed && (
          <Typography sx={{ fontSize: 13, color: "#6B7280" }} data-testid="closed-indicator">
            This leaderboard is closed. Final standings below.
          </Typography>
        )}
      </Box>

      {/* Manual-mode indicator (Requirement 9.7). */}
      {isManual && (
        <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }} data-testid="manual-mode-indicator">
          Standings are driven by direct point awards rather than configured source experiences.
        </Alert>
      )}

      {/* Failed refresh surfaces an Alert while polling continues (Requirement 9.5). */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} data-testid="refresh-error">
          {error}
        </Alert>
      )}

      {/* Empty state — zero accepted contributions (Requirement 9.6). */}
      {!hasStandings && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="empty-standings">
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>
              No standings yet. Accepted point contributions will appear here.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Standings list (Requirement 9.3). */}
      {hasStandings && (
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
          data-testid="standings"
        >
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 2 }}>
              Standings
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {standings.map((entry, idx) => {
                const attendeeId = entry.attendeeId || `entry-${idx}`;
                const rank = typeof entry.rank === "number" ? entry.rank : idx + 1;
                const medal = MEDAL_COLORS[rank];
                const breakdown = Array.isArray(entry.breakdown) ? entry.breakdown : [];
                const isOpen = !!expanded[attendeeId];
                const canExpand = breakdown.length > 0;
                return (
                  <Box
                    key={attendeeId}
                    data-testid={`standings-row-${attendeeId}`}
                    sx={{
                      borderRadius: 2,
                      border: medal ? `1px solid ${medal}` : "1px solid #F0F0F0",
                      background: medal ? `${medal}1A` : "#FFFFFF",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        p: 1.5,
                        flexWrap: "wrap",
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          minWidth: 44,
                        }}
                      >
                        {medal && <EmojiEventsOutlinedIcon sx={{ color: medal, fontSize: 18 }} />}
                        <Typography sx={{ fontSize: 16, fontWeight: 800, color: medal || "#6B7280" }}>
                          #{rank}
                        </Typography>
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 140 }}>
                        <Typography sx={{ fontSize: 14, color: "#1D1B20", fontWeight: 600 }}>
                          {entry.attendeeId || "(unknown attendee)"}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{ fontSize: 14, fontWeight: 800, color: "#1D1B20" }}
                        data-testid={`combined-score-${attendeeId}`}
                      >
                        {num(entry.combinedScore).toLocaleString()} pts
                      </Typography>
                      {canExpand && (
                        <IconButton
                          size="small"
                          onClick={() => toggleRow(attendeeId)}
                          data-testid={`toggle-breakdown-${attendeeId}`}
                          aria-label={isOpen ? "Collapse breakdown" : "Expand breakdown"}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      )}
                    </Box>
                    {canExpand && (
                      <Collapse in={isOpen} unmountOnExit>
                        <Box
                          data-testid={`breakdown-${attendeeId}`}
                          sx={{
                            px: 2,
                            pb: 1.5,
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                          }}
                        >
                          {breakdown.map((source, sIdx) => (
                            <Box
                              key={source.sourceExperienceId || `source-${sIdx}`}
                              sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                gap: 2,
                                py: 0.5,
                                borderTop: "1px solid #F0F0F0",
                              }}
                            >
                              <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                                {source.sourceExperienceId || "(unknown source)"}
                              </Typography>
                              <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1D1B20" }}>
                                {num(source.weightedSourceScore).toLocaleString()} pts
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </Collapse>
                    )}
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default LeaderboardLiveDashboard;
