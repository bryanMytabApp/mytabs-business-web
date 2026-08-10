import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getDrawings } from "../../services/experienceService";

const ACCENT = "#F09925";

/**
 * DrawingRow — Expandable table row showing drawing details and winner info.
 */
const DrawingRow = ({ drawing }) => {
  const [open, setOpen] = useState(false);

  const drawingTime = drawing.timestamp
    ? new Date(drawing.timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  const triggerLabel = drawing.triggerMethod || drawing.trigger || "scheduled";
  const triggerColor = triggerLabel === "manual" ? ACCENT : "#2196F3";

  const claimStatusCounts = (drawing.winners || []).reduce(
    (acc, w) => {
      const status = w.claimStatus || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {}
  );

  const getClaimChip = () => {
    const winners = drawing.winners || [];
    if (winners.length === 0) return <Chip size="small" label="No winners" sx={{ fontSize: 11 }} />;

    const claimed = claimStatusCounts.claimed || 0;
    const forfeited = claimStatusCounts.forfeited || 0;
    const pending = winners.length - claimed - forfeited;

    if (claimed === winners.length) {
      return <Chip size="small" label="All Claimed" sx={{ fontSize: 11, fontWeight: 600, background: "#E8F5E9", color: "#2E7D32" }} />;
    }
    if (forfeited === winners.length) {
      return <Chip size="small" label="All Forfeited" sx={{ fontSize: 11, fontWeight: 600, background: "#FFEBEE", color: "#C62828" }} />;
    }
    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {claimed > 0 && <Chip size="small" label={`${claimed} Claimed`} sx={{ fontSize: 10, fontWeight: 600, background: "#E8F5E9", color: "#2E7D32" }} />}
        {pending > 0 && <Chip size="small" label={`${pending} Pending`} sx={{ fontSize: 10, fontWeight: 600, background: "#FFF3E0", color: "#E65100" }} />}
        {forfeited > 0 && <Chip size="small" label={`${forfeited} Forfeited`} sx={{ fontSize: 10, fontWeight: 600, background: "#FFEBEE", color: "#C62828" }} />}
      </Box>
    );
  };

  return (
    <>
      <TableRow
        sx={{
          "& > *": { borderBottom: open ? "none" : undefined },
          "&:hover": { background: "#FAFAFA" },
          cursor: "pointer",
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell sx={{ width: 40, p: 1 }}>
          <IconButton size="small" aria-label="expand row">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {drawingTime}
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={triggerLabel}
            sx={{
              fontSize: 11,
              fontWeight: 600,
              background: `${triggerColor}14`,
              color: triggerColor,
              textTransform: "capitalize",
            }}
          />
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {drawing.totalEntries ?? drawing.eligibleEntries ?? "—"}
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {(drawing.winners || []).length}
        </TableCell>
        <TableCell>{getClaimChip()}</TableCell>
      </TableRow>

      {/* Expandable winner details */}
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#71727A", mb: 1 }}>
                Winner Details
              </Typography>
              {(!drawing.winners || drawing.winners.length === 0) ? (
                <Typography sx={{ fontSize: 12, color: "#9E9E9E", fontStyle: "italic" }}>
                  No winners for this drawing.
                </Typography>
              ) : (
                <Table size="small" sx={{ background: "#FAFAFA", borderRadius: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Entry ID</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>User</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Entry Code</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Claim Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drawing.winners.map((winner, idx) => (
                      <TableRow key={winner.entryId || idx}>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.entryId || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.attendeeName || winner.userId || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20", fontFamily: "monospace" }}>
                          {winner.entryCode || "—"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={winner.claimStatus || "pending"}
                            sx={{
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: "capitalize",
                              background:
                                winner.claimStatus === "claimed"
                                  ? "#E8F5E9"
                                  : winner.claimStatus === "forfeited"
                                  ? "#FFEBEE"
                                  : "#FFF3E0",
                              color:
                                winner.claimStatus === "claimed"
                                  ? "#2E7D32"
                                  : winner.claimStatus === "forfeited"
                                  ? "#C62828"
                                  : "#E65100",
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {drawing.auditSeed && (
                <Typography sx={{ fontSize: 10, color: "#BDBDBD", mt: 1, fontFamily: "monospace" }}>
                  Audit seed: {drawing.auditSeed}
                </Typography>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

/**
 * DrawingHistory — Table view of all drawings for a raffle experience.
 * Shows drawing time, trigger method, entries, winners, and claim status.
 * Expandable rows reveal individual winner details.
 */
const DrawingHistory = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchDrawings = useCallback(
    async (nextCursor = null) => {
      if (nextCursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = { limit: 20 };
        if (nextCursor) params.cursor = nextCursor;
        const res = await getDrawings(eventId, experienceId, params);
        const data = res.data?.data || res.data?.items || [];
        const newCursor = res.data?.nextCursor || null;

        if (nextCursor) {
          setDrawings((prev) => [...prev, ...data]);
        } else {
          setDrawings(data);
        }
        setCursor(newCursor);
        setHasMore(!!newCursor);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load drawing history");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [eventId, experienceId]
  );

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  if (loading) {
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
          onClick={() => navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`)}
          sx={{ color: "#71727A" }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CasinoOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
              Drawing History
            </Typography>
          </Box>
          <Typography sx={{ color: "#71727A", fontSize: 13, mt: 0.25 }}>
            All drawings for this raffle engagement
          </Typography>
        </Box>
        <IconButton onClick={() => fetchDrawings()} sx={{ color: ACCENT }}>
          <RefreshIcon />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {drawings.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            border: "1.5px dashed #E0E0E0",
            borderRadius: 3,
            background: "#FAFAFA",
          }}
        >
          <CasinoOutlinedIcon sx={{ fontSize: 48, color: "#BDBDBD", mb: 1.5 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 15 }}>
            No drawings yet
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>
            Drawings will appear here once triggered manually or by schedule.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ background: "#FAFAFA" }}>
                  <TableCell sx={{ width: 40 }} />
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Drawing Time
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Trigger
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Total Entries
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Winners
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Claim Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drawings.map((drawing, idx) => (
                  <DrawingRow key={drawing.drawingId || drawing.SK || idx} drawing={drawing} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {hasMore && (
            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => fetchDrawings(cursor)}
                disabled={loadingMore}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderColor: ACCENT,
                  color: ACCENT,
                  borderRadius: 2,
                  "&:hover": { borderColor: "#D4820F", background: `${ACCENT}08` },
                }}
              >
                {loadingMore ? (
                  <CircularProgress size={18} sx={{ color: ACCENT, mr: 1 }} />
                ) : null}
                Load More
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default DrawingHistory;
