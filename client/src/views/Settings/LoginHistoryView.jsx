import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";
import FacebookIcon from "@mui/icons-material/Facebook";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import ComputerIcon from "@mui/icons-material/Computer";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import http from "../../utils/axios/http";

/**
 * Provider icon mapping for display in the login history table.
 */
const PROVIDER_ICONS = {
  google: <GoogleIcon sx={{ color: "#4285F4", fontSize: 20 }} />,
  apple: <AppleIcon sx={{ color: "#000000", fontSize: 20 }} />,
  facebook: <FacebookIcon sx={{ color: "#1877F2", fontSize: 20 }} />,
};

/**
 * Parse a userAgent string into a short device description.
 */
function parseDevice(userAgent) {
  if (!userAgent) return "Unknown device";

  if (/iPhone/i.test(userAgent)) return "iPhone";
  if (/iPad/i.test(userAgent)) return "iPad";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Macintosh|Mac OS/i.test(userAgent)) return "Mac";
  if (/Windows/i.test(userAgent)) return "Windows PC";
  if (/Linux/i.test(userAgent)) return "Linux";

  return "Unknown device";
}

/**
 * Format an ISO timestamp into a readable date/time string.
 */
function formatDateTime(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * LoginHistoryView — Settings page showing combined login history
 * (mobile + web) with suspicious activity alerts and "This wasn't me" action.
 *
 * Uses /authWeb/ prefixed endpoints for web-specific auth operations.
 */
export default function LoginHistoryView() {
  const navigate = useNavigate();

  const [entries, setEntries] = useState([]);
  const [lastKey, setLastKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [activeBlocks, setActiveBlocks] = useState([]);
  const [error, setError] = useState(null);
  const [notMeDialog, setNotMeDialog] = useState({ open: false, entry: null });
  const [notMeLoading, setNotMeLoading] = useState(false);

  /**
   * Fetch login history entries (paginated).
   */
  const fetchHistory = useCallback(async (paginationKey) => {
    try {
      const isLoadMore = !!paginationKey;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = { limit: 20 };
      if (paginationKey) {
        params.lastKey = paginationKey;
      }

      const response = await http.get("authWeb/login-history", { params });
      const data = response.data;

      if (isLoadMore) {
        setEntries((prev) => [...prev, ...(data.entries || [])]);
      } else {
        setEntries(data.entries || []);
      }
      setLastKey(data.lastKey || null);
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to load login history.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  /**
   * Fetch suspicious activity alerts.
   */
  const fetchSuspicious = useCallback(async () => {
    try {
      const response = await http.get("authWeb/login-history/suspicious");
      const data = response.data;
      setAlerts(data.alerts || []);
      setActiveBlocks(data.activeBlocks || []);
    } catch (err) {
      // Non-critical — don't block the page
      console.error("Failed to fetch suspicious activity:", err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    fetchSuspicious();
  }, [fetchHistory, fetchSuspicious]);

  /**
   * Handle "Load More" button click.
   */
  const handleLoadMore = () => {
    if (lastKey) {
      fetchHistory(lastKey);
    }
  };

  /**
   * Open the "This wasn't me" confirmation dialog.
   */
  const handleNotMeClick = (entry) => {
    setNotMeDialog({ open: true, entry });
  };

  /**
   * Confirm "This wasn't me" — revoke all sessions.
   */
  const handleNotMeConfirm = async () => {
    const entry = notMeDialog.entry;
    setNotMeDialog({ open: false, entry: null });
    setNotMeLoading(true);

    try {
      await http.post("authWeb/login-history/not-me", {
        entryTimestamp: entry.timestamp,
      });

      toast.success("All sessions revoked. Please log in again.");
      localStorage.clear();
      navigate("/login");
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Failed to revoke sessions. Please try again.";
      toast.error(message);
    } finally {
      setNotMeLoading(false);
    }
  };

  /**
   * Close the "This wasn't me" dialog without action.
   */
  const handleNotMeCancel = () => {
    setNotMeDialog({ open: false, entry: null });
  };

  /**
   * Get provider display with icon.
   */
  const renderProvider = (provider) => {
    const icon = PROVIDER_ICONS[provider];
    const label = provider
      ? provider.charAt(0).toUpperCase() + provider.slice(1)
      : "Unknown";

    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        {icon || null}
        <Typography variant="body2">{label}</Typography>
      </Box>
    );
  };

  /**
   * Render platform badge (mobile/web).
   */
  const renderPlatform = (platform) => {
    if (platform === "mobile") {
      return (
        <Chip
          icon={<PhoneAndroidIcon />}
          label="Mobile"
          size="small"
          variant="outlined"
          color="primary"
        />
      );
    }
    return (
      <Chip
        icon={<ComputerIcon />}
        label="Web"
        size="small"
        variant="outlined"
        color="secondary"
      />
    );
  };

  /**
   * Render success/fail status.
   */
  const renderStatus = (success) => {
    if (success) {
      return (
        <Chip
          icon={<CheckCircleOutlineIcon />}
          label="Success"
          size="small"
          color="success"
          variant="outlined"
        />
      );
    }
    return (
      <Chip
        icon={<ErrorOutlineIcon />}
        label="Failed"
        size="small"
        color="error"
        variant="outlined"
      />
    );
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: "auto", py: 4, px: 2 }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        Login History
      </Typography>

      {/* Suspicious Activity Alert Banner */}
      {(alerts.length > 0 || activeBlocks.length > 0) && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Suspicious activity detected
          </Typography>
          <Typography variant="body2">
            {alerts.length > 0 &&
              `${alerts.length} failed login attempt${alerts.length > 1 ? "s" : ""} in the last 24 hours. `}
            {activeBlocks.length > 0 &&
              `${activeBlocks.length} IP address${activeBlocks.length > 1 ? "es" : ""} currently blocked.`}
          </Typography>
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {entries.length === 0 ? (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              No login history found.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date/Time</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Device</TableCell>
                  <TableCell>Platform</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry, index) => (
                  <TableRow key={`${entry.timestamp}-${index}`}>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDateTime(entry.timestamp)}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderProvider(entry.provider)}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {parseDevice(entry.userAgent)}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderPlatform(entry.platform)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {entry.ipAddress || "—"}
                      </Typography>
                    </TableCell>
                    <TableCell>{renderStatus(entry.success)}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={() => handleNotMeClick(entry)}
                        disabled={notMeLoading}
                      >
                        This wasn't me
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Load More */}
          {lastKey && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
              <Button
                variant="outlined"
                onClick={handleLoadMore}
                disabled={loadingMore}
                startIcon={loadingMore ? <CircularProgress size={16} /> : null}
              >
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            </Box>
          )}
        </>
      )}

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        If you see a login you don't recognize, tap "This wasn't me" to revoke all
        active sessions and secure your account.
      </Typography>

      {/* "This wasn't me" Confirmation Dialog */}
      <Dialog open={notMeDialog.open} onClose={handleNotMeCancel}>
        <DialogTitle>Report Suspicious Login</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure this login wasn't you? This will immediately revoke all your
            active sessions on all devices. You will be logged out and need to sign in
            again.
          </DialogContentText>
          {notMeDialog.entry && (
            <Box sx={{ mt: 2, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Date:</strong> {formatDateTime(notMeDialog.entry.timestamp)}
              </Typography>
              <Typography variant="body2">
                <strong>IP:</strong> {notMeDialog.entry.ipAddress || "Unknown"}
              </Typography>
              <Typography variant="body2">
                <strong>Device:</strong> {parseDevice(notMeDialog.entry.userAgent)}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleNotMeCancel}>Cancel</Button>
          <Button
            onClick={handleNotMeConfirm}
            color="error"
            variant="contained"
            disabled={notMeLoading}
          >
            {notMeLoading ? "Revoking..." : "Revoke All Sessions"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
