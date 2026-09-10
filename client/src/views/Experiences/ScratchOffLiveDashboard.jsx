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

const ACCENT = "#F47A20"; // Contests & Giveaways brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 11.2)

/**
 * StatTile — one instance-level total in the header summary row.
 */
const StatTile = React.memo(({ label, value, testId }) => (
  <Box
    sx={{
      flex: "1 1 120px",
      minWidth: 120,
      p: 2,
      borderRadius: 3,
      border: "1px solid #E8E8E8",
      background: "#fff",
    }}
  >
    <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>
      {label}
    </Typography>
    <Typography sx={{ fontSize: 24, fontWeight: 800, color: "#1D1B20" }} data-testid={testId}>
      {value}
    </Typography>
  </Box>
));

StatTile.displayName = "StatTile";

/**
 * TierCard — one card per prize tier showing the label, the awards count, and
 * the remaining inventory, plus a "Sold out" chip when the tier is depleted
 * (Requirements 11.3, 11.5).
 */
const TierCard = React.memo(({ tier }) => {
  const remaining = tier.remainingInventory ?? 0;
  const soldOut = tier.soldOut || remaining === 0;

  return (
    <Card
      elevation={0}
      data-testid={`tier-card-${tier.tierId}`}
      sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1D1B20" }} data-testid={`tier-label-${tier.tierId}`}>
            {tier.prizeLabel || tier.tierId}
          </Typography>
          {soldOut && (
            <Chip
              label="Sold out"
              size="small"
              data-testid={`tier-soldout-${tier.tierId}`}
              sx={{ background: "#FEE2E2", color: "#DC2626", fontWeight: 700, fontSize: 11, height: 22 }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", gap: 3 }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>
              Awards
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: ACCENT }} data-testid={`tier-awards-${tier.tierId}`}>
              {tier.awardsCount ?? 0}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>
              Remaining
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#1D1B20" }} data-testid={`tier-remaining-${tier.tierId}`}>
              {remaining}
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase" }}>
              Quantity
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#6B7280" }}>
              {tier.prizeQuantity ?? 0}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

TierCard.displayName = "TierCard";

/**
 * ScratchOffLiveDashboard — organizer-facing live dashboard for a Digital
 * Scratch-Offs instance. Mirrors RaffleLiveDashboard/SurveyResultsDashboard: a
 * header with a LIVE/CLOSED chip and instance totals (cards issued, cards
 * revealed, wins, no-wins), a 2s ETag-optimized polling loop over getLiveStats
 * while Live, and one card per prize tier with a sold-out indicator.
 */
const ScratchOffLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [state, setState] = useState(null);
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
        const data = res.data?.data || res.data;
        setStats(data?.analytics || null);
        setState(data?.state || null);
        setError(null);
      } catch (err) {
        if (err.response?.status !== 304) {
          setError(err.response?.data?.message || "Failed to load scratch-off metrics");
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

  // Poll every 2s while Live. Once Closed the interval is torn down so polling
  // stops (Requirement 11.6). A failed refresh sets the error but the interval
  // keeps running so the next tick retries (Requirement 11.7).
  const isClosed = state === "Closed" || state === "Analytics";
  useEffect(() => {
    if (isClosed) return undefined;
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStats, isClosed]);

  const tiers = stats?.tiers || [];
  const totalCardsIssued = stats?.totalCardsIssued || 0;
  const totalCardsRevealed = stats?.totalCardsRevealed || 0;
  const totalWins = stats?.totalWins || 0;
  const totalNoWins = stats?.totalNoWins || 0;

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }} data-testid="scratchoff-title">
          Digital Scratch-Offs
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          data-testid="availability-chip"
          sx={{
            background: isClosed ? "#FEE2E2" : "#E8F5E9",
            color: isClosed ? "#DC2626" : "#2E7D32",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
      </Box>

      {isClosed && (
        <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }} data-testid="closed-indicator">
          This scratch-off is closed. Showing final metrics.
        </Typography>
      )}

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Instance totals (Requirement 11.4). */}
      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 3 }}>
        <StatTile label="Cards Issued" value={totalCardsIssued} testId="total-cards-issued" />
        <StatTile label="Cards Revealed" value={totalCardsRevealed} testId="total-cards-revealed" />
        <StatTile label="Wins" value={totalWins} testId="total-wins" />
        <StatTile label="No-Wins" value={totalNoWins} testId="total-no-wins" />
      </Box>

      {/* Empty state when no cards have been issued (Requirement 11.8). */}
      {totalCardsIssued === 0 ? (
        <Box
          data-testid="empty-state"
          sx={{ textAlign: "center", py: 6, color: "#9CA3AF" }}
        >
          <Typography sx={{ fontSize: 14 }}>
            No cards issued yet. Metrics will appear as attendees receive scratch cards.
          </Typography>
        </Box>
      ) : tiers.length === 0 ? (
        <Typography sx={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", py: 6 }}>
          No prize tiers configured yet.
        </Typography>
      ) : (
        tiers.map((tier) => <TierCard key={tier.tierId} tier={tier} />)
      )}
    </Box>
  );
};

export default ScratchOffLiveDashboard;
