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
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const REFRESH_INTERVAL = 5000; // 5 seconds

/**
 * SentimentPanel — one proportional bar per Reaction_Option (count + percentage)
 * plus a summary row (average sentiment + unique reactors). Memoized so a
 * refresh that only changes the trend does not re-render the aggregate bars.
 */
const SentimentPanel = React.memo(({ aggregate }) => {
  const options = aggregate?.options || [];
  const totalReactions = aggregate?.totalReactions || 0;
  const zero = totalReactions === 0;

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}>
      <CardContent sx={{ p: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1D1B20", mb: 2 }}>
          Sentiment
        </Typography>

        {options.map((opt) => {
          const count = opt.count || 0;
          const pct = opt.percentage || 0;
          return (
            <Box key={opt.id} sx={{ mb: 1.25 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  {opt.label}
                </Typography>
                <Typography
                  sx={{ fontSize: 13, color: "#6B7280" }}
                  data-testid={`opt-stat-${opt.id}`}
                >
                  {count} · {pct}%
                </Typography>
              </Box>
              <Box sx={{ height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
                <Box
                  data-testid={`opt-bar-${opt.id}`}
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

        {/* Summary row */}
        <Box
          sx={{ display: "flex", gap: 4, mt: 2, pt: 2, borderTop: "1px solid #F3F4F6" }}
          data-testid="sentiment-summary"
        >
          <Box>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
              AVG SENTIMENT
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#1D1B20" }} data-testid="avg-sentiment">
              {aggregate?.averageSentiment ?? 0}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
              UNIQUE REACTORS
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#1D1B20" }} data-testid="unique-reactors">
              {aggregate?.uniqueReactors ?? 0}
            </Typography>
          </Box>
        </Box>

        {zero && (
          <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }} data-testid="aggregate-empty">
            No reactions yet
          </Typography>
        )}
      </CardContent>
    </Card>
  );
});

SentimentPanel.displayName = "SentimentPanel";

/**
 * TrendPanel — a dependency-free inline SVG sparkline of average sentiment per
 * 60s interval, ordered ascending by interval start. Each interval is rendered
 * as a bar (and a connecting polyline) with a data-testid so tests can assert
 * ordering and count. No charting library is added, matching the raffle/poll
 * bars.
 */
const TrendPanel = React.memo(({ trend }) => {
  const intervals = trend?.intervals || [];
  const empty = intervals.length === 0;

  // Scale the sentiment values to the chart height. Guard against a flat or
  // single-point series by giving it a small range.
  const values = intervals.map((i) => Number(i.averageSentiment) || 0);
  const maxV = values.length ? Math.max(...values) : 1;
  const minV = values.length ? Math.min(...values) : 0;
  const range = maxV - minV || 1;

  const WIDTH = 320;
  const HEIGHT = 80;
  const PAD = 8;
  const usableW = WIDTH - PAD * 2;
  const usableH = HEIGHT - PAD * 2;
  const step = intervals.length > 1 ? usableW / (intervals.length - 1) : 0;

  const points = intervals.map((iv, idx) => {
    const x = PAD + (intervals.length > 1 ? idx * step : usableW / 2);
    const avg = Number(iv.averageSentiment) || 0;
    const y = PAD + usableH - ((avg - minV) / range) * usableH;
    return { x, y: Number.isFinite(y) ? y : PAD + usableH };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}>
      <CardContent sx={{ p: 3 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1D1B20", mb: 2 }}>
          Sentiment Trend
        </Typography>

        {empty ? (
          <Typography
            sx={{ fontSize: 13, color: "#9CA3AF", py: 3, textAlign: "center" }}
            data-testid="trend-empty"
          >
            No trend data yet
          </Typography>
        ) : (
          <Box data-testid="trend-chart">
            <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Sentiment trend">
              <polyline
                points={polyline}
                fill="none"
                stroke={ACCENT}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, idx) => (
                <circle
                  key={intervals[idx].startTime || idx}
                  data-testid={`trend-point-${idx}`}
                  data-start={intervals[idx].startTime}
                  data-avg={intervals[idx].averageSentiment}
                  cx={p.x}
                  cy={p.y}
                  r="3"
                  fill={ACCENT}
                />
              ))}
            </svg>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
              <Typography sx={{ fontSize: 11, color: "#9CA3AF" }}>
                {intervals.length} interval{intervals.length === 1 ? "" : "s"}
              </Typography>
              <Typography sx={{ fontSize: 11, color: "#9CA3AF" }}>60s buckets</Typography>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
});

TrendPanel.displayName = "TrendPanel";

/**
 * PulseFeedbackLiveDashboard — organizer-facing live sentiment dashboard for a
 * Pulse Feedback instance. Mirrors LivePollLiveDashboard: a LIVE/CLOSED header
 * chip, a 5s ETag-optimized polling loop over getLiveStats, a sentiment panel
 * (aggregate bars + summary), and a trend panel (ascending time-series). Pulse
 * Feedback is always-on while Live, so there are no open/close controls.
 */
const PulseFeedbackLiveDashboard = () => {
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
          setError(err.response?.data?.message || "Failed to load sentiment data");
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
  // running so the next tick retries (Requirement 8.6).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStats]);

  const aggregate = stats?.aggregate || null;
  const trend = stats?.trend || null;
  const prompt = stats?.prompt || "";
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Pulse Feedback
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

      {prompt && (
        <Typography sx={{ color: "#374151", fontSize: 15, mb: 3 }} data-testid="pulse-prompt">
          {prompt}
        </Typography>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <SentimentPanel aggregate={aggregate} />
      <TrendPanel trend={trend} />
    </Box>
  );
};

export default PulseFeedbackLiveDashboard;
