import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Paper,
  IconButton,
  Collapse,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import HistoryIcon from "@mui/icons-material/History";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import http from "../../utils/axios/http";

/**
 * QRDestinationManager - Manages configurable QR destinations with history and scheduling.
 *
 * Props:
 * - publicCode (string): The public code for the QR destination
 * - entityName (string): Name of the entity
 *
 * Requirements: 7.1, 7.2, 7.4, 7.6, 7.7, 7.8
 */
export function QRDestinationManager({ publicCode, entityName }) {
  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [urlError, setUrlError] = useState(null);
  const [saving, setSaving] = useState(false);

  // History state
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Schedule state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleUrl, setScheduleUrl] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleUrlError, setScheduleUrlError] = useState(null);
  const [scheduling, setScheduling] = useState(false);

  const fetchDestination = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await http.get(`/api/destinations/${publicCode}`);
      setDestination(response.data);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError("Failed to load destination information.");
      }
    } finally {
      setLoading(false);
    }
  }, [publicCode]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const response = await http.get(
        `/api/destinations/${publicCode}/history`
      );
      setHistory(response.data?.changes || response.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (publicCode) {
      fetchDestination();
    }
  }, [publicCode, fetchDestination]);

  const validateUrl = (url) => {
    if (!url || url.trim() === "") {
      return "URL is required.";
    }
    if (url.length > 2048) {
      return "URL must not exceed 2048 characters.";
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:") {
        return "URL must use HTTPS protocol.";
      }
    } catch {
      return "Please enter a valid URL.";
    }
    return null;
  };

  const handleStartEdit = () => {
    setEditing(true);
    setNewUrl(destination?.currentDestinationUrl || "");
    setUrlError(null);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setNewUrl("");
    setUrlError(null);
  };

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setNewUrl(val);
    if (val) {
      setUrlError(validateUrl(val));
    } else {
      setUrlError(null);
    }
  };

  const handleSaveUrl = async () => {
    const validationError = validateUrl(newUrl);
    if (validationError) {
      setUrlError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await http.put(`/api/destinations/${publicCode}`, {
        destinationUrl: newUrl,
      });
      setSuccess("Destination updated successfully.");
      setEditing(false);
      setTimeout(() => setSuccess(null), 3000);
      fetchDestination();
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to update destination.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleHistory = () => {
    if (!historyOpen) {
      fetchHistory();
    }
    setHistoryOpen(!historyOpen);
  };

  const handleScheduleUrlChange = (e) => {
    const val = e.target.value;
    setScheduleUrl(val);
    if (val) {
      setScheduleUrlError(validateUrl(val));
    } else {
      setScheduleUrlError(null);
    }
  };

  const handleScheduleSubmit = async () => {
    const validationError = validateUrl(scheduleUrl);
    if (validationError) {
      setScheduleUrlError(validationError);
      return;
    }
    if (!scheduleDate) {
      setError("Please select an activation date and time.");
      return;
    }

    setScheduling(true);
    setError(null);
    try {
      await http.post(`/api/destinations/${publicCode}/schedule`, {
        destinationUrl: scheduleUrl,
        activationDate: new Date(scheduleDate).toISOString(),
      });
      setSuccess("Scheduled change created successfully.");
      setScheduleUrl("");
      setScheduleDate("");
      setScheduleOpen(false);
      setTimeout(() => setSuccess(null), 3000);
      fetchDestination();
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to schedule destination change.";
      setError(message);
    } finally {
      setScheduling(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        QR Destinations
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* Current Destination */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Current Destination
        </Typography>
        <Typography variant="body1" fontWeight={500}>
          {entityName}
        </Typography>
        <Typography
          variant="body2"
          sx={{ wordBreak: "break-all", mt: 0.5, color: "primary.main" }}
        >
          {destination?.currentDestinationUrl || "No destination configured"}
        </Typography>
        {destination?.lastUpdatedAt && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            Last updated: {formatDate(destination.lastUpdatedAt)}
          </Typography>
        )}

        {/* Edit Controls */}
        {!editing ? (
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              startIcon={<EditIcon />}
              onClick={handleStartEdit}
              sx={{ textTransform: "none" }}
            >
              Update Destination
            </Button>
          </Box>
        ) : (
          <Box sx={{ mt: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="New Destination URL"
              placeholder="https://example.com/new-destination"
              value={newUrl}
              onChange={handleUrlChange}
              error={!!urlError}
              helperText={urlError || "Must be a valid HTTPS URL (max 2048 characters)"}
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={
                  saving ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <SaveIcon />
                  )
                }
                onClick={handleSaveUrl}
                disabled={saving || !!urlError}
                sx={{ textTransform: "none" }}
              >
                Save
              </Button>
              <Button
                size="small"
                startIcon={<CancelIcon />}
                onClick={handleCancelEdit}
                disabled={saving}
                sx={{ textTransform: "none" }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Paper>

      {/* Scheduled Changes */}
      {destination?.scheduledChanges?.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Pending Scheduled Changes
          </Typography>
          <List dense disablePadding>
            {destination.scheduledChanges
              .sort(
                (a, b) =>
                  new Date(a.activationDate) - new Date(b.activationDate)
              )
              .map((change, idx) => (
                <ListItem key={idx} disableGutters>
                  <ListItemText
                    primary={change.destinationUrl}
                    secondary={`Activates: ${formatDate(change.activationDate)}`}
                    primaryTypographyProps={{
                      variant: "body2",
                      sx: { wordBreak: "break-all" },
                    }}
                  />
                  <Chip
                    label="Scheduled"
                    size="small"
                    color="info"
                    variant="outlined"
                  />
                </ListItem>
              ))}
          </List>
        </Paper>
      )}

      {/* Action Buttons */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ScheduleIcon />}
          onClick={() => setScheduleOpen(!scheduleOpen)}
          sx={{ textTransform: "none" }}
        >
          Schedule Change
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={historyOpen ? <ExpandLessIcon /> : <HistoryIcon />}
          onClick={handleToggleHistory}
          sx={{ textTransform: "none" }}
        >
          {historyOpen ? "Hide History" : "View History"}
        </Button>
      </Box>

      {/* Schedule Form */}
      <Collapse in={scheduleOpen}>
        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Schedule Future Destination Change
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Destination URL"
            placeholder="https://example.com/campaign"
            value={scheduleUrl}
            onChange={handleScheduleUrlChange}
            error={!!scheduleUrlError}
            helperText={scheduleUrlError}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            type="datetime-local"
            label="Activation Date & Time"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ min: new Date().toISOString().slice(0, 16) }}
            sx={{ mb: 1.5 }}
          />
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="contained"
              startIcon={
                scheduling ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <ScheduleIcon />
                )
              }
              onClick={handleScheduleSubmit}
              disabled={scheduling || !!scheduleUrlError}
              sx={{ textTransform: "none" }}
            >
              Schedule
            </Button>
            <Button
              size="small"
              onClick={() => setScheduleOpen(false)}
              sx={{ textTransform: "none" }}
            >
              Cancel
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* History */}
      <Collapse in={historyOpen}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Change History (Last 50)
          </Typography>
          {historyLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={20} />
            </Box>
          ) : history.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No history available.
            </Typography>
          ) : (
            <List dense disablePadding>
              {history.map((entry, idx) => (
                <React.Fragment key={idx}>
                  <ListItem disableGutters sx={{ alignItems: "flex-start" }}>
                    <ListItemText
                      primary={
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(entry.changedAt)}
                            {entry.changedBy && ` • ${entry.changedBy}`}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{
                              display: "block",
                              wordBreak: "break-all",
                              color: "error.main",
                              fontSize: "0.8rem",
                            }}
                          >
                            − {entry.previousUrl || "(none)"}
                          </Typography>
                          <Typography
                            variant="body2"
                            component="span"
                            sx={{
                              display: "block",
                              wordBreak: "break-all",
                              color: "success.main",
                              fontSize: "0.8rem",
                            }}
                          >
                            + {entry.newUrl}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {idx < history.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Paper>
      </Collapse>
    </Box>
  );
}

export default QRDestinationManager;
