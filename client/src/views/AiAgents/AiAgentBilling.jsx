import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { getMyServices, deactivateService } from "../../services/entitlementService";
import { getCustomerInvoices } from "../../services/paymentService";

/**
 * AI Agent tier metadata for display purposes.
 */
const TIER_META = {
  ai_agent_starter: {
    name: "Starter",
    tokenPool: 500000,
    tokenPoolLabel: "500K",
    price: "$99/mo",
  },
  ai_agent_pro: {
    name: "Pro",
    tokenPool: 2000000,
    tokenPoolLabel: "2M",
    price: "$299/mo",
  },
  ai_agent_enterprise: {
    name: "Enterprise",
    tokenPool: 10000000,
    tokenPoolLabel: "10M",
    price: "$799/mo",
  },
  ai_agent_organization: {
    name: "Organization",
    tokenPool: Infinity,
    tokenPoolLabel: "Unlimited",
    price: "Custom",
  },
};

/**
 * Format token count to human-readable string.
 */
const formatTokens = (count) => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
  return String(count);
};

/**
 * AiAgentBilling
 *
 * Billing section for AI Agent subscription management.
 * Shows: current tier, usage summary (tokens used/allocated), next billing date.
 * Provides cancel functionality with confirmation modal.
 * Displays invoices using existing getCustomerInvoices().
 */
const AiAgentBilling = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTier, setActiveTier] = useState(null);
  const [entitlement, setEntitlement] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [services, invoiceData] = await Promise.all([
          getMyServices(),
          getCustomerInvoices().catch(() => []),
        ]);

        // Find the active AI agent entitlement
        const aiService = (services || []).find(
          (s) => s.id?.startsWith("ai_agent_") && s.status === "active"
        );

        if (aiService) {
          setEntitlement(aiService);
          setActiveTier(TIER_META[aiService.id] || null);
        }

        // Filter invoices related to AI Agent if possible, or show all
        setInvoices(Array.isArray(invoiceData) ? invoiceData : invoiceData?.invoices || []);
      } catch (err) {
        console.error("Failed to fetch billing data:", err);
        setError("Unable to load billing information. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCancelConfirm = async () => {
    setCancelling(true);
    setCancelError(null);
    try {
      await deactivateService(entitlement.id);
      setCancelled(true);
      setCancelDialogOpen(false);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to cancel subscription. Please try again.";
      setCancelError(msg);
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "40vh",
        }}
      >
        <CircularProgress sx={{ color: "#F09925" }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!activeTier || cancelled) {
    return (
      <Paper sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <AutoAwesomeIcon sx={{ color: "#F09925" }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#1D1B20" }}>
            AI Event Discovery Agents
          </Typography>
        </Box>
        <Typography sx={{ color: "#71727A", fontSize: 14 }}>
          {cancelled
            ? "Your AI Agent subscription has been cancelled."
            : "No active AI Agent subscription."}
        </Typography>
      </Paper>
    );
  }

  // Calculate usage (from entitlement metadata if available)
  const tokensUsed = entitlement?.usage?.tokensUsed || 0;
  const tokensAllocated = activeTier.tokenPool;
  const usagePercent =
    tokensAllocated === Infinity ? 0 : Math.min((tokensUsed / tokensAllocated) * 100, 100);
  const nextBillingDate = entitlement?.nextBillingDate
    ? new Date(entitlement.nextBillingDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <Box>
      {/* Header section */}
      <Paper sx={{ p: 3, borderRadius: 2, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <AutoAwesomeIcon sx={{ color: "#F09925" }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: "#1D1B20" }}>
            AI Event Discovery Agents
          </Typography>
        </Box>

        {/* Current tier */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
            mb: 2,
          }}
        >
          <Box>
            <Typography sx={{ fontSize: 13, color: "#71727A", fontWeight: 600 }}>
              Current Plan
            </Typography>
            <Typography sx={{ fontSize: 20, fontWeight: 800, color: "#1D1B20" }}>
              {activeTier.name}{" "}
              <Typography component="span" sx={{ fontSize: 14, color: "#71727A", fontWeight: 500 }}>
                — {activeTier.price}
              </Typography>
            </Typography>
          </Box>
          {nextBillingDate && (
            <Box sx={{ textAlign: "right" }}>
              <Typography sx={{ fontSize: 13, color: "#71727A", fontWeight: 600 }}>
                Next Billing Date
              </Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: "#1D1B20" }}>
                {nextBillingDate}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Usage summary */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
            <Typography sx={{ fontSize: 13, color: "#71727A", fontWeight: 600 }}>
              Token Usage
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#71727A", fontWeight: 600 }}>
              {formatTokens(tokensUsed)} / {activeTier.tokenPoolLabel}
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={usagePercent}
            sx={{
              height: 8,
              borderRadius: 4,
              backgroundColor: "#E0E0E0",
              "& .MuiLinearProgress-bar": {
                borderRadius: 4,
                background:
                  usagePercent > 80
                    ? "#F44336"
                    : usagePercent > 60
                    ? "#FF9800"
                    : "#4CAF50",
              },
            }}
          />
        </Box>

        {/* Cancel button */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <Button
            variant="outlined"
            color="error"
            size="small"
            onClick={() => setCancelDialogOpen(true)}
            sx={{
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            Cancel AI Agent
          </Button>
        </Box>
      </Paper>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <Paper sx={{ p: 3, borderRadius: 2 }}>
          <Typography
            variant="h6"
            sx={{ fontWeight: 700, color: "#1D1B20", mb: 2, fontSize: 16 }}
          >
            Invoice History
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.slice(0, 10).map((invoice, idx) => (
                  <TableRow key={invoice.id || idx}>
                    <TableCell>
                      {invoice.date
                        ? new Date(invoice.date * 1000).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {invoice.amount_due != null
                        ? `$${(invoice.amount_due / 100).toFixed(2)}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={invoice.status || "unknown"}
                        size="small"
                        color={invoice.status === "paid" ? "success" : "default"}
                        sx={{ fontSize: 11, fontWeight: 600 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Cancel confirmation dialog */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        aria-labelledby="cancel-dialog-title"
      >
        <DialogTitle id="cancel-dialog-title" sx={{ fontWeight: 700 }}>
          Cancel AI Agent Subscription?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will deactivate your AI Agent subscription. Your agents will stop
            running and draft events will be retained for 30 days. You can
            resubscribe at any time.
          </DialogContentText>
          {cancelError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {cancelError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCancelDialogOpen(false)}
            disabled={cancelling}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Keep Subscription
          </Button>
          <Button
            onClick={handleCancelConfirm}
            disabled={cancelling}
            variant="contained"
            color="error"
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {cancelling ? (
              <CircularProgress size={18} sx={{ color: "#fff" }} />
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AiAgentBilling;
