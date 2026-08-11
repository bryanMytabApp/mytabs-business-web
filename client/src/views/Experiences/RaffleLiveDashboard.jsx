import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Divider,
  Button,
  Collapse,
} from "@mui/material";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import HourglassBottomOutlinedIcon from "@mui/icons-material/HourglassBottomOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {
  getLiveStats,
  triggerDraw,
  getEntries,
  getTimeline,
  getDrawings,
} from "../../services/experienceService";
import PotTicker from "../../components/Experiences/PotTicker";
import DrawingControls from "../../components/Experiences/DrawingControls";
import EntrySearchBar from "../../components/Experiences/EntrySearchBar";
import TimelineEvent from "../../components/Experiences/TimelineEvent";

const ACCENT = "#F09925";
const POLL_INTERVAL = 5000; // 5 seconds

/**
 * RaffleLiveDashboard — Real-time monitoring dashboard for a live raffle.
 * Features: stats bar, pot ticker, manual draw, entry search, timeline feed.
 * Auto-refreshes every 5s via polling with ETag optimization.
 */
const RaffleLiveDashboard = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  // Live stats
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(null);
  const etagRef = useRef(null);
  const pollRef = useRef(null);

  // Entry search
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Timeline
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(true);

  // Countdown
  const [countdown, setCountdown] = useState("");
  const countdownRef = useRef(null);

  // Raffle ends countdown
  const [endsCountdown, setEndsCountdown] = useState("");
  const endsCountdownRef = useRef(null);

  // Participants list
  const [participants, setParticipants] = useState([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  // Winners
  const [winners, setWinners] = useState([]);
  const [, setWinnersLoading] = useState(false);

  const fetchStats = useCallback(async (showLoading = false) => {
    if (showLoading) setStatsLoading(true);
    setStatsError(null);
    try {
      const config = {};
      if (etagRef.current) {
        config.headers = { "If-None-Match": etagRef.current };
        config.validateStatus = (status) => status === 200 || status === 304;
      }
      const res = await getLiveStats(eventId, experienceId, config);
      if (res.status === 304) {
        // Data unchanged, skip update
        return;
      }
      const etag = res.headers?.etag || res.headers?.["etag"];
      if (etag) etagRef.current = etag;
      setStats(res.data?.data || res.data);
    } catch (err) {
      if (err.response?.status !== 304) {
        setStatsError(err.response?.data?.message || "Failed to load stats");
      }
    } finally {
      if (showLoading) setStatsLoading(false);
    }
  }, [eventId, experienceId]);

  const fetchTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const res = await getTimeline(eventId, experienceId, { limit: 20 });
      setTimeline(res.data?.data || res.data?.items || []);
    } catch {
      // Silently fail timeline load
    } finally {
      setTimelineLoading(false);
    }
  }, [eventId, experienceId]);

  // Initial load
  useEffect(() => {
    fetchStats(true);
    fetchTimeline();
  }, [fetchStats, fetchTimeline]);

  // Polling every 5s
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
      fetchTimeline();
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStats, fetchTimeline]);

  // Countdown timer
  useEffect(() => {
    const nextDrawing = stats?.nextDrawingAt;
    if (!nextDrawing) {
      setCountdown("—");
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const target = new Date(nextDrawing).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setCountdown("Now");
        return;
      }

      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setCountdown(`${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${seconds}s`);
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [stats?.nextDrawingAt]);

  // Raffle ends countdown timer
  useEffect(() => {
    const endsAt = stats?.endsAt;
    if (!endsAt) {
      setEndsCountdown("—");
      return;
    }

    const updateEndsCountdown = () => {
      const now = Date.now();
      const target = new Date(endsAt).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setEndsCountdown("Ended");
        return;
      }

      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);

      if (days > 0) {
        setEndsCountdown(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      } else if (hours > 0) {
        setEndsCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setEndsCountdown(`${minutes}m ${seconds}s`);
      }
    };

    updateEndsCountdown();
    endsCountdownRef.current = setInterval(updateEndsCountdown, 1000);

    return () => {
      if (endsCountdownRef.current) clearInterval(endsCountdownRef.current);
    };
  }, [stats?.endsAt]);

  // Entry search handler
  const handleSearch = useCallback(
    async (term) => {
      if (!term) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      try {
        const res = await getEntries(eventId, experienceId, { search: term, limit: 50 });
        setSearchResults(res.data?.data || res.data?.items || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [eventId, experienceId]
  );

  // Manual draw handler
  const handleTriggerDraw = useCallback(async () => {
    await triggerDraw(eventId, experienceId);
    // Refresh stats and timeline after drawing
    await fetchStats(false);
    await fetchTimeline();
    // Also refresh winners
    fetchWinners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, experienceId, fetchStats, fetchTimeline]);

  // Fetch all participants
  const fetchParticipants = useCallback(async () => {
    setParticipantsLoading(true);
    try {
      const res = await getEntries(eventId, experienceId, { limit: 200 });
      setParticipants(res.data?.data || res.data?.items || []);
    } catch {
      setParticipants([]);
    } finally {
      setParticipantsLoading(false);
    }
  }, [eventId, experienceId]);

  // Fetch winners from drawing history
  const fetchWinners = useCallback(async () => {
    setWinnersLoading(true);
    try {
      const res = await getDrawings(eventId, experienceId, { limit: 10 });
      const drawings = res.data?.data || res.data?.items || [];
      // Extract winners from all drawings
      const allWinners = drawings.flatMap((d) => d.winners || []);
      setWinners(allWinners);
    } catch {
      setWinners([]);
    } finally {
      setWinnersLoading(false);
    }
  }, [eventId, experienceId]);

  // Toggle participants panel
  const handleToggleParticipants = () => {
    if (!showParticipants && participants.length === 0) {
      fetchParticipants();
    }
    setShowParticipants((prev) => !prev);
  };

  // Fetch winners on initial load
  useEffect(() => {
    fetchWinners();
  }, [fetchWinners]);

  // Metric cards data
  const metricCards = [
    {
      label: "Total Entries",
      value: stats?.totalEntries ?? "—",
      icon: ConfirmationNumberOutlinedIcon,
      color: "#4CAF50",
    },
    {
      label: "Unique Participants",
      value: stats?.uniqueParticipants ?? "—",
      icon: PeopleOutlinedIcon,
      color: "#2196F3",
    },
    {
      label: "Entries / 5 min",
      value: stats?.entriesLast5Min ?? "—",
      icon: TrendingUpOutlinedIcon,
      color: "#7C4DFF",
    },
    {
      label: "Next Drawing",
      value: countdown,
      icon: TimerOutlinedIcon,
      color: ACCENT,
    },
    {
      label: "Raffle Ends",
      value: endsCountdown,
      icon: HourglassBottomOutlinedIcon,
      color: "#F44336",
    },
  ];

  if (statsLoading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <IconButton
          onClick={() => navigate(`/admin/my-events/${eventId}/experiences`)}
          sx={{ color: "#71727A" }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
            Live Dashboard
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 13 }}>
            {stats?.experienceName || "Raffle"} — Real-time monitoring
          </Typography>
        </Box>
        <Chip
          label="LIVE"
          sx={{
            background: "#E8F5E9",
            color: "#2E7D32",
            fontWeight: 700,
            fontSize: 12,
            animation: "pulse 2s infinite",
            "@keyframes pulse": {
              "0%, 100%": { opacity: 1 },
              "50%": { opacity: 0.7 },
            },
          }}
        />
        <IconButton onClick={() => fetchStats(false)} sx={{ color: ACCENT }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {statsError && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {statsError}
        </Alert>
      )}

      {/* Stats Bar */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Grid item xs={6} md={true} key={metric.label}>
              <Card
                elevation={0}
                sx={{
                  borderRadius: 3,
                  border: "1px solid #E8E8E8",
                  height: "100%",
                  transition: "box-shadow 0.2s",
                  "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.06)" },
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${metric.color}14`,
                      mb: 1,
                    }}
                  >
                    <Icon sx={{ color: metric.color, fontSize: 20 }} />
                  </Box>
                  <Typography
                    sx={{
                      fontSize: 24,
                      fontWeight: 800,
                      color: "#1D1B20",
                      lineHeight: 1.2,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A", fontWeight: 600, mt: 0.25 }}>
                    {metric.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Pot Ticker (for 50/50 and Progressive types) */}
      {stats?.potAmount != null && stats.potAmount > 0 && (
        <Box sx={{ mb: 3 }}>
          <PotTicker
            amount={stats.potAmount}
            label={stats.raffleType === "Progressive" ? "Progressive Jackpot" : "50/50 Pot"}
            currency={stats.currency || "USD"}
          />
        </Box>
      )}

      {/* Drawing Controls + Entry Search */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
              gap: 2,
            }}
          >
            <DrawingControls
              onTriggerDraw={handleTriggerDraw}
              disabled={!stats || stats.state !== "Live"}
              totalEntries={stats?.totalEntries || 0}
            />
            <EntrySearchBar onSearch={handleSearch} loading={searchLoading} />
          </Box>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", mb: 1 }}>
                Search Results ({searchResults.length})
              </Typography>
              <Box sx={{ maxHeight: 200, overflow: "auto" }}>
                {searchResults.map((entry) => (
                  <Box
                    key={entry.entryId || entry.SK}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 1,
                      px: 1.5,
                      borderRadius: 1.5,
                      "&:hover": { background: "#F5F5F5" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1D1B20" }}>
                        {entry.attendeeName || entry.userId || "Unknown"}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
                        Code: {entry.entryCode} · {entry.channel || "in-app"}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={entry.status || "valid"}
                      sx={{
                        fontSize: 10,
                        fontWeight: 600,
                        background: entry.status === "invalidated" ? "#FFEBEE" : "#E8F5E9",
                        color: entry.status === "invalidated" ? "#C62828" : "#2E7D32",
                      }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Winner Display */}
      {winners.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8F5E9", mb: 3, background: "#F6FFF8" }}>
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <EmojiEventsOutlinedIcon sx={{ color: "#FFB300", fontSize: 22 }} />
              <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 15 }}>
                Winner{winners.length > 1 ? "s" : ""}
              </Typography>
            </Box>
            {winners.map((winner, idx) => (
              <Box
                key={winner.entryId || idx}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  py: 1.5,
                  px: 2,
                  borderRadius: 2,
                  background: "#fff",
                  border: "1px solid #E0E0E0",
                  mb: 1,
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "#FFF8E1",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <EmojiEventsOutlinedIcon sx={{ color: "#FFB300", fontSize: 18 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>
                    {winner.attendeeName || winner.name || winner.userId || "Winner"}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#71727A" }}>
                    {winner.email || winner.phone || winner.entryCode || ""}
                  </Typography>
                </Box>
                <Chip
                  label={winner.claimStatus || "Pending"}
                  size="small"
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: winner.claimStatus === "claimed" ? "#E8F5E9" : "#FFF3E0",
                    color: winner.claimStatus === "claimed" ? "#2E7D32" : "#E65100",
                    textTransform: "capitalize",
                  }}
                />
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Participants Panel */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={handleToggleParticipants}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PeopleOutlinedIcon sx={{ color: "#2196F3", fontSize: 20 }} />
              <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 15 }}>
                Participants
              </Typography>
              {stats?.uniqueParticipants > 0 && (
                <Chip
                  label={stats.uniqueParticipants}
                  size="small"
                  sx={{ fontSize: 11, fontWeight: 700, height: 22, background: "#E3F2FD", color: "#1565C0" }}
                />
              )}
            </Box>
            <Button
              size="small"
              endIcon={showParticipants ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{ textTransform: "none", fontWeight: 600, fontSize: 12, color: ACCENT }}
            >
              {showParticipants ? "Hide" : "Reveal"}
            </Button>
          </Box>

          <Collapse in={showParticipants}>
            <Divider sx={{ my: 2 }} />
            {participantsLoading ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <CircularProgress size={24} sx={{ color: ACCENT }} />
              </Box>
            ) : participants.length === 0 ? (
              <Typography sx={{ color: "#9E9E9E", fontSize: 13, textAlign: "center", py: 2 }}>
                No participants yet.
              </Typography>
            ) : (
              <Box sx={{ maxHeight: 320, overflow: "auto" }}>
                {participants.map((entry, idx) => (
                  <Box
                    key={entry.entryId || entry.SK || idx}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      py: 1,
                      px: 1.5,
                      borderRadius: 1.5,
                      "&:nth-of-type(even)": { background: "#FAFAFA" },
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1D1B20" }}>
                        {entry.attendeeName || entry.name || entry.userId || "Anonymous"}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
                        {entry.email || entry.phone || entry.entryCode || "—"}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
                      {entry.channel || "in-app"}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Collapse>
        </CardContent>
      </Card>

      {/* Timeline Feed */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <HistoryOutlinedIcon sx={{ color: ACCENT, fontSize: 20 }} />
            <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 15 }}>
              Activity Timeline
            </Typography>
          </Box>

          {timelineLoading && timeline.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <CircularProgress size={24} sx={{ color: ACCENT }} />
            </Box>
          ) : timeline.length === 0 ? (
            <Box
              sx={{
                textAlign: "center",
                py: 4,
                border: "1.5px dashed #E0E0E0",
                borderRadius: 2,
                background: "#FAFAFA",
              }}
            >
              <HistoryOutlinedIcon sx={{ fontSize: 36, color: "#BDBDBD", mb: 1 }} />
              <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 13 }}>
                No activity yet
              </Typography>
              <Typography sx={{ color: "#9E9E9E", fontSize: 12, mt: 0.5 }}>
                Events will appear here as participants enter and drawings occur.
              </Typography>
            </Box>
          ) : (
            <Box>
              {timeline.map((event, idx) => (
                <TimelineEvent
                  key={event.eventId || event.SK || idx}
                  type={event.actionType || event.type || "entry"}
                  message={event.message || event.description || `${event.actionType || "Event"} occurred`}
                  timestamp={event.timestamp}
                  metadata={event.metadata}
                  isLast={idx === timeline.length - 1}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default RaffleLiveDashboard;
