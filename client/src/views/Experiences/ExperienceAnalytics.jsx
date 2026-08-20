import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Divider from "@mui/material/Divider";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { getAnalytics, exportAnalytics, getDrawings, getInstance } from "../../services/experienceService";
import DrawStatusCard from "./DrawStatusCard";

const ACCENT = "#F09925";
const CHART_COLORS = ["#F09925", "#4DD9E0", "#A78BFA", "#34D399", "#F97316", "#60A5FA"];

/**
 * ExperienceAnalytics — Admin dashboard view for experience analytics.
 * Displays top metrics, entries over time (LineChart), demographics by ticket type (BarChart),
 * entry channels (PieChart), and an Export CSV button.
 *
 * Requirements: 7.1, 7.2, 7.4
 */
const ExperienceAnalytics = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [drawStatus, setDrawStatus] = useState(null);
  const [engagementCode, setEngagementCode] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAnalytics(eventId, experienceId);
      setAnalytics(res.data?.data || res.data || null);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }, [eventId, experienceId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  useEffect(() => {
    // Fetch instance to get engagementCode
    getInstance(eventId, experienceId)
      .then((res) => {
        const instance = res.data?.data || res.data;
        if (instance?.engagementCode) {
          setEngagementCode(instance.engagementCode);
        }
      })
      .catch(() => {});
  }, [eventId, experienceId]);

  useEffect(() => {
    // Fetch existing drawings data
    if (!eventId || !experienceId) return;
    getDrawings(eventId, experienceId)
      .then((res) => {
        console.log('📊 Drawings response:', res.data);
        const drawings = res.data?.data || res.data || [];
        if (Array.isArray(drawings) && drawings.length > 0) {
          setDrawStatus({ drawings, drawState: "DRAW_COMPLETE" });
        }
      })
      .catch((err) => {
        console.error('📊 Drawings fetch error:', err.message, err.response?.status);
        setDrawStatus(null);
      });
  }, [eventId, experienceId]);

  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const res = await exportAnalytics(eventId, experienceId, { format: "csv" });
      const blob = new Blob([res.data], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `experience-analytics-${experienceId}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Failed to export CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="outlined" onClick={fetchAnalytics}>Retry</Button>
      </Box>
    );
  }

  const metrics = analytics?.metrics || {};
  const entriesOverTime = analytics?.entriesOverTime || [];
  const demographics = analytics?.demographics || [];
  const entryChannels = analytics?.entryChannels || [];

  const topMetrics = [
    { label: "Total Participants", value: metrics.totalParticipants ?? 0, icon: <PeopleOutlineIcon /> },
    { label: "Total Entries", value: metrics.totalEntries ?? 0, icon: <ConfirmationNumberOutlinedIcon /> },
    { label: "Peak Concurrent", value: metrics.peakConcurrent ?? 0, icon: <TrendingUpIcon /> },
    { label: "Avg Time to Participate", value: metrics.avgTimeToParticipate ? `${metrics.avgTimeToParticipate}s` : "—", icon: <AccessTimeIcon /> },
    { label: "Completion Rate", value: metrics.completionRate != null ? `${Math.round(metrics.completionRate * 100)}%` : "—", icon: <CheckCircleOutlineIcon /> },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#0d1b35" }}>
            Engagement <span style={{ color: ACCENT }}>Analytics</span>
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 11, fontFamily: "monospace", mt: 0.25 }}>
            {engagementCode || `ENG-${experienceId?.replace(/-/g, "").substring(0, 4).toUpperCase()}-${experienceId?.replace(/-/g, "").substring(4, 8).toUpperCase()}`}
          </Typography>
        </Box>
      </Box>

      {/* Desktop layout: sidebar + main content */}
      <Box sx={{ display: "flex", gap: 3 }}>
        {/* Left Sidebar — Desktop only */}
        <Box sx={{ display: { xs: "none", md: "block" }, width: 200, flexShrink: 0 }}>
          <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", position: "sticky", top: 24 }}>
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              {[
                { label: "Live Dashboard", icon: <EmojiEventsOutlinedIcon fontSize="small" />, onClick: () => navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`) },
                { label: "Draw Report", icon: <SettingsOutlinedIcon fontSize="small" />, onClick: () => navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/drawings`) },
                { divider: true },
                { label: exporting ? "Exporting..." : "Export CSV", icon: <FileDownloadOutlinedIcon fontSize="small" />, onClick: handleExportCsv, disabled: exporting },
                { label: "Refresh", icon: <RefreshIcon fontSize="small" />, onClick: fetchAnalytics },
              ].map((item, idx) => item.divider ? (
                <Divider key={idx} />
              ) : (
                <Box
                  key={idx}
                  onClick={item.onClick}
                  sx={{
                    display: "flex", alignItems: "center", gap: 1.5, px: 2, py: 1.5,
                    cursor: "pointer",
                    color: "#4A4A4A", fontSize: 13, fontWeight: 500,
                    transition: "background 0.15s",
                    "&:hover": { background: "#F5F5F5" },
                  }}
                >
                  <Box sx={{ color: "#71727A", display: "flex", alignItems: "center" }}>{item.icon}</Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{item.label}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: 1, minWidth: 0 }}>

      {/* Top Metrics */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(5, 1fr)" }, gap: 2, mb: 4 }}>
        {topMetrics.map((m) => (
          <Paper
            key={m.label}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: "1px solid rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Box sx={{ color: ACCENT, display: "flex", alignItems: "center" }}>{m.icon}</Box>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "#6a7f9a", textTransform: "uppercase", letterSpacing: "0.08em", fontSize: 10 }}>
              {m.label}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 900, color: "#0d1b35" }}>
              {m.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Divider sx={{ mb: 4 }} />

      {/* Draw Results Quick Link — shown when drawings exist */}
      {drawStatus?.drawings?.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 3,
            border: "1px solid rgba(40,167,69,0.2)",
            background: "rgba(40,167,69,0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ fontSize: 24 }}>🏆</Box>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#0d1b35" }}>
                Draw Complete
              </Typography>
              <Typography variant="caption" sx={{ color: "#6a7f9a" }}>
                {drawStatus.drawings[0]?.winners?.[0]?.attendeeName || drawStatus.drawings[0]?.winners?.[0]?.entryCode || "Winner selected"}
              </Typography>
            </Box>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              // Navigate to the drawings tab for this experience
              window.location.href = `/admin/my-events/${eventId}/experiences/${experienceId}/drawings`;
            }}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              borderColor: "#28a745",
              color: "#28a745",
              borderRadius: 2,
              "&:hover": { borderColor: "#1e7e34", backgroundColor: "rgba(40,167,69,0.08)" },
            }}
          >
            View Draw Results
          </Button>
        </Paper>
      )}

      {/* Provably Fair Draw Status */}
      {(analytics?.config?.drawType === "provably-fair" ||
        analytics?.drawType === "provably-fair" ||
        analytics?.experience?.config?.drawType === "provably-fair") && (
        <DrawStatusCard
          drawStatus={drawStatus}
          drawType="provably-fair"
          drawId={drawStatus?.drawId || analytics?.drawId}
        />
      )}

      {/* Charts Grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" }, gap: 3 }}>
        {/* Entries Over Time — LineChart */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: "#0d1b35" }}>
            Entries Over Time
          </Typography>
          {entriesOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={entriesOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="entries"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  dot={{ fill: ACCENT, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography color="text.secondary">No data available</Typography>
            </Box>
          )}
        </Paper>

        {/* Entry Channels — PieChart */}
        <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: "#0d1b35" }}>
            Entry Channels
          </Typography>
          {entryChannels.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={entryChannels}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  nameKey="channel"
                  label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {entryChannels.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography color="text.secondary">No data available</Typography>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Demographics by Ticket Type — BarChart */}
      <Paper elevation={0} sx={{ p: 3, mt: 3, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2, color: "#0d1b35" }}>
          Demographics by Ticket Type
        </Typography>
        {demographics.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={demographics}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="ticketType" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="participants" fill={ACCENT} radius={[4, 4, 0, 0]} />
              <Bar dataKey="entries" fill="#4DD9E0" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <Box sx={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography color="text.secondary">No data available</Typography>
          </Box>
        )}
      </Paper>
        </Box>{/* End Main Content */}
      </Box>{/* End Desktop layout flex */}
    </Box>
  );
};

export default ExperienceAnalytics;
