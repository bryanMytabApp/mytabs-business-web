import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
} from "@mui/material";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { getFulfillment, updateFulfillment } from "../../services/experienceService";

const ACCENT = "#F09925";

const FULFILLMENT_COLUMNS = [
  { key: "Claimed", label: "Claimed", color: "#2196F3" },
  { key: "Preparing", label: "Preparing", color: "#FF9800" },
  { key: "Shipped", label: "Shipped", color: "#9C27B0" },
  { key: "InTransit", label: "In Transit", color: "#00BCD4" },
  { key: "Delivered", label: "Delivered", color: "#4CAF50" },
  { key: "Failed", label: "Failed", color: "#E53935" },
];

const STATUS_TRANSITIONS = {
  Claimed: ["Preparing", "Failed"],
  Preparing: ["Shipped", "Failed"],
  Shipped: ["InTransit", "Delivered", "Failed"],
  InTransit: ["Delivered", "Failed"],
  Delivered: [],
  Failed: ["Preparing"],
};

const OVERDUE_DAYS = 7;

const FulfillmentManagement = () => {
  const { eventId, experienceId } = useParams();

  // Data state
  const [fulfillmentItems, setFulfillmentItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Update dialog state
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await getFulfillment(eventId, experienceId, {});
      setFulfillmentItems(res.data?.data?.items || res.data?.items || []);
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to load fulfillment data";
      setFetchError(msg);
    } finally {
      setLoading(false);
    }
  }, [eventId, experienceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getDaysInStatus = (item) => {
    if (!item.statusUpdatedAt) return 0;
    const now = new Date();
    const updated = new Date(item.statusUpdatedAt);
    return Math.floor((now - updated) / (1000 * 60 * 60 * 24));
  };

  const isOverdue = (item) => {
    return getDaysInStatus(item) >= OVERDUE_DAYS;
  };

  const getItemsByStatus = (status) => {
    return fulfillmentItems.filter((item) => item.status === status);
  };

  const handleOpenUpdateDialog = (item) => {
    setSelectedItem(item);
    setNewStatus("");
    setCarrierName(item.carrierName || "");
    setTrackingNumber(item.trackingNumber || "");
    setUpdateError(null);
    setUpdateDialogOpen(true);
  };

  const handleCloseUpdateDialog = () => {
    setUpdateDialogOpen(false);
    setSelectedItem(null);
    setNewStatus("");
    setCarrierName("");
    setTrackingNumber("");
    setUpdateError(null);
  };

  const handleUpdateFulfillment = async () => {
    if (!newStatus) {
      setUpdateError("Please select a new status");
      return;
    }

    // Require carrier and tracking for Shipped status
    if (newStatus === "Shipped") {
      if (!carrierName.trim()) {
        setUpdateError("Carrier name is required when shipping");
        return;
      }
      if (!trackingNumber.trim()) {
        setUpdateError("Tracking number is required when shipping");
        return;
      }
    }

    setUpdating(true);
    setUpdateError(null);
    try {
      const payload = {
        entryId: selectedItem.entryId,
        status: newStatus,
      };
      if (newStatus === "Shipped" || carrierName.trim()) {
        payload.carrierName = carrierName.trim();
      }
      if (newStatus === "Shipped" || trackingNumber.trim()) {
        payload.trackingNumber = trackingNumber.trim();
      }

      await updateFulfillment(eventId, experienceId, payload);
      handleCloseUpdateDialog();
      fetchData();
    } catch (err) {
      const msg =
        err.response?.data?.message || err.message || "Failed to update fulfillment";
      setUpdateError(msg);
    } finally {
      setUpdating(false);
    }
  };

  const availableTransitions = selectedItem
    ? STATUS_TRANSITIONS[selectedItem.status] || []
    : [];

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          mb: 3,
          gap: 1,
        }}
      >
        <Box>
          <Typography
            variant="h5"
            sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.25rem", md: "1.5rem" } }}
          >
            Fulfillment Management
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            Track and manage prize shipping and delivery status.
          </Typography>
        </Box>
        <IconButton onClick={fetchData} sx={{ color: ACCENT }} title="Refresh">
          <RefreshIcon />
        </IconButton>
      </Box>

      {/* Error Alert */}
      {fetchError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {fetchError}
        </Alert>
      )}

      {/* Kanban Board */}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          pb: 2,
          minHeight: 400,
        }}
      >
        {FULFILLMENT_COLUMNS.map((column) => {
          const items = getItemsByStatus(column.key);
          return (
            <Box
              key={column.key}
              sx={{
                minWidth: 220,
                maxWidth: 280,
                flex: "1 0 220px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Column Header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mb: 1.5,
                  pb: 1,
                  borderBottom: `3px solid ${column.color}`,
                }}
              >
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 13,
                    color: "#1D1B20",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {column.label}
                </Typography>
                <Chip
                  size="small"
                  label={items.length}
                  sx={{
                    fontWeight: 700,
                    fontSize: 11,
                    height: 20,
                    background: `${column.color}18`,
                    color: column.color,
                  }}
                />
              </Box>

              {/* Column Cards */}
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 1.5,
                  overflowY: "auto",
                  maxHeight: "calc(100vh - 300px)",
                  pr: 0.5,
                }}
              >
                {items.length === 0 ? (
                  <Box
                    sx={{
                      p: 2,
                      textAlign: "center",
                      border: "1.5px dashed #E0E0E0",
                      borderRadius: 2,
                      background: "#FAFAFA",
                    }}
                  >
                    <Typography sx={{ color: "#BDBDBD", fontSize: 12, fontWeight: 500 }}>
                      No items
                    </Typography>
                  </Box>
                ) : (
                  items.map((item) => {
                    const daysInStatus = getDaysInStatus(item);
                    const overdue = isOverdue(item);

                    return (
                      <Card
                        key={item.entryId}
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          borderColor: overdue ? "#E53935" : "#E8E8E8",
                          background: overdue ? "#FFF5F5" : "#FFFFFF",
                          transition: "box-shadow 0.2s, border-color 0.2s",
                          "&:hover": {
                            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                            borderColor: overdue ? "#E53935" : ACCENT,
                          },
                        }}
                      >
                        <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                          {/* Winner Name */}
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Typography
                              sx={{
                                fontWeight: 700,
                                fontSize: 13,
                                color: "#1D1B20",
                                lineHeight: 1.3,
                              }}
                            >
                              {item.winnerName || "Unknown"}
                            </Typography>
                            {overdue && (
                              <WarningAmberIcon
                                sx={{ color: "#E53935", fontSize: 16 }}
                                titleAccess="Overdue — more than 7 days in this status"
                              />
                            )}
                          </Box>

                          {/* Prize */}
                          <Typography
                            sx={{
                              fontSize: 12,
                              color: "#616161",
                              mb: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {item.prizeName || "—"}
                          </Typography>

                          {/* Days in status */}
                          <Chip
                            size="small"
                            label={`${daysInStatus} day${daysInStatus !== 1 ? "s" : ""}`}
                            sx={{
                              fontSize: 10,
                              fontWeight: 600,
                              height: 18,
                              background: overdue ? "#FFEBEE" : "#F5F5F5",
                              color: overdue ? "#E53935" : "#757575",
                              mb: 1,
                            }}
                          />

                          {/* Carrier/tracking info (if shipped or beyond) */}
                          {(item.carrierName || item.trackingNumber) && (
                            <Box sx={{ mt: 0.5, mb: 1 }}>
                              {item.carrierName && (
                                <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
                                  <LocalShippingIcon sx={{ fontSize: 12, mr: 0.5, verticalAlign: "middle" }} />
                                  {item.carrierName}
                                </Typography>
                              )}
                              {item.trackingNumber && (
                                <Typography
                                  sx={{
                                    fontSize: 11,
                                    color: "#616161",
                                    fontFamily: "monospace",
                                    mt: 0.25,
                                  }}
                                >
                                  #{item.trackingNumber}
                                </Typography>
                              )}
                            </Box>
                          )}

                          {/* Update Button */}
                          {(STATUS_TRANSITIONS[item.status] || []).length > 0 && (
                            <Button
                              size="small"
                              startIcon={<EditIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleOpenUpdateDialog(item)}
                              sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                fontSize: 11,
                                color: ACCENT,
                                px: 1,
                                py: 0.25,
                                borderRadius: 1.5,
                                "&:hover": { background: `${ACCENT}12` },
                              }}
                            >
                              Update Status
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Update Status Dialog */}
      <Dialog
        open={updateDialogOpen}
        onClose={handleCloseUpdateDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18 }}>
          Update Fulfillment Status
        </DialogTitle>
        <DialogContent>
          {selectedItem && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={{ fontSize: 13, color: "#71727A", mb: 0.5 }}>
                Winner: <strong>{selectedItem.winnerName || "Unknown"}</strong>
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#71727A" }}>
                Prize: <strong>{selectedItem.prizeName || "—"}</strong>
              </Typography>
              <Typography sx={{ fontSize: 12, color: "#9E9E9E", mt: 0.5 }}>
                Current status:{" "}
                <Chip
                  size="small"
                  label={selectedItem.status}
                  sx={{ fontSize: 11, fontWeight: 600 }}
                />
              </Typography>
            </Box>
          )}

          <TextField
            select
            label="New Status"
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value)}
            fullWidth
            sx={{ mb: 2, mt: 1 }}
            size="small"
          >
            {availableTransitions.map((status) => (
              <MenuItem key={status} value={status}>
                {FULFILLMENT_COLUMNS.find((c) => c.key === status)?.label || status}
              </MenuItem>
            ))}
          </TextField>

          {/* Show carrier/tracking fields when transitioning to Shipped */}
          {newStatus === "Shipped" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <TextField
                label="Carrier Name"
                placeholder="e.g. UPS, FedEx, USPS..."
                value={carrierName}
                onChange={(e) => setCarrierName(e.target.value)}
                fullWidth
                required
                size="small"
                error={!!updateError && !carrierName.trim()}
              />
              <TextField
                label="Tracking Number"
                placeholder="Enter tracking number..."
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                fullWidth
                required
                size="small"
                error={!!updateError && !trackingNumber.trim()}
              />
            </Box>
          )}

          {updateError && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {updateError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={handleCloseUpdateDialog}
            sx={{ textTransform: "none", color: "#71727A", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdateFulfillment}
            disabled={updating || !newStatus}
            sx={{
              background: ACCENT,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              "&:hover": { background: "#D4820F" },
            }}
          >
            {updating ? (
              <CircularProgress size={20} sx={{ color: "#fff" }} />
            ) : (
              "Update Status"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FulfillmentManagement;
