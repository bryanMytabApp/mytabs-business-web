import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  InputAdornment,
  IconButton,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import BlockIcon from "@mui/icons-material/Block";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { getEntries, invalidateEntry } from "../../services/experienceService";

const ACCENT = "#F09925";

const EntryManagement = () => {
  const { eventId, experienceId } = useParams();

  // Search state
  const [searchMode, setSearchMode] = useState("name"); // "name" | "code"
  const [searchValue, setSearchValue] = useState("");
  const [searchError, setSearchError] = useState("");

  // Entries state
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Invalidate dialog state
  const [invalidateDialogOpen, setInvalidateDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [invalidateReason, setInvalidateReason] = useState("");
  const [invalidating, setInvalidating] = useState(false);
  const [invalidateError, setInvalidateError] = useState(null);

  const fetchEntries = useCallback(
    async (params) => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await getEntries(eventId, experienceId, params);
        setEntries(res.data?.data?.entries || res.data?.entries || []);
      } catch (err) {
        const msg =
          err.response?.data?.message || err.message || "Failed to load entries";
        setFetchError(msg);
      } finally {
        setLoading(false);
      }
    },
    [eventId, experienceId]
  );

  // Load initial entries on mount
  useEffect(() => {
    fetchEntries({});
  }, [fetchEntries]);

  const handleSearch = () => {
    setSearchError("");

    if (!searchValue.trim()) {
      fetchEntries({});
      return;
    }

    if (searchMode === "name" && searchValue.trim().length < 2) {
      setSearchError("Name search requires at least 2 characters");
      return;
    }

    const params =
      searchMode === "name"
        ? { search: searchValue.trim() }
        : { code: searchValue.trim() };

    fetchEntries(params);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleOpenInvalidateDialog = (entry) => {
    setSelectedEntry(entry);
    setInvalidateReason("");
    setInvalidateError(null);
    setInvalidateDialogOpen(true);
  };

  const handleCloseInvalidateDialog = () => {
    setInvalidateDialogOpen(false);
    setSelectedEntry(null);
    setInvalidateReason("");
    setInvalidateError(null);
  };

  const handleInvalidateEntry = async () => {
    if (!invalidateReason.trim() || invalidateReason.trim().length < 1) {
      setInvalidateError("A reason is required");
      return;
    }
    if (invalidateReason.length > 500) {
      setInvalidateError("Reason must be 500 characters or fewer");
      return;
    }

    setInvalidating(true);
    setInvalidateError(null);
    try {
      await invalidateEntry(eventId, experienceId, {
        entryId: selectedEntry.entryId,
        reason: invalidateReason.trim(),
      });
      handleCloseInvalidateDialog();
      // Refresh entries after invalidation
      handleSearch();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to invalidate entry";
      setInvalidateError(msg);
    } finally {
      setInvalidating(false);
    }
  };

  const isWinner = (entry) => entry.status === "winner";

  const getStatusChip = (status) => {
    const statusMap = {
      valid: { label: "Valid", color: "#4CAF50", bg: "#E8F5E9" },
      winner: { label: "Winner", color: "#F09925", bg: "#FFF3E0" },
      invalid: { label: "Invalid", color: "#E53935", bg: "#FFEBEE" },
      forfeited: { label: "Forfeited", color: "#757575", bg: "#F5F5F5" },
    };
    const config = statusMap[status] || {
      label: status || "Unknown",
      color: "#757575",
      bg: "#F5F5F5",
    };
    return (
      <Chip
        size="small"
        label={config.label}
        sx={{
          fontWeight: 600,
          fontSize: 11,
          background: config.bg,
          color: config.color,
        }}
      />
    );
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.25rem", md: "1.5rem" } }}
        >
          Entry Management
        </Typography>
        <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
          Search, view, and manage raffle entries for this experience.
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper
        elevation={0}
        sx={{ p: 2.5, borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <ToggleButtonGroup
            value={searchMode}
            exclusive
            onChange={(_, val) => {
              if (val) {
                setSearchMode(val);
                setSearchError("");
              }
            }}
            size="small"
            sx={{
              "& .MuiToggleButton-root.Mui-selected": {
                backgroundColor: `${ACCENT}18`,
                color: ACCENT,
                borderColor: ACCENT,
                "&:hover": { backgroundColor: `${ACCENT}28` },
              },
            }}
          >
            <ToggleButton value="name" sx={{ textTransform: "none", fontWeight: 600, fontSize: 13 }}>
              Search by Name
            </ToggleButton>
            <ToggleButton value="code" sx={{ textTransform: "none", fontWeight: 600, fontSize: 13 }}>
              Search by Entry Code
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            size="small"
            placeholder={
              searchMode === "name"
                ? "Enter attendee name (min 2 characters)..."
                : "Enter exact entry code..."
            }
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            error={!!searchError}
            helperText={searchError}
            sx={{ flex: 1, minWidth: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: "#9E9E9E", fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            onClick={handleSearch}
            disabled={loading}
            sx={{
              background: ACCENT,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              whiteSpace: "nowrap",
              "&:hover": { background: "#D4820F" },
            }}
          >
            Search
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {fetchError}
        </Alert>
      )}

      {/* Results Table */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress sx={{ color: ACCENT }} />
        </Box>
      ) : entries.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 5,
            textAlign: "center",
            borderRadius: 3,
            border: "1.5px dashed #E0E0E0",
            background: "#FAFAFA",
          }}
        >
          <SearchIcon sx={{ fontSize: 40, color: "#BDBDBD", mb: 1 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 14 }}>
            No entries found
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>
            Try adjusting your search criteria or check back later.
          </Typography>
        </Paper>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ background: "#FAFAFA" }}>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Entry ID
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Attendee Name
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Entry Code
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Channel
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Timestamp
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                  Status
                </TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }} align="right">
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entries.map((entry) => (
                <TableRow
                  key={entry.entryId}
                  sx={{
                    "&:hover": { background: "#FAFAFA" },
                    opacity: entry.status === "invalid" ? 0.6 : 1,
                  }}
                >
                  <TableCell sx={{ fontSize: 13, fontFamily: "monospace" }}>
                    {entry.entryId?.slice(0, 8) || "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13, fontWeight: 500 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                      {entry.attendeeName || "—"}
                      {isWinner(entry) && (
                        <EmojiEventsIcon
                          sx={{ color: ACCENT, fontSize: 16 }}
                          titleAccess="Winner"
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontFamily: "monospace", color: "#424242" }}>
                    {entry.entryCode || "—"}
                  </TableCell>
                  <TableCell sx={{ fontSize: 13 }}>
                    <Chip
                      size="small"
                      label={entry.channel || "—"}
                      variant="outlined"
                      sx={{ fontSize: 11, fontWeight: 500 }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "#616161" }}>
                    {formatTimestamp(entry.timestamp)}
                  </TableCell>
                  <TableCell>{getStatusChip(entry.status)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenInvalidateDialog(entry)}
                      disabled={isWinner(entry) || entry.status === "invalid"}
                      title={
                        isWinner(entry)
                          ? "Cannot invalidate winner entries"
                          : entry.status === "invalid"
                          ? "Entry already invalidated"
                          : "Invalidate entry"
                      }
                      sx={{
                        color: isWinner(entry) || entry.status === "invalid" ? "#BDBDBD" : "#E53935",
                        "&:hover": { background: "#FFEBEE" },
                      }}
                    >
                      <BlockIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Invalidate Entry Dialog */}
      <Dialog
        open={invalidateDialogOpen}
        onClose={handleCloseInvalidateDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          Invalidate Entry
        </DialogTitle>
        <DialogContent>
          {selectedEntry && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: "#71727A", mb: 1 }}>
                You are about to invalidate the entry for{" "}
                <strong>{selectedEntry.attendeeName || "Unknown"}</strong> (code:{" "}
                <code>{selectedEntry.entryCode}</code>). This entry will be
                excluded from all future drawings.
              </Typography>
            </Box>
          )}
          <TextField
            label="Reason for invalidation"
            placeholder="Provide a reason for invalidating this entry (1-500 characters)..."
            multiline
            rows={3}
            fullWidth
            value={invalidateReason}
            onChange={(e) => setInvalidateReason(e.target.value)}
            error={!!invalidateError}
            helperText={
              invalidateError || `${invalidateReason.length}/500 characters`
            }
            inputProps={{ maxLength: 500 }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseInvalidateDialog}
            sx={{ textTransform: "none", color: "#71727A", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleInvalidateEntry}
            disabled={invalidating || !invalidateReason.trim()}
            sx={{
              background: "#E53935",
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              "&:hover": { background: "#C62828" },
            }}
          >
            {invalidating ? (
              <CircularProgress size={20} sx={{ color: "#fff" }} />
            ) : (
              "Invalidate Entry"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EntryManagement;
