import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Chip,
} from "@mui/material";
import EventIcon from "@mui/icons-material/Event";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import QRCode from "react-qr-code";
import http from "../../utils/axios/http";
import { QRDownloadButton } from "./QRDownloadButton";

/**
 * EventQRPanel - Provides event QR code generation on the event edit screen.
 * Generates Event_Code in format BIZ-XXX-EVT-XXXX and displays the QR code
 * with the resolved destination URL.
 *
 * Props:
 * - eventId (string): UUID of the event
 * - businessCode (string): The hosting business's code segment
 * - eventCode (string, optional): Existing event code if already generated
 *
 * Requirements: 6.1, 6.7
 */
export function EventQRPanel({ eventId, businessCode, eventCode: initialEventCode }) {
  const [eventCode, setEventCode] = useState(initialEventCode || null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const qrUrl = eventCode ? `https://keeptabs.app/e/${eventCode}` : null;

  const handleGenerateEventCode = async () => {
    if (!eventId || !businessCode) return;

    setGenerating(true);
    setError(null);

    try {
      const response = await http.post("/api/codes/generate", {
        entityType: "event",
        entityId: eventId,
        businessCode: businessCode,
      });

      if (response.data?.publicCode) {
        setEventCode(response.data.publicCode);
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to generate event QR code.";
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <EventIcon />
        Event QR Code
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {!eventCode ? (
        /* No event code yet - show generation option */
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Generate a unique Event_Code for this event. The code will follow the
            format <code>BIZ-XXX-EVT-XXXX</code> and can be used on promotional
            materials and tickets.
          </Typography>

          {!businessCode && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              A Business_Code must be assigned to the hosting business before an
              event QR code can be generated.
            </Alert>
          )}

          <Button
            variant="contained"
            startIcon={
              generating ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <QrCode2Icon />
              )
            }
            onClick={handleGenerateEventCode}
            disabled={generating || !businessCode || !eventId}
            sx={{ textTransform: "none" }}
          >
            {generating ? "Generating..." : "Generate Event QR Code"}
          </Button>
        </Box>
      ) : (
        /* Event code exists - show QR code and details */
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Chip
            label={eventCode}
            color="primary"
            variant="outlined"
            sx={{ fontFamily: "monospace", fontSize: "0.9rem" }}
          />

          <Box
            sx={{
              p: 2,
              backgroundColor: "#ffffff",
              borderRadius: 2,
              border: "1px solid #e0e0e0",
              display: "inline-flex",
            }}
          >
            <QRCode value={qrUrl} size={200} level="H" />
          </Box>

          <Typography
            variant="body2"
            sx={{
              wordBreak: "break-all",
              textAlign: "center",
              color: "text.primary",
            }}
          >
            {qrUrl}
          </Typography>

          <QRDownloadButton
            qrUrl={qrUrl}
            publicCode={eventCode}
            entityName="Event"
          />
        </Box>
      )}
    </Paper>
  );
}

export default EventQRPanel;
