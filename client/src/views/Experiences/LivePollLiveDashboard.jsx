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
  Modal,
  IconButton,
  Divider,
} from "@mui/material";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CloseIcon from "@mui/icons-material/Close";
import dayjs from "dayjs";
import {
  getLiveStats,
  setPollState,
  getInstance,
  exportAnalytics,
} from "../../services/experienceService";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const POLL_INTERVAL = 5000; // 5 seconds

// Per-poll state chip styling.
const STATE_CHIP = {
  draft: { label: "DRAFT", bg: "#F3F4F6", color: "#6B7280" },
  open: { label: "OPEN", bg: "#E8F5E9", color: "#2E7D32" },
  closed: { label: "CLOSED", bg: "#FEE2E2", color: "#DC2626" },
};

/** Format a schedule ISO timestamp for compact display; "—" when unset. */
const fmtSchedule = (iso) => (iso ? dayjs(iso).format("MMM D, h:mm A") : "—");

/**
 * PollResultsCard — one card per poll: question, state chip, open/close
 * controls, and an animated results section (one proportional bar per option
 * with count + percentage). Memoized so refreshing one poll's aggregate does
 * not re-render the others.
 */
const PollResultsCard = React.memo(({ aggregate, onOpen, onClose, busy }) => {
  const state = aggregate.state || "draft";
  const chip = STATE_CHIP[state] || STATE_CHIP.draft;
  const options = aggregate.options || [];
  const totalVotes = aggregate.totalVotes || 0;
  const zeroVotes = totalVotes === 0;

  // Open is available from draft or closed; close only from open.
  const canOpen = state === "draft" || state === "closed";
  const canClose = state === "open";

  return (
    <Card
      elevation={0}
      data-testid={`poll-card-${aggregate.pollId}`}
      sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20", flex: 1 }}>
            {aggregate.question || aggregate.pollId}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", flexShrink: 0 }}>
            {aggregate.scheduled && (
              <Chip
                icon={<ScheduleOutlinedIcon sx={{ fontSize: 14 }} />}
                label="SCHEDULED"
                size="small"
                data-testid={`poll-scheduled-${aggregate.pollId}`}
                sx={{ background: "#EFF6FF", color: ACCENT, fontWeight: 700, fontSize: 10, height: 22 }}
              />
            )}
            <Chip
              label={chip.label}
              size="small"
              data-testid={`poll-state-${aggregate.pollId}`}
              sx={{ background: chip.bg, color: chip.color, fontWeight: 700, fontSize: 11, height: 22 }}
            />
          </Box>
        </Box>

        {aggregate.scheduled && (
          <Typography
            data-testid={`poll-schedule-${aggregate.pollId}`}
            sx={{ fontSize: 12, color: "#6B7280", mb: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}
          >
            <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />
            {`Opens ${fmtSchedule(aggregate.scheduledOpenAt)} · Closes ${fmtSchedule(aggregate.scheduledCloseAt)}`}
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant="contained"
            startIcon={<PlayArrowOutlinedIcon />}
            disabled={!canOpen || busy}
            onClick={onOpen}
            sx={{ textTransform: "none", fontWeight: 600, background: ACCENT, "&:hover": { background: "#2563EB" } }}
          >
            Open Poll
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<StopOutlinedIcon />}
            disabled={!canClose || busy}
            onClick={onClose}
            sx={{ textTransform: "none", fontWeight: 600, borderColor: "#DC2626", color: "#DC2626" }}
          >
            Close Poll
          </Button>
        </Box>

        {/* Results */}
        <Box>
          {options.map((opt) => {
            const count = opt.count || 0;
            const pct = opt.percentage || 0;
            return (
              <Box key={opt.id} sx={{ mb: 1.25 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                    {opt.label}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#6B7280" }} data-testid={`opt-stat-${aggregate.pollId}-${opt.id}`}>
                    {count} · {pct}%
                  </Typography>
                </Box>
                <Box sx={{ height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
                  <Box
                    data-testid={`opt-bar-${aggregate.pollId}-${opt.id}`}
                    sx={{
                      height: "100%",
                      width: `${pct}%`,
                      background: ACCENT,
                      borderRadius: 4,
                      transition: "width 0.7s cubic-bezier(.2,.9,.25,1)",
                    }}
                  />
                </Box>
              </Box>
            );
          })}

          <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}>
            {zeroVotes ? "No votes yet" : `${totalVotes} total vote${totalVotes === 1 ? "" : "s"}`}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
});

PollResultsCard.displayName = "PollResultsCard";

/**
 * LivePollLiveDashboard — organizer-facing live results dashboard for a Live
 * Polls instance. Mirrors RaffleLiveDashboard: a LIVE/CLOSED header chip, a 5s
 * ETag-optimized polling loop over getLiveStats, one memoized card per poll,
 * and open/close controls that optimistically reflect the returned poll state.
 */
const LivePollLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyPollId, setBusyPollId] = useState(null);
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
          setError(err.response?.data?.message || "Failed to load poll results");
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

  // Poll every 5s. A failed refresh sets the error but the interval keeps
  // running so the next tick retries (Requirement 7.7).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStats]);

  // Optimistically apply a returned poll state into the local results array.
  const applyPollState = (pollId, newState) => {
    setStats((prev) => {
      if (!prev) return prev;
      const results = (prev.results || []).map((r) =>
        r.pollId === pollId ? { ...r, state: newState } : r
      );
      return { ...prev, results };
    });
  };

  const runPollAction = useCallback(
    async (pollId, action) => {
      setBusyPollId(pollId);
      try {
        const res = await setPollState(eventId, experienceId, { action, pollId });
        const returned = res?.data?.data || res?.data;
        const newState = returned?.state || (action === "open_poll" ? "open" : "closed");
        applyPollState(pollId, newState);
        // Clear the ETag so the next refresh reflects the change server-side.
        etagRef.current = null;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to update poll");
      } finally {
        setBusyPollId(null);
      }
    },
    [eventId, experienceId]
  );

  // View Config modal (read-only) — mirrors RaffleLiveDashboard's config view.
  const [showViewConfig, setShowViewConfig] = useState(false);
  const [viewConfigData, setViewConfigData] = useState(null);
  const [viewConfigLoading, setViewConfigLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const openViewConfig = useCallback(async () => {
    setViewConfigLoading(true);
    setShowViewConfig(true);
    try {
      const res = await getInstance(eventId, experienceId);
      setViewConfigData(res.data?.data || res.data);
    } catch (err) {
      setViewConfigData({ error: err.response?.data?.message || err.message || "Failed to load configuration" });
    } finally {
      setViewConfigLoading(false);
    }
  }, [eventId, experienceId]);

  // Export poll analytics as a downloadable file (CSV by default).
  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await exportAnalytics(eventId, experienceId, { format: "csv" });
      const blob = new Blob([res.data], { type: res.headers?.["content-type"] || "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `poll-results-${experienceId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to export results");
    } finally {
      setExporting(false);
    }
  }, [eventId, experienceId]);

  const results = stats?.results || [];
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";
  const totalVotes = stats?.totalVotes || 0;
  const uniqueVoters = stats?.uniqueVoters || 0;

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Live Polls
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
        <Box sx={{ flex: 1 }} />
        {/* Reporting actions — mirror RaffleLiveDashboard's config/report toolbar. */}
        <Button
          size="small"
          variant="outlined"
          startIcon={<SettingsOutlinedIcon />}
          onClick={openViewConfig}
          sx={{ textTransform: "none", fontWeight: 600, borderColor: "#D1D5DB", color: "#374151" }}
        >
          View Config
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadOutlinedIcon />}
          onClick={handleExport}
          disabled={exporting || results.length === 0}
          sx={{ textTransform: "none", fontWeight: 600, borderColor: "#D1D5DB", color: "#374151" }}
        >
          {exporting ? "Exporting…" : "Export"}
        </Button>
        <IconButton size="small" aria-label="Refresh results" onClick={() => fetchStats(true)}>
          <RefreshOutlinedIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Summary metrics */}
      <Box sx={{ display: "flex", gap: 3, mb: 3, flexWrap: "wrap" }}>
        <Box>
          <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.5 }}>
            TOTAL VOTES
          </Typography>
          <Typography data-testid="poll-total-votes" sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalVotes}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.5 }}>
            UNIQUE VOTERS
          </Typography>
          <Typography data-testid="poll-unique-voters" sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {uniqueVoters}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, letterSpacing: 0.5 }}>
            POLLS
          </Typography>
          <Typography data-testid="poll-count" sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {results.length}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {results.length === 0 ? (
        <Typography sx={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", py: 6 }}>
          No polls configured yet.
        </Typography>
      ) : (
        results.map((aggregate) => (
          <PollResultsCard
            key={aggregate.pollId}
            aggregate={aggregate}
            busy={busyPollId === aggregate.pollId}
            onOpen={() => runPollAction(aggregate.pollId, "open_poll")}
            onClose={() => runPollAction(aggregate.pollId, "close_poll")}
          />
        ))
      )}

      {/* View Config Modal (read-only) — mirrors RaffleLiveDashboard. */}
      <Modal
        open={showViewConfig}
        onClose={() => setShowViewConfig(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          data-testid="poll-config-modal"
          sx={{ background: "#fff", borderRadius: 3, p: 3, maxWidth: 560, width: "92%", boxShadow: 24, maxHeight: "85vh", overflow: "auto" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
              Live Polls Configuration
            </Typography>
            <IconButton size="small" aria-label="Close configuration" onClick={() => setShowViewConfig(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {viewConfigLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} sx={{ color: ACCENT }} />
            </Box>
          ) : viewConfigData?.error ? (
            <Alert severity="error">{viewConfigData.error}</Alert>
          ) : viewConfigData ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <ConfigRow label="Name" value={viewConfigData.name || "—"} />
              <ConfigRow label="State" value={viewConfigData.state || "—"} />
              <Divider />
              {(viewConfigData.config?.polls || []).map((p, idx) => (
                <Box key={p.id || idx} sx={{ background: "#F8F9FA", borderRadius: 2, p: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>
                    {p.question || `Poll ${idx + 1}`}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                    {p.selectionMode === "multiple"
                      ? `Multiple choice · up to ${p.maxSelections} selections`
                      : "Single choice"}
                    {" · "}
                    {p.scheduledOpenAt || p.scheduledCloseAt
                      ? `Auto: ${fmtSchedule(p.scheduledOpenAt)} → ${fmtSchedule(p.scheduledCloseAt)}`
                      : "Manual open/close"}
                  </Typography>
                  {(p.options || []).map((o, oi) => (
                    <Typography key={o.id || oi} sx={{ fontSize: 13, color: "#374151", mt: 0.25 }}>
                      • {o.label || `Option ${oi + 1}`}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      </Modal>
    </Box>
  );
};

/** Small label/value row used inside the View Config modal. */
const ConfigRow = ({ label, value }) => (
  <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
    <Typography sx={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>{label}</Typography>
    <Typography sx={{ fontSize: 13, color: "#1D1B20", textAlign: "right" }}>{value}</Typography>
  </Box>
);

export default LivePollLiveDashboard;
