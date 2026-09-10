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
  LinearProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { getLiveStats, setMarketState } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 10.3)

// Per-market state chip styling.
const STATE_CHIP = {
  open: { label: "OPEN", bg: "#E8F5E9", color: "#2E7D32" },
  locked: { label: "LOCKED", bg: "#FEF3C7", color: "#B45309" },
  resolved: { label: "RESOLVED", bg: "#DBEAFE", color: "#1D4ED8" },
};

// Normalize the leaderboard, which the plugin returns as { entries: [...] } but
// which we tolerate as a bare array too.
function leaderboardEntries(leaderboard) {
  if (!leaderboard) return [];
  if (Array.isArray(leaderboard)) return leaderboard;
  return Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
}

/**
 * MarketCard — one card per market: question, state chip, host controls
 * (lock / resolve), a close-deadline countdown while open, a
 * prediction-distribution section (a proportional bar per option with count +
 * percentage), and the actual-outcome highlight on resolution. Memoized so
 * refreshing one market's data does not re-render the others.
 */
const MarketCard = React.memo(
  ({ market, distribution, now, busy, resolveError, onLock, onResolve }) => {
    const state = market.marketState || "open";
    const chip = STATE_CHIP[state] || STATE_CHIP.open;
    const options = distribution?.options || market.options || [];
    const totalPredictions = distribution?.totalPredictions || 0;
    const zeroPredictions = totalPredictions === 0;
    const isResolved = state === "resolved";
    const actualOutcomeId = market.actualOutcomeId || distribution?.actualOutcomeId || null;

    // The selected actual outcome for the resolve selector. Defaults to the
    // first available option.
    const [selectedOutcome, setSelectedOutcome] = useState(options[0]?.id || "");

    // Controls (Requirement 10.4–10.6).
    const canLock = state === "open";
    const canResolve = state === "locked";

    // Countdown while open (Requirement 10.2): remaining = max(0, (closeDeadline - now)/1000).
    let remaining = null;
    let pctRemaining = 0;
    if (state === "open" && market.closeDeadline) {
      const deadlineMs = new Date(market.closeDeadline).getTime();
      if (!Number.isNaN(deadlineMs)) {
        remaining = Math.max(0, (deadlineMs - now) / 1000);
        // Bar shrinks over the final minute-ish window; clamp to [0, 100].
        const windowSec = 300; // 5-minute visual window
        pctRemaining = Math.max(0, Math.min(100, (remaining / windowSec) * 100));
      }
    }

    return (
      <Card
        elevation={0}
        data-testid={`market-card-${market.id}`}
        sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20", flex: 1 }}>
              {market.question || market.id}
            </Typography>
            <Chip
              label={chip.label}
              size="small"
              data-testid={`market-state-${market.id}`}
              sx={{ background: chip.bg, color: chip.color, fontWeight: 700, fontSize: 11, height: 22 }}
            />
          </Box>

          {/* Countdown while open (Requirement 10.2). */}
          {state === "open" && remaining !== null && (
            <Box sx={{ mb: 2 }} data-testid={`countdown-${market.id}`}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                  Predictions close in
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                  {Math.ceil(remaining)}s
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pctRemaining}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  background: "#F3F4F6",
                  "& .MuiLinearProgress-bar": { background: ACCENT, transition: "width 1s linear" },
                }}
              />
            </Box>
          )}

          {/* Host controls (Requirement 10.4–10.6). */}
          <Box sx={{ display: "flex", gap: 1, mb: 1.5, flexWrap: "wrap", alignItems: "center" }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockOutlinedIcon />}
              disabled={!canLock || busy}
              onClick={onLock}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "#B45309", color: "#B45309" }}
            >
              Lock
            </Button>

            {/* Resolve selector: pick the actual outcome, then resolve. Enabled
                only while locked (Requirement 10.6). */}
            <FormControl size="small" sx={{ minWidth: 160 }} disabled={!canResolve || busy}>
              <InputLabel id={`resolve-outcome-${market.id}`}>Actual Outcome</InputLabel>
              <Select
                labelId={`resolve-outcome-${market.id}`}
                label="Actual Outcome"
                value={selectedOutcome || ""}
                onChange={(e) => setSelectedOutcome(e.target.value)}
                inputProps={{ "aria-label": `Actual outcome for market ${market.id}` }}
              >
                {(market.options || options).map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              size="small"
              variant="contained"
              startIcon={<CheckCircleOutlineIcon />}
              disabled={!canResolve || busy}
              onClick={() => onResolve(selectedOutcome)}
              sx={{ textTransform: "none", fontWeight: 600, background: "#1D4ED8", "&:hover": { background: "#1E40AF" } }}
            >
              Resolve
            </Button>
          </Box>

          {resolveError && (
            <Typography
              variant="caption"
              color="error"
              data-testid={`resolve-error-${market.id}`}
              sx={{ display: "block", mb: 1.5 }}
            >
              {resolveError}
            </Typography>
          )}

          {/* Prediction distribution (Requirement 10.7, 10.10). */}
          <Box>
            {options.map((opt) => {
              const count = opt.count || 0;
              const pct = opt.percentage || 0;
              const isActual = isResolved && opt.id === actualOutcomeId;
              return (
                <Box key={opt.id} sx={{ mb: 1.25 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: isActual ? 800 : 600,
                        color: isActual ? "#15803D" : "#374151",
                      }}
                    >
                      {opt.label}
                      {isActual ? " ✓" : ""}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "#6B7280" }}
                      data-testid={`opt-stat-${market.id}-${opt.id}`}
                    >
                      {count} · {pct}%
                    </Typography>
                  </Box>
                  <Box sx={{ height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
                    <Box
                      data-testid={`opt-bar-${market.id}-${opt.id}`}
                      sx={{
                        height: "100%",
                        width: `${pct}%`,
                        background: isActual ? "#15803D" : ACCENT,
                        borderRadius: 4,
                        transition: "width 0.7s cubic-bezier(.2,.9,.25,1)",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}

            <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}>
              {zeroPredictions
                ? "No predictions yet"
                : `${totalPredictions} total prediction${totalPredictions === 1 ? "" : "s"}`}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
);

MarketCard.displayName = "MarketCard";

/**
 * PredictionLiveDashboard — organizer-facing live and resolution dashboard for
 * a Prediction Challenges instance. Mirrors TriviaLiveDashboard/
 * RaffleLiveDashboard: a LIVE/CLOSED header chip, a 2s ETag-optimized polling
 * loop over getLiveStats, one memoized card per market, lock/resolve controls
 * that optimistically reflect the returned market state, a prediction
 * distribution section, and the cumulative leaderboard. On resolve the
 * organizer declares the actual outcome via a per-market selector.
 */
const PredictionLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyMarketId, setBusyMarketId] = useState(null);
  const [resolveErrors, setResolveErrors] = useState({});
  // A ticking clock so the countdown bar re-renders each second.
  const [now, setNow] = useState(Date.now());
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
          setError(err.response?.data?.message || "Failed to load prediction results");
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

  // Set up a single 2s interval on mount (Requirement 10.3). A failed refresh
  // sets the error while the interval keeps running so the next tick retries
  // (Requirement 10.9).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
      setNow(Date.now());
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchStats]);

  // Optimistically apply a returned market state into the local markets array.
  const applyMarketState = (marketId, returnedMarket, fallbackState) => {
    setStats((prev) => {
      if (!prev) return prev;
      const nextMarkets = (prev.markets || []).map((m) =>
        m.id === marketId
          ? {
              ...m,
              marketState: returnedMarket?.marketState || fallbackState,
              lockedAt:
                returnedMarket?.lockedAt !== undefined ? returnedMarket.lockedAt : m.lockedAt,
              resolvedAt:
                returnedMarket?.resolvedAt !== undefined ? returnedMarket.resolvedAt : m.resolvedAt,
              actualOutcomeId:
                returnedMarket?.actualOutcomeId !== undefined
                  ? returnedMarket.actualOutcomeId
                  : m.actualOutcomeId,
            }
          : m
      );
      return { ...prev, markets: nextMarkets };
    });
  };

  const runLock = useCallback(
    async (marketId) => {
      setBusyMarketId(marketId);
      setResolveErrors((prev) => ({ ...prev, [marketId]: null }));
      try {
        const res = await setMarketState(eventId, experienceId, {
          action: "lock_market",
          marketId,
        });
        const returned = res?.data?.data || res?.data;
        applyMarketState(marketId, returned?.market, "locked");
        setNow(Date.now());
        // Clear the ETag so the next refresh reflects the change server-side.
        etagRef.current = null;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to lock market");
      } finally {
        setBusyMarketId(null);
      }
    },
    [eventId, experienceId]
  );

  const runResolve = useCallback(
    async (marketId, outcomeId, marketState) => {
      // Guard: resolve is only valid on a locked market. Surface a
      // must-be-locked message rather than calling the server (Requirement 10.6).
      if (marketState !== "locked") {
        setResolveErrors((prev) => ({
          ...prev,
          [marketId]: "This market must be locked before it can be resolved.",
        }));
        return;
      }
      if (!outcomeId) {
        setResolveErrors((prev) => ({
          ...prev,
          [marketId]: "Select the actual outcome before resolving.",
        }));
        return;
      }
      setBusyMarketId(marketId);
      setResolveErrors((prev) => ({ ...prev, [marketId]: null }));
      try {
        const res = await setMarketState(eventId, experienceId, {
          action: "resolve_market",
          marketId,
          outcomeId,
        });
        const returned = res?.data?.data || res?.data;
        applyMarketState(
          marketId,
          returned?.market || { marketState: "resolved", actualOutcomeId: outcomeId },
          "resolved"
        );
        setNow(Date.now());
        etagRef.current = null;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to resolve market");
      } finally {
        setBusyMarketId(null);
      }
    },
    [eventId, experienceId]
  );

  const markets = stats?.markets || [];
  const distributions = stats?.distributions || [];
  const distByMarket = new Map(distributions.map((d) => [d.marketId, d]));
  const entries = leaderboardEntries(stats?.leaderboard);
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";

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
          Prediction Challenges
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

      {markets.length === 0 ? (
        <Typography sx={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", py: 6 }}>
          No markets configured yet.
        </Typography>
      ) : (
        markets.map((market) => (
          <MarketCard
            key={market.id}
            market={market}
            distribution={distByMarket.get(market.id)}
            now={now}
            busy={busyMarketId === market.id}
            resolveError={resolveErrors[market.id]}
            onLock={() => runLock(market.id)}
            onResolve={(outcomeId) => runResolve(market.id, outcomeId, market.marketState)}
          />
        ))
      )}

      {/* Leaderboard (Requirement 10.8) — rows ordered by ascending rank. */}
      {entries.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mt: 1 }} data-testid="leaderboard">
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <EmojiEventsOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                Leaderboard
              </Typography>
            </Box>
            {[...entries]
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
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>
                    {entry.totalScore} pts
                  </Typography>
                </Box>
              ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default PredictionLiveDashboard;
