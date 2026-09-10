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
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import { getLiveStats } from "../../services/experienceService";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 10.2)

// The plugin returns per-offer analytics as { offers: [{ offerId, title,
// vendorName, claimedCount, redeemedCount, remainingInventory, fullyClaimed,
// redemptionRate }] }. Tolerate a bare array too so the component is robust to
// either shape.
function offerMetrics(stats) {
  if (!stats) return [];
  if (Array.isArray(stats.offers)) return stats.offers;
  if (Array.isArray(stats)) return stats;
  return [];
}

// Render a remaining-inventory value: a finite offer shows its number, an
// unlimited offer shows "Unlimited".
function renderRemaining(remaining) {
  if (remaining === "unlimited" || remaining === null || remaining === undefined) {
    return "Unlimited";
  }
  return Number(remaining).toLocaleString();
}

// Format a redemption rate (0..1) as a whole-number percentage.
function formatRate(rate) {
  const r = Number(rate) || 0;
  return `${Math.round(r * 100)}%`;
}

/**
 * CouponLiveDashboard — organizer-facing live dashboard for a Digital Coupons
 * instance. Mirrors TreasureHuntLiveDashboard/RaffleLiveDashboard: a LIVE/CLOSED
 * header chip with instance totals (total claimed, total redeemed), a 2s
 * ETag-optimized polling loop over getLiveStats while Live, and one card per
 * coupon offer showing its title, vendor, claimed count, redeemed count,
 * remaining inventory (or "Unlimited"), and redemption rate. A finite offer with
 * zero remaining inventory shows a "Fully claimed" chip. While Closed the
 * dashboard shows final metrics + a "Closed" indicator and stops polling. A
 * failed refresh surfaces an Alert while the interval keeps running to retry
 * next tick (Requirement 10.7).
 */
const CouponLiveDashboard = () => {
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
          setError(err.response?.data?.message || "Failed to load coupon results");
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

  // Set up the 2s polling interval while Live (Requirement 10.2). While Closed
  // the dashboard shows final metrics and stops polling (Requirement 10.6). A
  // failed refresh sets the error while the interval keeps running so the next
  // tick retries (Requirement 10.7).
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

  const offers = offerMetrics(stats);
  const totalClaimed = Number(stats?.totalClaimed) || 0;
  const totalRedeemed = Number(stats?.totalRedeemed) || 0;
  const hasClaims = totalClaimed > 0;

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
          Digital Coupons
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

      {/* Instance totals (Requirement 10.4). */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Box
          data-testid="total-claimed"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#EDE9FE", minWidth: 140 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Total Claimed</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>{totalClaimed}</Typography>
        </Box>
        <Box
          data-testid="total-redeemed"
          sx={{ px: 2, py: 1, borderRadius: 2, background: "#F3F4F6", minWidth: 140 }}
        >
          <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Total Redeemed</Typography>
          <Typography sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}>{totalRedeemed}</Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty state (Requirement 10.8). */}
      {!hasClaims && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }} data-testid="empty-state">
          <CardContent sx={{ p: 3, textAlign: "center" }}>
            <Typography sx={{ color: "#9CA3AF", fontSize: 14 }}>
              No coupons claimed yet.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Per-offer metrics (Requirement 10.1, 10.3, 10.5). */}
      {offers.map((offer, idx) => {
        const claimed = Number(offer.claimedCount) || 0;
        const redeemed = Number(offer.redeemedCount) || 0;
        const isUnlimited =
          offer.remainingInventory === "unlimited" ||
          offer.remainingInventory === null ||
          offer.remainingInventory === undefined;
        const fullyClaimed =
          offer.fullyClaimed === true ||
          (!isUnlimited && Number(offer.remainingInventory) === 0);
        return (
          <Card
            key={offer.offerId || idx}
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
            data-testid={`offer-card-${offer.offerId || idx}`}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
                <LocalOfferOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
                <Box sx={{ flex: 1, minWidth: 160 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                    {offer.title || `Offer ${idx + 1}`}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: "#6B7280" }}>
                    {offer.vendorName || "Vendor"}
                  </Typography>
                </Box>
                {fullyClaimed && (
                  <Chip
                    label="Fully claimed"
                    size="small"
                    data-testid={`fully-claimed-${offer.offerId || idx}`}
                    sx={{
                      background: "#FEE2E2",
                      color: "#DC2626",
                      fontWeight: 700,
                      fontSize: 11,
                      height: 22,
                    }}
                  />
                )}
              </Box>

              <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Claimed</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`offer-claimed-${offer.offerId || idx}`}
                  >
                    {claimed}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Redeemed</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`offer-redeemed-${offer.offerId || idx}`}
                  >
                    {redeemed}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Remaining</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: "#1D1B20" }}
                    data-testid={`offer-remaining-${offer.offerId || idx}`}
                  >
                    {renderRemaining(offer.remainingInventory)}
                  </Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 12, color: "#6B7280", fontWeight: 700 }}>Redemption Rate</Typography>
                  <Typography
                    sx={{ fontSize: 18, fontWeight: 800, color: ACCENT }}
                    data-testid={`offer-rate-${offer.offerId || idx}`}
                  >
                    {formatRate(offer.redemptionRate)}
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

export default CouponLiveDashboard;
