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
  LinearProgress,
  Avatar,
} from "@mui/material";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 11.2)

// The plugin returns per-promotion analytics as { promotions: [{ promotionId,
// sponsorId, headline, impressions, engagements, clickThroughRate,
// impressionGoalAttainment?, engagementGoalAttainment? }] }. Tolerate a bare
// array too so the component is robust to either shape.
function promotionMetrics(stats) {
  if (!stats) return [];
  if (Array.isArray(stats.promotions)) return stats.promotions;
  if (Array.isArray(stats)) return stats;
  return [];
}

// The per-sponsor ROI section (Requirement 11.4). Each entry aggregates a
// sponsor's promotions: { sponsorId, sponsorName, impressions, engagements,
// clickThroughRate }.
function sponsorRoiMetrics(stats) {
  if (!stats) return [];
  if (Array.isArray(stats.sponsorRoi)) return stats.sponsorRoi;
  return [];
}

// Format a click-through-rate (a 0..1 ratio) as a one-decimal percentage.
function formatCtr(rate) {
  const r = Number(rate) || 0;
  return `${(r * 100).toFixed(1)}%`;
}

// A promotion carries a sponsorId but not the sponsor display name; resolve the
// name from the matching sponsorRoi entry (which carries sponsorName), falling
// back to the sponsorId itself.
function resolveSponsorName(sponsorId, roi) {
  const match = roi.find((r) => r.sponsorId === sponsorId);
  return (match && match.sponsorName) || sponsorId || "Sponsor";
}

// Clamp a goal-attainment ratio (0..1+) to a 0..100 percentage for the bar,
// while the caller still shows the raw ratio as text.
function clampPercent(ratio) {
  const r = Number(ratio) || 0;
  const pct = r * 100;
  if (pct < 0) return 0;
  if (pct > 100) return 100;
  return pct;
}

/**
 * SponsorPromotionLiveDashboard — organizer-facing live ROI dashboard for a
 * Sponsor Promotions instance. Mirrors CouponLiveDashboard/RaffleLiveDashboard:
 * a LIVE/CLOSED header chip with instance totals (total impressions, total
 * engagements), a 2s ETag-optimized polling loop over getLiveStats while Live,
 * one card per promotion showing its headline, linked sponsor, impressions,
 * engagements, click-through-rate, and goal-progress bars where a goal is set
 * (Requirements 11.1, 11.3, 11.5), and a per-sponsor ROI section grouping the
 * sponsorRoi metrics by sponsor (Requirement 11.4). While Closed the dashboard
 * shows final metrics + a "Closed" indicator and stops polling (Requirement
 * 11.6). A failed refresh surfaces an Alert while the interval keeps running to
 * retry next tick (Requirement 11.7). Zero impressions renders an empty-state
 * indicator (Requirement 11.8).
 */
const SponsorPromotionLiveDashboard = () => {
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
          setError(err.response?.data?.message || "Failed to load promotion results");
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

  const promotions = promotionMetrics(stats);
  const sponsorRoi = sponsorRoiMetrics(stats);
  const totalImpressions = Number(stats?.totalImpressions) || 0;
  const totalEngagements = Number(stats?.totalEngagements) || 0;
  const hasImpressions = totalImpressions > 0;

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
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Sponsor Promotions
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

      {/* Instance totals. */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box
          data-testid="total-impressions"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#EDE9FE", minWidth: 140 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Total Impressions</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>{totalImpressions}</Typography>
        </Box>
        <Box
          data-testid="total-engagements"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 140 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Total Engagements</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>{totalEngagements}</Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty state (Requirement 11.8). */}
      {!hasImpressions && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="empty-state">
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>
              No promotion impressions yet.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Per-promotion metrics (Requirements 11.1, 11.3, 11.5). */}
      {promotions.map((promo, idx) => {
        const key = promo.promotionId || idx;
        const impressions = Number(promo.impressions) || 0;
        const engagements = Number(promo.engagements) || 0;
        const sponsorName = resolveSponsorName(promo.sponsorId, sponsorRoi);
        const hasImpressionGoal =
          promo.impressionGoalAttainment !== undefined && promo.impressionGoalAttainment !== null;
        const hasEngagementGoal =
          promo.engagementGoalAttainment !== undefined && promo.engagementGoalAttainment !== null;
        return (
          <Card
            key={key}
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
            data-testid={`promotion-card-${key}`}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                <CampaignOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                    {promo.headline || `Promotion ${idx + 1}`}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {promo.sponsorLogoUrl && (
                      <Avatar
                        src={promo.sponsorLogoUrl}
                        alt={sponsorName}
                        sx={{ width: 18, height: 18 }}
                        data-testid={`promotion-sponsor-logo-${key}`}
                      />
                    )}
                    <Typography
                      sx={{ fontSize: 13, color: "#6B7280" }}
                      data-testid={`promotion-sponsor-${key}`}
                    >
                      {sponsorName}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Impressions</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`promotion-impressions-${key}`}
                  >
                    {impressions}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Engagements</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`promotion-engagements-${key}`}
                  >
                    {engagements}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Click-Through Rate</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: ACCENT }}
                    data-testid={`promotion-ctr-${key}`}
                  >
                    {formatCtr(promo.clickThroughRate)}
                  </Typography>
                </Box>
              </Box>

              {/* Goal progress bars, shown only when a goal is set (Req 11.5). */}
              {hasImpressionGoal && (
                <Box sx={{ mt: 2 }} data-testid={`promotion-impression-goal-${key}`}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                      Impression Goal
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                      {formatCtr(promo.impressionGoalAttainment)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={clampPercent(promo.impressionGoalAttainment)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#EDE9FE",
                      "& .MuiLinearProgress-bar": { backgroundColor: ACCENT },
                    }}
                  />
                </Box>
              )}
              {hasEngagementGoal && (
                <Box sx={{ mt: 2 }} data-testid={`promotion-engagement-goal-${key}`}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                      Engagement Goal
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>
                      {formatCtr(promo.engagementGoalAttainment)}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={clampPercent(promo.engagementGoalAttainment)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: "#EDE9FE",
                      "& .MuiLinearProgress-bar": { backgroundColor: ACCENT },
                    }}
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Per-sponsor ROI section grouping sponsorRoi by sponsor (Req 11.4). */}
      {sponsorRoi.length > 0 && (
        <Box sx={{ mt: 4 }} data-testid="sponsor-roi-section">
          <Typography sx={{ fontWeight: 800, fontSize: 18, color: "#1D1B20", mb: 1.5 }}>
            Per-Sponsor ROI
          </Typography>
          {sponsorRoi.map((roi, idx) => {
            const key = roi.sponsorId || idx;
            const impressions = Number(roi.impressions) || 0;
            const engagements = Number(roi.engagements) || 0;
            return (
              <Card
                key={key}
                elevation={0}
                sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
                data-testid={`sponsor-roi-card-${key}`}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography
                    sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20", mb: 1.5 }}
                    data-testid={`sponsor-roi-name-${key}`}
                  >
                    {roi.sponsorName || roi.sponsorId || `Sponsor ${idx + 1}`}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <Box>
                      <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Impressions</Typography>
                      <Typography
                        sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                        data-testid={`sponsor-roi-impressions-${key}`}
                      >
                        {impressions}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Engagements</Typography>
                      <Typography
                        sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                        data-testid={`sponsor-roi-engagements-${key}`}
                      >
                        {engagements}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Click-Through Rate</Typography>
                      <Typography
                        sx={{ fontSize: 18, fontWeight: 800, color: ACCENT }}
                        data-testid={`sponsor-roi-ctr-${key}`}
                      >
                        {formatCtr(roi.clickThroughRate)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default SponsorPromotionLiveDashboard;
