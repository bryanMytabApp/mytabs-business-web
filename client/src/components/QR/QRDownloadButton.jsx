import React, { useState } from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { saveAs } from "file-saver";

/**
 * QRDownloadButton - Provides PNG and PDF download options for a QR code.
 *
 * Props:
 * - qrUrl (string): The full URL to encode in the QR code
 * - publicCode (string): The public code to display on the PDF
 * - entityName (string): Name of the entity (for PDF labeling and filename)
 *
 * Requirements: 4.3, 4.4
 */
export function QRDownloadButton({ qrUrl, publicCode, entityName }) {
  const [loadingPng, setLoadingPng] = useState(false);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const generatePngDataUrl = async () => {
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 1024,
      errorCorrectionLevel: "H",
      margin: 2,
    });
    return dataUrl;
  };

  const handleDownloadPng = async () => {
    setLoadingPng(true);
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: 1024,
        errorCorrectionLevel: "H",
        margin: 2,
      });
      // Convert data URL to blob for file-saver
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const filename = `${entityName || "qr-code"}-${publicCode}.png`.replace(
        /[^a-zA-Z0-9\-_.]/g,
        "_"
      );
      saveAs(blob, filename);
    } catch (err) {
      console.error("Failed to generate PNG:", err);
    } finally {
      setLoadingPng(false);
    }
  };

  const handleDownloadPdf = async () => {
    setLoadingPdf(true);
    try {
      const dataUrl = await generatePngDataUrl();

      // Create PDF at 4x6 inches
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: [4, 6],
      });

      // Add business name at top
      pdf.setFontSize(16);
      pdf.setFont("helvetica", "bold");
      const nameText = entityName || "Business";
      const nameWidth = pdf.getTextWidth(nameText);
      pdf.text(nameText, (4 - nameWidth) / 2, 0.6);

      // Add QR code centered, minimum 2x2 inches (using 2.5x2.5 for better layout)
      const qrSize = 2.5;
      const qrX = (4 - qrSize) / 2;
      const qrY = 1.0;
      pdf.addImage(dataUrl, "PNG", qrX, qrY, qrSize, qrSize);

      // Tabs pin logo overlay in center of QR
      const logoCenterX = qrX + qrSize / 2;
      const logoCenterY = qrY + qrSize / 2;
      pdf.setFillColor(255, 255, 255);
      pdf.circle(logoCenterX, logoCenterY, 0.22, 'F');
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 93, 0);
      const tabsW = pdf.getTextWidth("TABS");
      pdf.text("TABS", logoCenterX - tabsW / 2, logoCenterY + 0.03);
      pdf.setTextColor(0, 0, 0);

      // Add Public_Code text below QR
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "normal");
      const codeText = publicCode || "";
      const codeWidth = pdf.getTextWidth(codeText);
      pdf.text(codeText, (4 - codeWidth) / 2, qrY + qrSize + 0.4);

      // Add URL at bottom
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      const urlWidth = pdf.getTextWidth(qrUrl);
      const urlX = Math.max((4 - urlWidth) / 2, 0.25);
      pdf.text(qrUrl, urlX, 5.5, { maxWidth: 3.5 });

      const filename = `${entityName || "qr-code"}-${publicCode}.pdf`.replace(
        /[^a-zA-Z0-9\-_.]/g,
        "_"
      );
      pdf.save(filename);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setLoadingPdf(false);
    }
  };

  if (!qrUrl) return null;

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <Button
        variant="outlined"
        size="small"
        startIcon={
          loadingPng ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <DownloadIcon />
          )
        }
        onClick={handleDownloadPng}
        disabled={loadingPng || loadingPdf}
        sx={{ textTransform: "none" }}
      >
        Download PNG
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={
          loadingPdf ? (
            <CircularProgress size={16} color="inherit" />
          ) : (
            <PictureAsPdfIcon />
          )
        }
        onClick={handleDownloadPdf}
        disabled={loadingPng || loadingPdf}
        sx={{ textTransform: "none" }}
      >
        Download PDF
      </Button>
    </Box>
  );
}

export default QRDownloadButton;
