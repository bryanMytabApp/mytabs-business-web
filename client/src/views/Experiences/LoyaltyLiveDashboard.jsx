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
import LoyaltyOutlinedIcon from "@mui/icons-material/LoyaltyOutlined";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 11.2)

// The plugin returns per-reward analytics as { rewards: [{ rewardId,
// rewardLabel, redemptionCount, remainingInventory }] }. Tolerate a bare array
// too so the component is robust to either shape.
function rewardMetrics(stats) {
  if (!stats) return [];
  if (Array.isArray(stats.rewards)) return stats.rewards;
  if (Array.isArray(stats)) return stats;
  return [];
}

// Normalize the tier distribution into a list of { tierId, tierName, memberCount }.
// The canonical /live-stats shape is an array of { tierId, tierName, memberCount }
// with a { tierId: null, tierName: "No tier" } entry for the no-tier group
// (Requirement 11.5). Also tolerate an object keyed by tierId with a `none`
// bucket (falling back to the tierId as the label since names aren't present in
// that shape). Returns an empty array when no Membership_Tiers are configured.
function tierMetrics(stats) {
  const dist = stats?.tierDistribution;
  if (!dist) return [];
  if (Array.isArray(dist)) {
    return dist.map((t) => ({
      tierId: t.tierId ?? null,
      tierName: t.tierName || (t.tierId == null ? "No tier" : String(t.tierId)),
      memberCount: Number(t.memberCount) || 0,
    }));
  }
  if (typeof dist === "object") {
    return Object.keys(dist).map((key) => ({
      tierId: key === "none" ? null : key,
      tierName: key === "none" ? "No tier" : key,
      memberCount: Number(dist[key]) || 0,
    }));
  }
  return [];
}

// Render a remaining-inventory value: a finite reward shows its number, an
// unlimited reward shows "Unlimited".
function renderRemaining(remaining) {
  if (remaining === "unlimited" || remaining === null || remaining === undefined) {
    return "Unlimited";
  }
  return Number(remaining).toLocaleString();
}

/**
 * LoyaltyLiveDashboard — organizer-facing live dashboard for a Loyalty & Rewards
 * instance. Mirrors CouponLiveDashboard/RaffleLiveDashboard: a LIVE/CLOSED header
 * chip with instance totals (total points issued, total points redeemed, active
 * members), a 2s ETag-optimized polling loop over getLiveStats while Live, a
 * tier-distribution panel (per configured Membership_Tier + the no-tier group)
 * when tiers are configured, and one card per reward showing its rewardLabel, the
 * count of Redemption_Records, and the Remaining_Inventory (or "Unlimited").
 * While Closed the dashboard shows final metrics + a "Closed" indicator and stops
 * polling (Requirement 11.6). A failed refresh surfaces an Alert while the
 * interval keeps running to retry next tick (Requirement 11.7). When the instance
 * has zero recorded Accruals it shows an empty-state indicator (Requirement 11.8).
 */
const LoyaltyLiveDashboard = () => {
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
          setError(err.response?.data?.message || "Failed to load loyalty results");
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

  // Set up the 2s polling interval while Live (Requirement 11.2). While Closed
  // the dashboard shows final metrics and stops polling (Requirement 11.6). A
  // failed refresh sets the error while the interval keeps running so the next
  // tick retries (Requirement 11.7).
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

  const rewards = rewardMetrics(stats);
  const tiers = tierMetrics(stats);
  const totalPointsIssued = Number(stats?.totalPointsIssued) || 0;
  const totalPointsRedeemed = Number(stats?.totalPointsRedeemed) || 0;
  const activeMembers = Number(stats?.activeMembers) || 0;
  // Zero recorded Accruals → empty state (Requirement 11.8). Accruals are what
  // issue points and make an attendee an active member, so an instance with no
  // points issued and no active members has no recorded Accruals.
  const hasActivity = totalPointsIssued > 0 || activeMembers > 0;

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
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <LoyaltyOutlinedIcon sx={{ color: ACCENT, fontSize: 26 }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Loyalty &amp; Rewards
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          sx={{
            background: isClosed ? "#FEE2E2" : "#EDE9FE",
            color: isClosed ? "#DC2626" : "#6D28D9",
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
      </Box>

      {/* Instance totals (Requirement 11.3). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box
          data-testid="total-points-issued"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#EDE9FE", minWidth: 160 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Points Issued</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalPointsIssued.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="total-points-redeemed"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 160 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Points Redeemed</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {totalPointsRedeemed.toLocaleString()}
          </Typography>
        </Box>
        <Box
          data-testid="active-members"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 160 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Active Members</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>
            {activeMembers.toLocaleString()}
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty state (Requirement 11.8). */}
      {!hasActivity && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="empty-state">
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>
              No loyalty activity yet.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Tier-distribution panel (Requirement 11.5) — only when Membership_Tiers
          are configured (the /live-stats response includes tierDistribution). */}
      {tiers.length > 0 && (
        <Card
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
          data-testid="tier-distribution"
        >
          <CardContent sx={{ p: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 2 }}>
              Tier Distribution
            </Typography>
            <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {tiers.map((tier, idx) => (
                <Box
                  key={tier.tierId ?? `no-tier-${idx}`}
                  data-testid={`tier-${tier.tierId ?? "none"}`}
                >
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                    {tier.tierName}
                  </Typography>
                  <Typography sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}>
                    {tier.memberCount.toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Per-reward metrics (Requirement 11.4). */}
      {rewards.map((reward, idx) => {
        const redemptionCount = Number(reward.redemptionCount) || 0;
        return (
          <Card
            key={reward.rewardId || idx}
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
            data-testid={`reward-card-${reward.rewardId || idx}`}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                <CardGiftcardOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                    {reward.rewardLabel || `Reward ${idx + 1}`}
                  </Typography>
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Redeemed</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`reward-redeemed-${reward.rewardId || idx}`}
                  >
                    {redemptionCount.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Remaining</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`reward-remaining-${reward.rewardId || idx}`}
                  >
                    {renderRemaining(reward.remainingInventory)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default LoyaltyLiveDashboard;
