import React, { useState } from "react";
import QRCode from "react-qr-code";
import {
  Box,
  Typography,
  Button,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";

/**
 * QRCodePanel - Displays a QR code preview with the destination URL and copy functionality.
 *
 * Props:
 * - qrUrl (string): The full URL to encode in the QR code
 * - publicCode (string): The public code to display
 * - entityName (string): Name of the entity (for display)
 */
export function QRCodePanel({ qrUrl, publicCode, entityName }) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  if (!qrUrl) {
    return (
      <Box sx={{ p: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No QR code available. Generate a public code first.
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        p: 3,
      }}
    >
      {entityName && (
        <Typography variant="subtitle1" fontWeight={600}>
          {entityName}
        </Typography>
      )}

      <Box
        sx={{
          p: 2,
          backgroundColor: "#ffffff",
          borderRadius: 2,
          border: "1px solid #e0e0e0",
          display: "inline-flex",
        }}
      >
        <QRCode
          value={qrUrl}
          size={256}
          level="H"
          style={{ minWidth: 256, minHeight: 256 }}
        />
      </Box>

      {publicCode && (
        <Typography
          variant="body2"
          sx={{
            fontFamily: "monospace",
            fontSize: "0.9rem",
            color: "text.secondary",
            fontWeight: 500,
          }}
        >
          {publicCode}
        </Typography>
      )}

      <Typography
        variant="body2"
        sx={{
          wordBreak: "break-all",
          textAlign: "center",
          color: "text.primary",
          maxWidth: "100%",
        }}
      >
        {qrUrl}
      </Typography>

      <Tooltip
        title={copied ? "Copied!" : "Copy link to clipboard"}
        arrow
        open={copied || undefined}
      >
        <Button
          variant="outlined"
          size="small"
          startIcon={copied ? <CheckIcon /> : <ContentCopyIcon />}
          onClick={handleCopyLink}
          sx={{ textTransform: "none" }}
        >
          {copied ? "Copied" : "Copy Link"}
        </Button>
      </Tooltip>
    </Box>
  );
}

export default QRCodePanel;
