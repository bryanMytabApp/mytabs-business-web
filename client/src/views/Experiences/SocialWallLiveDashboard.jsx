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
  IconButton,
} from "@mui/material";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SlideshowOutlinedIcon from "@mui/icons-material/SlideshowOutlined";
import CloseIcon from "@mui/icons-material/Close";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import { getLiveStats, transitionState } from "../../services/experienceService";

const ACCENT = "#EC4899"; // Social & Community brand accent
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 13.2)
const ADVANCE_INTERVAL = 5000; // 5 seconds big-screen auto-advance (Requirement 13.6)

// Coerce a possibly-missing numeric metric to a non-negative number.
function num(value) {
  return Number(value) || 0;
}

// Normalize the per-status post counts into { pending, approved, hidden, removed }.
// The live-stats payload carries postsByStatus keyed by Moderation_Status; tolerate a
// missing object so the metrics row always renders concrete counts (Requirement 13.5).
function statusCounts(stats) {
  const byStatus = stats?.postsByStatus || {};
  return {
    pending: num(byStatus.pending),
    approved: num(byStatus.approved),
    hidden: num(byStatus.hidden),
    removed: num(byStatus.removed),
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

/**
 * SocialWallLiveDashboard — organizer-facing moderation + big-screen dashboard for
 * a Social Wall instance. Mirrors PhotoContestLiveDashboard: a LIVE/CLOSED header
 * chip, a 2s ETag-optimized polling loop over getLiveStats while Live (304 skips
 * re-render; the interval stops while Closed — Requirement 13.2), a metrics row
 * (total posts, per-Moderation_Status counts, total reactions, unique posters —
 * Requirement 13.5), a moderation-queue section presenting each pending post's
 * photo preview, text, timestamp, and approve/remove controls that call the
 * moderation action and optimistically reflect the new status (Requirement 13.3),
 * an approved-posts section where each approved post exposes hide/remove controls
 * (Requirement 13.4), and a big-screen projection mode that shows only approved
 * posts and auto-advances every 5s (Requirement 13.6). A failed refresh surfaces
 * an Alert while the interval keeps running to retry next tick (Requirement 13.7);
 * zero approved posts renders an empty-state indicator (Requirement 13.8).
 */
const SocialWallLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Optimistic per-post moderation overrides applied on approve/hide/remove
  // before the next poll reflects the server state (Requirement 13.3/13.4).
  const [moderationOverrides, setModerationOverrides] = useState({});
  // Big-screen projection mode + the auto-advancing slide index (Requirement 13.6).
  const [bigScreen, setBigScreen] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
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
          setError(err.response?.data?.message || "Failed to load social wall feed");
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

  // Set up the 2s polling interval while Live (Requirement 13.2). While Closed the
  // dashboard shows final metrics and stops polling. A failed refresh sets the error
  // while the interval keeps running so the next tick retries (Requirement 13.7).
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

  // Moderation approve/hide/remove. Mirrors the scoped host-action pattern the
  // service exposes (setPollState/setQuestionState/setMarketState → transitionState):
  // the core dispatches on `action` and invokes the plugin's moderate() with the
  // target postId. Optimistically reflects the new Moderation_Status locally until
  // the next poll (Requirement 13.3/13.4).
  const handleModerate = useCallback(
    async (postId, action) => {
      // action ∈ { 'approve', 'unapprove', 'hide', 'remove' } → next Moderation_Status.
      // 'unapprove' reverses an approval: the post returns to the moderation queue
      // as 'pending' (off the feed/big-screen) without being hidden or removed.
      const nextStatus =
        action === "approve"
          ? "approved"
          : action === "unapprove"
          ? "pending"
          : action === "hide"
          ? "hidden"
          : "removed";
      setModerationOverrides((prev) => ({ ...prev, [postId]: nextStatus }));
      try {
        await transitionState(eventId, experienceId, { action, postId });
        // Refresh so the metrics, queue, and feed reflect the server state.
        fetchStats(false);
      } catch (err) {
        // Roll back the optimistic override and surface the failure.
        setModerationOverrides((prev) => {
          const next = { ...prev };
          delete next[postId];
          return next;
        });
        setError(err.response?.data?.message || "Failed to moderate post");
      }
    },
    [eventId, experienceId, fetchStats]
  );

  const counts = statusCounts(stats);
  const totalPosts = num(stats?.totalPosts);
  const totalReactions = num(stats?.totalReactions);
  const uniquePosters = num(stats?.uniquePosters);

  // Reconcile optimistic overrides against the freshly polled server state: once
  // the server payload reflects a post's overridden status, drop the override so
  // the server projections take over. Without this, an override lingers forever —
  // in particular an `unapprove` (→ pending) override would keep filtering the
  // post OUT of the moderation queue even after the server returns it there,
  // so the post would never reappear until a full reload.
  useEffect(() => {
    if (!stats) return;
    const serverQueue = Array.isArray(stats.moderationQueue) ? stats.moderationQueue : [];
    const serverFeed = Array.isArray(stats.feed) ? stats.feed : [];
    const pendingIds = new Set(serverQueue.map((p) => p.postId));
    const approvedIds = new Set(serverFeed.map((p) => p.postId));

    setModerationOverrides((prev) => {
      const entries = Object.entries(prev);
      if (entries.length === 0) return prev;
      let changed = false;
      const next = {};
      for (const [postId, status] of entries) {
        // The server now agrees with the optimistic status → the override has
        // done its job and can be cleared.
        const settled =
          (status === "pending" && pendingIds.has(postId)) ||
          (status === "approved" && approvedIds.has(postId)) ||
          // hidden/removed: the post is gone from BOTH visible projections.
          ((status === "hidden" || status === "removed") &&
            !pendingIds.has(postId) &&
            !approvedIds.has(postId));
        if (settled) {
          changed = true;
        } else {
          next[postId] = status;
        }
      }
      return changed ? next : prev;
    });
  }, [stats]);

  // The moderation queue is a dedicated pending-post projection the payload
  // carries. Apply optimistic overrides: hide entries optimistically moderated
  // AWAY from pending, and surface entries optimistically moved TO pending (an
  // `unapprove`) even if a stale poll hasn't listed them yet (Requirement 13.3).
  const moderationQueue = (Array.isArray(stats?.moderationQueue) ? stats.moderationQueue : []).filter(
    (item) => !moderationOverrides[item.postId] || moderationOverrides[item.postId] === "pending"
  );

  // The approved feed is the approved-only projection used by both the
  // approved-posts controls (Requirement 13.4) and the big-screen display
  // (Requirement 13.6). Drop entries locally moderated to a non-approved status so
  // a hidden/removed post disappears immediately (mirrors the server recompute at
  // the next refresh — Req 8.4).
  const feed = (Array.isArray(stats?.feed) ? stats.feed : []).filter(
    (item) => !moderationOverrides[item.postId] || moderationOverrides[item.postId] === "approved"
  );

  // Zero approved posts → empty state (Requirement 13.8).
  const hasApprovedPosts = feed.length > 0;

  // Keep the big-screen slide index in range as the approved feed changes; a post
  // that leaves approved disappears at the next refresh (Requirement 13.6).
  useEffect(() => {
    if (feed.length === 0) {
      if (slideIndex !== 0) setSlideIndex(0);
      return;
    }
    if (slideIndex >= feed.length) setSlideIndex(feed.length - 1);
  }, [feed.length, slideIndex]);

  // Auto-advance the big-screen projection every 5s while active (Requirement 13.6).
  useEffect(() => {
    if (!bigScreen || feed.length <= 1) return undefined;
    const id = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % feed.length);
    }, ADVANCE_INTERVAL);
    return () => clearInterval(id);
  }, [bigScreen, feed.length]);

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  // Big-screen projection mode (Requirement 13.6). Full-bleed overlay showing only
  // approved posts; auto-advances every 5s. Zero approved posts → empty state
  // (Requirement 13.8).
  if (bigScreen) {
    const current = feed[Math.min(slideIndex, Math.max(feed.length - 1, 0))];
    const currentUrl = current ? mediaUrl(current.mediaReference) : "";
    return (
      <Box
        data-testid="big-screen"
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: 1300,
          background: "linear-gradient(135deg, #1D1B20 0%, #4A044E 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: { xs: 3, md: 8 },
        }}
      >
        <IconButton
          data-testid="big-screen-close"
          onClick={() => setBigScreen(false)}
          sx={{ position: "absolute", top: 24, right: 24, color: "#FFFFFF" }}
          aria-label="Exit big-screen display"
        >
          <CloseIcon />
        </IconButton>
        {hasApprovedPosts && current ? (
          <Box sx={{ maxWidth: 1000, width: "100%", textAlign: "center" }}>
            {currentUrl && (
              <Box
                component="img"
                src={currentUrl}
                alt={current.text || "Post photo"}
                data-testid="big-screen-photo"
                sx={{
                  maxWidth: "100%",
                  maxHeight: "55vh",
                  borderRadius: 4,
                  objectFit: "contain",
                  mb: 4,
                }}
              />
            )}
            <Typography
              data-testid="big-screen-text"
              sx={{ color: "#FFFFFF", fontSize: { xs: 28, md: 48 }, fontWeight: 800, lineHeight: 1.2 }}
            >
              {current.text || ""}
            </Typography>
            <Typography sx={{ color: ACCENT, fontSize: { xs: 16, md: 22 }, fontWeight: 700, mt: 3 }}>
              ♥ {num(current.reactionCount).toLocaleString()}
            </Typography>
          </Box>
        ) : (
          <Typography
            data-testid="big-screen-empty"
            sx={{ color: "#FFFFFF", fontSize: { xs: 22, md: 36 }, fontWeight: 700, opacity: 0.8 }}
          >
            No approved posts to display yet.
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header (Requirement 13.1). */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <ForumOutlinedIcon sx={{ color: ACCENT, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Social Wall
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
        {isClosed && (
          <Typography sx={{ fontSize: 13, color: "#6B7280" }} data-testid="closed-indicator">
            This experience is closed. Final metrics below.
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Button
          size="small"
          variant="contained"
          startIcon={<SlideshowOutlinedIcon />}
          data-testid="big-screen-toggle"
          onClick={() => {
            setSlideIndex(0);
            setBigScreen(true);
          }}
          sx={{
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            backgroundColor: ACCENT,
            "&:hover": { backgroundColor: "#DB2777" },
          }}
        >
          Big Screen
        </Button>
      </Box>

      {/* Metrics row (Requirement 13.5). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box
          data-testid="total-posts"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#FCE7F3", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Posts</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalPosts.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="total-reactions"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Reactions</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalReactions.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="unique-posters"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 150 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Posters</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {uniquePosters.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Per-status counts (Requirement 13.5). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box data-testid="status-pending" sx={{ px: 2, py: 1, borderRadius: 2, background: "#FEF3C7", minWidth: 110 }}>
          <Typography sx={{ fontSize: 12, color: "#92400E", fontWeight: 700 }}>Pending</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.pending.toLocaleString()}
          </Typography>
        </Box>
        <Box data-testid="status-approved" sx={{ px: 2, py: 1, borderRadius: 2, background: "#D1FAE5", minWidth: 110 }}>
          <Typography sx={{ fontSize: 12, color: "#065F46", fontWeight: 700 }}>Approved</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.approved.toLocaleString()}
          </Typography>
        </Box>
        <Box data-testid="status-hidden" sx={{ px: 2, py: 1, borderRadius: 2, background: "#E5E7EB", minWidth: 110 }}>
          <Typography sx={{ fontSize: 12, color: "#374151", fontWeight: 700 }}>Hidden</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.hidden.toLocaleString()}
          </Typography>
        </Box>
        <Box data-testid="status-removed" sx={{ px: 2, py: 1, borderRadius: 2, background: "#FEE2E2", minWidth: 110 }}>
          <Typography sx={{ fontSize: 12, color: "#991B1B", fontWeight: 700 }}>Removed</Typography>
          <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
            {counts.removed.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {/* Failed refresh surfaces an Alert while polling continues (Requirement 13.7). */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} data-testid="refresh-error">
          {error}
        </Alert>
      )}

      {/* Moderation queue (Requirement 13.3). */}
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
              No posts awaiting review.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {moderationQueue.map((item) => {
                const url = mediaUrl(item.mediaReference);
                return (
                  <Box
                    key={item.postId}
                    data-testid={`moderation-item-${item.postId}`}
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
                          alt={item.text || "Post preview"}
                          data-testid={`moderation-photo-${item.postId}`}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <BrokenImageOutlinedIcon
                          sx={{ color: "#9CA3AF" }}
                          data-testid={`moderation-photo-${item.postId}`}
                        />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <Typography sx={{ fontSize: 14, color: "#1D1B20", fontWeight: 600 }}>
                        {item.text || "(no text)"}
                      </Typography>
                      {item.createdAt && (
                        <Typography
                          sx={{ fontSize: 12, color: "#9CA3AF" }}
                          data-testid={`moderation-time-${item.postId}`}
                        >
                          {new Date(item.createdAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<CheckCircleOutlineIcon />}
                        data-testid={`approve-${item.postId}`}
                        onClick={() => handleModerate(item.postId, "approve")}
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
                        startIcon={<DeleteOutlineIcon />}
                        data-testid={`remove-${item.postId}`}
                        onClick={() => handleModerate(item.postId, "remove")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          color: "#DC2626",
                          borderColor: "#FCA5A5",
                          "&:hover": { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
                        }}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Approved posts (Requirement 13.4). Each approved post exposes hide + remove
          controls. Zero approved posts → empty state (Requirement 13.8). */}
      <Card
        elevation={0}
        sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
        data-testid="approved-posts"
      >
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 2 }}>
            Approved Posts
          </Typography>

          {!hasApprovedPosts ? (
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }} data-testid="empty-state">
              No approved posts yet.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {feed.map((item) => {
                const url = mediaUrl(item.mediaReference);
                return (
                  <Box
                    key={item.postId}
                    data-testid={`approved-item-${item.postId}`}
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
                        width: 64,
                        height: 64,
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
                          alt={item.text || "Post photo"}
                          data-testid={`approved-photo-${item.postId}`}
                          sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <BrokenImageOutlinedIcon sx={{ color: "#9CA3AF" }} />
                      )}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 160 }}>
                      <Typography sx={{ fontSize: 14, color: "#1D1B20", fontWeight: 600 }}>
                        {item.text || "(no text)"}
                      </Typography>
                      <Typography
                        sx={{ fontSize: 12, color: "#9CA3AF" }}
                        data-testid={`approved-reactions-${item.postId}`}
                      >
                        {num(item.reactionCount).toLocaleString()} reactions
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<UndoOutlinedIcon />}
                        data-testid={`unapprove-${item.postId}`}
                        onClick={() => handleModerate(item.postId, "unapprove")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          color: "#92400E",
                          borderColor: "#FCD34D",
                          "&:hover": { borderColor: "#92400E", backgroundColor: "#FFFBEB" },
                        }}
                      >
                        Unapprove
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<VisibilityOffOutlinedIcon />}
                        data-testid={`hide-${item.postId}`}
                        onClick={() => handleModerate(item.postId, "hide")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          color: "#374151",
                          borderColor: "#D1D5DB",
                          "&:hover": { borderColor: "#374151", backgroundColor: "#F9FAFB" },
                        }}
                      >
                        Hide
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<DeleteOutlineIcon />}
                        data-testid={`approved-remove-${item.postId}`}
                        onClick={() => handleModerate(item.postId, "remove")}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          borderRadius: 2,
                          color: "#DC2626",
                          borderColor: "#FCA5A5",
                          "&:hover": { borderColor: "#DC2626", backgroundColor: "#FEF2F2" },
                        }}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SocialWallLiveDashboard;
