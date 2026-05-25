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
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

/**
 * BatchPDFGenerator - Allows selecting 2+ businesses for batch PDF generation.
 * Generates uniform 4x6 inch PDFs with Tabs logo, business name, and QR code.
 * Handles partial failures with error summary.
 *
 * Props:
 * - businesses (array): Array of { businessCode, name }
 * - selectedIds (array): Pre-selected business codes
 *
 * Requirements: 9.3, 9.6
 */
export function BatchPDFGenerator({ businesses = [], selectedIds = [] }) {
  const [selected, setSelected] = useState(new Set(selectedIds));
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState([]);
  const [completed, setCompleted] = useState(false);

  const handleToggle = (businessCode) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(businessCode)) {
        next.delete(businessCode);
      } else {
        next.add(businessCode);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === businesses.filter((b) => b.businessCode).length) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(businesses.filter((b) => b.businessCode).map((b) => b.businessCode))
      );
    }
  };

  const handleGenerateBatch = async () => {
    const selectedBusinesses = businesses.filter(
      (b) => b.businessCode && selected.has(b.businessCode)
    );

    if (selectedBusinesses.length < 2) return;

    setGenerating(true);
    setProgress(0);
    setErrors([]);
    setCompleted(false);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: [4, 6],
    });

    const failedItems = [];
    const total = selectedBusinesses.length;
    let pagesAdded = 0;

    for (let i = 0; i < total; i++) {
      const biz = selectedBusinesses[i];

      try {
        const qrUrl = `https://keeptabs.app/b/${biz.businessCode}`;
        const dataUrl = await QRCode.toDataURL(qrUrl, {
          width: 1024,
          errorCorrectionLevel: "H",
          margin: 2,
        });

        // Add new page for all except the first
        if (pagesAdded > 0) {
          pdf.addPage([4, 6]);
        }

        // Add Tabs logo text (placeholder since we don't have the actual logo file)
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(79, 70, 229); // Tabs brand purple
        const logoText = "TABS";
        const logoWidth = pdf.getTextWidth(logoText);
        pdf.text(logoText, (4 - logoWidth) / 2, 0.4);

        // Add business name
        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        const nameText = biz.name || "Business";
        const nameWidth = pdf.getTextWidth(nameText);
        pdf.text(nameText, (4 - nameWidth) / 2, 0.8);

        // Add QR code centered (2.5x2.5 inches)
        const qrSize = 2.5;
        const qrX = (4 - qrSize) / 2;
        const qrY = 1.2;
        pdf.addImage(dataUrl, "PNG", qrX, qrY, qrSize, qrSize);

        // Add Business_Code below QR
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        const codeText = biz.businessCode;
        const codeWidth = pdf.getTextWidth(codeText);
        pdf.text(codeText, (4 - codeWidth) / 2, qrY + qrSize + 0.4);

        // Add URL at bottom
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        const urlText = qrUrl;
        const urlWidth = pdf.getTextWidth(urlText);
        pdf.text(urlText, Math.max((4 - urlWidth) / 2, 0.25), 5.5, {
          maxWidth: 3.5,
        });

        pagesAdded++;
      } catch (err) {
        failedItems.push({
          name: biz.name || biz.businessCode,
          reason: err.message || "PDF page generation failed",
        });
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    // Save PDF if at least one page was generated
    if (pagesAdded > 0) {
      try {
        const pdfBlob = pdf.output("blob");
        saveAs(pdfBlob, "qr-codes-batch.pdf");
      } catch (err) {
        failedItems.push({
          name: "PDF Save",
          reason: err.message || "Failed to save PDF file",
        });
      }
    }

    setErrors(failedItems);
    setCompleted(true);
    setGenerating(false);
  };

  const eligibleBusinesses = businesses.filter((b) => b.businessCode);
  const selectedCount = selected.size;
  const canGenerate = selectedCount >= 2;

  if (!businesses || businesses.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No businesses available for batch PDF generation.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <PictureAsPdfIcon />
        Batch PDF Generation
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Select 2 or more businesses to generate a multi-page PDF with uniform
        4×6 inch QR code layouts.
      </Typography>

      {/* Select all */}
      <FormControlLabel
        control={
          <Checkbox
            checked={selected.size === eligibleBusinesses.length && eligibleBusinesses.length > 0}
            indeterminate={selected.size > 0 && selected.size < eligibleBusinesses.length}
            onChange={handleSelectAll}
            size="small"
          />
        }
        label={
          <Typography variant="body2">
            Select all ({eligibleBusinesses.length})
          </Typography>
        }
        sx={{ mb: 1 }}
      />

      {/* Business list with checkboxes */}
      <Paper variant="outlined" sx={{ maxHeight: 240, overflow: "auto", mb: 2 }}>
        <List dense>
          {businesses.map((biz, idx) => {
            const hasCode = !!biz.businessCode;
            return (
              <ListItem key={idx} disablePadding sx={{ px: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={hasCode && selected.has(biz.businessCode)}
                      onChange={() => hasCode && handleToggle(biz.businessCode)}
                      disabled={!hasCode}
                      size="small"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {biz.name || "Unnamed Business"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                        {biz.businessCode || "No code assigned"}
                      </Typography>
                    </Box>
                  }
                  sx={{ width: "100%", m: 0, py: 0.5 }}
                />
              </ListItem>
            );
          })}
        </List>
      </Paper>

      {/* Progress bar */}
      {generating && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress variant="determinate" value={progress} sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary">
            Generating PDFs... {progress}%
          </Typography>
        </Box>
      )}

      {/* Generate button */}
      <Button
        variant="contained"
        startIcon={
          generating ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <PictureAsPdfIcon />
          )
        }
        onClick={handleGenerateBatch}
        disabled={generating || !canGenerate}
        sx={{ textTransform: "none", mb: 2 }}
      >
        {generating
          ? "Generating..."
          : `Generate Batch PDF (${selectedCount} selected)`}
      </Button>

      {!canGenerate && selectedCount > 0 && (
        <Typography variant="caption" color="error" display="block" sx={{ mb: 1 }}>
          Select at least 2 businesses to generate a batch PDF.
        </Typography>
      )}

      {/* Success message */}
      {completed && errors.length === 0 && (
        <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ mb: 2 }}>
          Batch PDF generated successfully for {selectedCount} businesses.
        </Alert>
      )}

      {/* Error summary */}
      {completed && errors.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Alert severity="warning" sx={{ mb: 1 }}>
            {errors.length} of {selectedCount} businesses failed. The remaining
            pages were included in the PDF.
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

export default BatchPDFGenerator;
