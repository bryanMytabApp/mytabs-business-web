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
  Button,
} from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { getLiveStats, transitionState } from "../../services/experienceService";

const ACCENT = "#EC4899"; // Social & Community brand accent
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 11.2)

// Labels for the Contest_Phase chip (Requirement 11.1). The /live-stats payload
// may carry an explicit `phase` field; when present it drives the phase chip,
// otherwise only the LIVE/CLOSED state chip is shown.
const PHASE_LABELS = {
  submission: "Submission",
  voting: "Voting",
  results: "Results",
};

// Coerce a possibly-missing numeric metric to a non-negative number.
function num(value) {
  return Number(value) || 0;
}

// Normalize the per-status submission counts into { pending, approved, rejected }.
// getAnalytics returns submissionsByStatus keyed by Moderation_Status; tolerate a
// missing object so the metrics row always renders concrete counts.
function statusCounts(stats) {
  const byStatus = stats?.submissionsByStatus || {};
  return {
    pending: num(byStatus.pending),
    approved: num(byStatus.approved),
    rejected: num(byStatus.rejected),
  };
}

// Resolve a Media_Reference to a displayable URL. Absolute/data URLs pass through;
// a bare storage key can't be rendered directly, so callers fall back to a
// placeholder when this returns a non-URL. Kept permissive so the preview never
// throws on an unexpected shape.
function mediaUrl(mediaReference) {
  if (!mediaReference || typeof mediaReference !== "string") return "";
  if (/^(https?:|data:|blob:)/i.test(mediaReference)) return mediaReference;
  return "";
}

// A ranking entry is a Winner when the payload explicitly flags it (isWinner),
// or — when a winnerCount is present on the stats payload — when its rank falls
// within the top winnerCount positions (Requirement 11.5). When neither signal
// is present the entry renders its rank/voteCount without a winner treatment.
function isWinnerEntry(entry, winnerCount) {
  if (entry?.isWinner === true) return true;
  if (typeof winnerCount === "number" && winnerCount > 0 && typeof entry?.rank === "number") {
    return entry.rank <= winnerCount;
  }
  return false;
}

/**
 * PhotoContestLiveDashboard — organizer-facing moderation + results dashboard for
 * a Photo Contests instance. Mirrors LoyaltyLiveDashboard / CouponLiveDashboard:
 * a LIVE/CLOSED header chip plus a Contest_Phase chip, a 2s ETag-optimized polling
 * loop over getLiveStats while Live (304 skips re-render; the interval stops while
 * Closed — Requirement 11.2/11.6), a metrics row (total submissions, per-status
 * counts, total valid votes, unique submitters/voters — Requirement 11.4), a
 * moderation-queue section presenting each pending submission's photo preview,
 * caption, timestamp, and approve/reject controls that call the moderation action
 * and optimistically reflect the new status (Requirement 11.3), and a ranked
 * results section shown in the results phase flagging Winners (Requirement 11.5).
 * A failed refresh surfaces an Alert while the interval keeps running to retry
 * next tick (Requirement 11.6); zero submissions renders an empty-state indicator
 * (Requirement 11.7).
 */
const PhotoContestLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Optimistic per-submission moderation overrides applied on approve/reject
  // before the next poll reflects the server state (Requirement 11.3).
  const [moderationOverrides, setModerationOverrides] = useState({});
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
          setError(err.response?.data?.message || "Failed to load contest results");
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

  // Set up the 2s polling interval while Live (Requirement 11.2). While Closed the
  // dashboard shows final metrics and stops polling (Requirement 11.6). A failed
  // refresh sets the error while the interval keeps running so the next tick
  // retries (Requirement 11.6).
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

  // Moderation approve/reject. Mirrors the scoped host-action pattern the service
  // exposes (setPollState/setQuestionState/setMarketState → transitionState): the
  // core dispatches on `action` and invokes the plugin's moderate() with the
  // target submissionId. Optimistically reflects the new Moderation_Status locally
  // until the next poll (Requirement 11.3).
  const handleModerate = useCallback(
    async (submissionId, action) => {
      const nextStatus = action === "approve" ? "approved" : "rejected";
      setModerationOverrides((prev) => ({ ...prev, [submissionId]: nextStatus }));
      try {
        await transitionState(eventId, experienceId, { action, submissionId });
        // Refresh so the metrics and queue reflect the server state.
        fetchStats(false);
      } catch (err) {
        // Roll back the optimistic override and surface the failure.
        setModerationOverrides((prev) => {
          const next = { ...prev };
          delete next[submissionId];
          return next;
        });
        setError(err.response?.data?.message || "Failed to moderate submission");
      }
    },
    [eventId, experienceId, fetchStats]
  );

  const counts = statusCounts(stats);
  const totalSubmissions = num(stats?.totalSubmissions);
  const totalValidVotes = num(stats?.totalValidVotes);
  const uniqueSubmitters = num(stats?.uniqueSubmitters);
  const uniqueVoters = num(stats?.uniqueVoters);
  const phase = stats?.phase && PHASE_LABELS[stats.phase] ? stats.phase : null;
  const winnerCount = typeof stats?.winnerCount === "number" ? stats.winnerCount : undefined;

  // The moderation queue is a dedicated pending-submission projection the payload
  // may include; it is NOT derivable from `ranking` (approved-only) or the
  // approved `submissions` list. Apply optimistic overrides and drop entries that
  // have already been moderated locally.
  const moderationQueue = (Array.isArray(stats?.moderationQueue) ? stats.moderationQueue : []).filter(
    (item) => !moderationOverrides[item.submissionId]
  );

  const ranking = Array.isArray(stats?.ranking) ? stats.ranking : [];
  const showResults = phase === "results" && ranking.length > 0;

  // Zero submissions → empty state (Requirement 11.7).
  const hasSubmissions = totalSubmissions > 0;

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header (Requirement 11.1). */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <PhotoCameraOutlinedIcon sx={{ color: ACCENT, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Photo Contest
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          data-testid="state-chip"
          sx={{
            background: isClosed ? "#FEE2E2" : "#FCE7F3",
            color: isClosed ? "#DC2626" : "#BE185D",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
        {phase && (
          <Chip
            label={PHASE_LABELS[phase]}
            size="small"
            data-testid="phase-chip"
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
            This experience is closed. Final metrics below.
          </Typography>
        )}
      </Box>

      {/* Metrics row (Requirement 11.4). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box
          data-testid="total-submissions"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#FCE7F3", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Submissions</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalSubmissions.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="total-valid-votes"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Valid Votes</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalValidVotes.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="unique-submitters"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Submitters</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {uniqueSubmitters.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="unique-voters"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Voters</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {uniqueVoters.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Per-status counts (Requirement 11.4). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box data-testid="status-pending" sx={{ px: 2, py: 1, borderRadius: 2, background: "#FEF3C7", minWidth: 120 }}>
          <Typography sx={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>Pending</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.pending.toLocaleString()}
          </Typography>
        </Box>
        <Box data-testid="status-approved" sx={{ px: 2, py: 1, borderRadius: 2, background: "#D1FAE5", minWidth: 120 }}>
          <Typography sx={{ fontSize: 12, color: "#065F46", fontWeight: 700 }}>Approved</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.approved.toLocaleString()}
          </Typography>
        </Box>
        <Box data-testid="status-rejected" sx={{ px: 2, py: 1, borderRadius: 2, background: "#FEE2E2", minWidth: 120 }}>
          <Typography sx={{ fontSize: 12, color: "#991B1B", fontWeight: 700 }}>Rejected</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.rejected.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Failed refresh surfaces an Alert while polling continues (Requirement 11.6). */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} data-testid="refresh-error">
          {error}
        </Alert>
      )}

      {/* Empty state (Requirement 11.7). */}
      {!hasSubmissions && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="empty-state">
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>
              No photo submissions yet.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Moderation queue (Requirement 11.3). The section header + per-status
          counts always render; individual approve/reject items render when the
          payload carries a pending moderationQueue projection. */}
      <Card
        elevation={0}
        sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
        data-testid="moderation-queue"
      >
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 2 }}>
            Moderation Queue
          </Typography>

          {moderationQueue.length === 0 ? (
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }} data-testid="moderation-empty">
              No submissions awaiting review.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {moderationQueue.map((item) => {
                const url = mediaUrl(item.mediaReference);
                return (
                  <Box
                    key={item.submissionId}
                    data-testid={`moderation-item-${item.submissionId}`}
                    sx={{
                      display: "flex",
                      gap: 2,
                      alignItems: "center",
                      p: 1.5,
                      borderRadius: 2,
                      border: "1px solid #F0F0F0",
                      flexWrap: "wrap",
                    }}
                  >
                    <Box
                      sx={{
                        width: 72,
                        height: 72,
                        borderRadius: 2,
                        background: "#F3F4F6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      {url ? (
                        <Box
                          component="img"
                          src={url}
                          alt={item.caption || "Submission preview"}
                          data-testid={`moderation-photo-${item.submissionId}`}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <BrokenImageOutlinedIcon
                          sx={{ color: "#9CA3AF" }}
                          data-testid={`moderation-photo-${item.submissionId}`}
                        />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <Typography sx={{ fontSize: 14, color: "#1D1B20", fontWeight: 600 }}>
                        {item.caption || "(no caption)"}
                      </Typography>
                      {item.submittedAt && (
                        <Typography
                          sx={{ fontSize: 12, color: "#9CA3AF" }}
                          data-testid={`moderation-time-${item.submissionId}`}
                        >
                          {new Date(item.submittedAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleOutlineIcon />}
                        data-testid={`approve-${item.submissionId}`}
                        onClick={() => handleModerate(item.submissionId, "approve")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          backgroundColor: "#059669",
                          "&:hover": { backgroundColor: "#047857" },
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<HighlightOffIcon />}
                        data-testid={`reject-${item.submissionId}`}
                        onClick={() => handleModerate(item.submissionId, "reject")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          color: "#DC2626",
                          borderColor: "#FCA5A5",
                          "&:hover": { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
                        }}
                      >
                        Reject
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Ranked results (Requirement 11.5) — shown in the results phase with a
          non-empty ranking. */}
      {showResults && (
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
          data-testid="ranking"
        >
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 2 }}>
              Results
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ranking.map((entry, idx) => {
                const winner = isWinnerEntry(entry, winnerCount);
                const rank = typeof entry.rank === "number" ? entry.rank : idx + 1;
                return (
                  <Box
                    key={entry.submissionId || idx}
                    data-testid={`ranking-row-${entry.submissionId || idx}`}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 2,
                      p: 1.5,
                      borderRadius: 2,
                      border: winner ? "1px solid #FBCFE8" : "1px solid #F0F0F0",
                      background: winner ? "#FDF2F8" : "#FFFFFF",
                      flexWrap: "wrap",
                    }}
                  >
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: "#6B7280", minWidth: 32 }}>
                      #{rank}
                    </Typography>
                    <Box sx={{ flex: 1, minWidth: 140 }}>
                      <Typography sx={{ fontSize: 14, color: "#1D1B20", fontWeight: 600 }}>
                        {entry.caption || "(no caption)"}
                      </Typography>
                    </Box>
                    <Typography
                      sx={{ fontSize: 14, fontWeight: 800, color: "#1D1B20" }}
                      data-testid={`ranking-votes-${entry.submissionId || idx}`}
                    >
                      {num(entry.voteCount).toLocaleString()} votes
                    </Typography>
                    {winner && (
                      <Chip
                        icon={<EmojiEventsOutlinedIcon />}
                        label="Winner"
                        size="small"
                        data-testid={`winner-${entry.submissionId || idx}`}
                        sx={{
                          background: "#FCE7F3",
                          color: "#BE185D",
                          fontWeight: 700,
                          fontSize: 11,
                          height: 24,
                        }}
                      />
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

export default PhotoContestLiveDashboard;
