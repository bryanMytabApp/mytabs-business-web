import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  LinearProgress,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import QRCode from "qrcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";

/**
 * BulkQRDownload - Generates a ZIP file containing QR PNG images (1024x1024px)
 * for all businesses in the organization. Names each file using the business's Business_Code.
 * Handles partial failures gracefully.
 *
 * Props:
 * - businesses (array): Array of { businessCode, name }
 *
 * Requirements: 9.2, 9.6
 */
export function BulkQRDownload({ businesses = [] }) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState([]);
  const [completed, setCompleted] = useState(false);

  const handleBulkDownload = async () => {
    if (!businesses || businesses.length === 0) return;

    setGenerating(true);
    setProgress(0);
    setErrors([]);
    setCompleted(false);

    const zip = new JSZip();
    const failedItems = [];
    const total = businesses.length;

    for (let i = 0; i < total; i++) {
      const biz = businesses[i];

      try {
        if (!biz.businessCode) {
          failedItems.push({
            name: biz.name || `Business ${i + 1}`,
            reason: "No Business_Code assigned",
          });
          continue;
        }

        const qrUrl = `https://keeptabs.app/b/${biz.businessCode}`;
        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 1024,
          errorCorrectionLevel: "H",
          margin: 2,
        });

        // Convert data URL to binary
        const base64Data = dataUrl.split(",")[1];
        const filename = `${biz.businessCode}.png`.replace(
          /[^a-zA-Z0-9\-_.]/g,
          "_"
        );
        zip.file(filename, base64Data, { base64: true });
      } catch (err) {
        failedItems.push({
          name: biz.name || biz.businessCode || `Business ${i + 1}`,
          reason: err.message || "QR generation failed",
        });
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Generate and download ZIP if at least one succeeded
    const fileCount = Object.keys(zip.files).length;
    if (fileCount > 0) {
      try {
        const blob = await zip.generateAsync({ type: "blob" });
        saveAs(blob, "qr-codes-bulk.zip");
      } catch (err) {
        failedItems.push({
          name: "ZIP Generation",
          reason: err.message || "Failed to create ZIP file",
        });
      }
    }

    setErrors(failedItems);
    setCompleted(true);
    setGenerating(false);
  };

  if (!businesses || businesses.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No businesses available for bulk QR download.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <FolderZipIcon />
        Bulk QR Download
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Download a ZIP file containing 1024×1024px PNG QR codes for all{" "}
        {businesses.length} business{businesses.length !== 1 ? "es" : ""}.
      </Typography>

      {/* Progress bar */}
      {generating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Generating QR codes... {progress}%
          </Typography>
        </Box>
      )}

      {/* Download button */}
      <Button
        variant="contained"
        startIcon={
          generating ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <DownloadIcon />
          )
        }
        onClick={handleBulkDownload}
        disabled={generating}
        sx={{ textTransform: "none", mb: 2 }}
      >
        {generating
          ? "Generating..."
          : `Download All QR Codes (${businesses.length})`}
      </Button>

      {/* Success message */}
      {completed && errors.length === 0 && (
        <Alert
          severity="success"
          icon={<CheckCircleOutlineIcon />}
          sx={{ mb: 2 }}
        >
          All {businesses.length} QR codes generated and downloaded successfully.
        </Alert>
      )}

      {/* Error summary */}
      {completed && errors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {errors.length} of {businesses.length} businesses failed. The
            remaining QR codes were included in the ZIP.
          </Alert>
          <List dense>
            {errors.map((err, idx) => (
              <ListItem key={idx} disablePadding sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <ErrorOutlineIcon fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={err.name}
                  secondary={err.reason}
                  primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}

export default BulkQRDownload;
