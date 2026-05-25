import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import QRCode from "react-qr-code";
import QRCodeLib from "qrcode";
import { jsPDF } from "jspdf";
import tabsLogo from "../../assets/logo.png";
import qrDoorSticker from "../../assets/QRCode_door_sticker.png";

/**
 * PrintAssetGenerator - Generates print-ready PDF assets with predefined templates.
 *
 * Props:
 * - qrUrl (string): The full URL to encode in the QR code
 * - publicCode (string): The public code to display
 * - entityName (string): Name of the entity
 * - logoUrl (string, optional): URL of the business logo/icon
 * - onGenerate (function, optional): Callback after successful generation
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

const TEMPLATES = [
  { id: "door-sticker", label: "Door Sticker", width: 3, height: 3 },
  { id: "table-tent", label: "Table Tent", width: 4, height: 6 },
  { id: "branded-flyer", label: "Branded Flyer", width: 8.5, height: 8.5 },
  { id: "flyer", label: "Flyer", width: 8.5, height: 11 },
];

const BLEED = 0.125; // inches
const CROP_MARK_LENGTH = 0.25; // inches

/**
 * Generates the branded flyer PDF layout matching the Tabs template:
 * - Uses QRCode_door_sticker.png as the full background (already has logo, "&", blue dot,
 *   white block, and "Find Your World" text baked in)
 * - QR code centered in the middle of the white block
 * - Business icon overlay in the center of the QR code (matching the business QR style)
 */
async function generateBrandedFlyer(pdf, contentX, contentY, contentW, contentH, qrUrl, logoUrl, entityName) {
  const WHITE = [255, 255, 255];
  const centerX = contentX + contentW / 2;

  // --- Load and draw the background template image (QRCode_door_sticker.png) ---
  try {
    const bgImg = new Image();
    bgImg.crossOrigin = "anonymous";
    await new Promise((resolve, reject) => {
      bgImg.onload = resolve;
      bgImg.onerror = reject;
      bgImg.src = qrDoorSticker;
    });

    const bgCanvas = document.createElement("canvas");
    bgCanvas.width = bgImg.width;
    bgCanvas.height = bgImg.height;
    const bgCtx = bgCanvas.getContext("2d");
    bgCtx.drawImage(bgImg, 0, 0);
    const bgDataUrl = bgCanvas.toDataURL("image/png");

    // Draw background image to fill the entire content area
    pdf.addImage(bgDataUrl, "PNG", contentX, contentY, contentW, contentH);
  } catch (bgErr) {
    // Fallback: draw the orange/blue background manually
    console.warn("Background image failed to load, using fallback colors.");
    const ORANGE = [240, 153, 37];
    const BLUE = [100, 181, 214];
    const halfH = contentH / 2;
    pdf.setFillColor(...ORANGE);
    pdf.rect(contentX, contentY, contentW, halfH + 0.5, "F");
    pdf.setFillColor(...BLUE);
    pdf.rect(contentX, contentY + halfH - 0.5, contentW, halfH + 0.5, "F");

    // Draw white block in center
    const blockW = contentW * 0.48;
    const blockH = blockW;
    pdf.setFillColor(...WHITE);
    pdf.rect(centerX - blockW / 2, contentY + (contentH - blockH) / 2, blockW, blockH, "F");
  }

  // --- Business Logo overlay on the blue dot area (top-right of orange section) ---
  // The blue dot in the template is approximately at 65% from left, 14% from top
  const dotX = contentX + contentW * 0.65;
  const dotY = contentY + contentH * 0.14;
  const dotAreaSize = 1.5; // larger size for the overlay area in inches

  if (logoUrl) {
    console.log("🖼️ Attempting to load business logo:", logoUrl);
    try {
      const bizImg = new Image();
      bizImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        bizImg.onload = () => {
          console.log("✅ Business logo loaded successfully:", logoUrl, "Size:", bizImg.width, "x", bizImg.height);
          resolve();
        };
        bizImg.onerror = (err) => {
          console.error("❌ Business logo failed to load:", logoUrl, "Error:", err);
          reject(err);
        };
        bizImg.src = logoUrl;
      });

      const bizCanvas = document.createElement("canvas");
      bizCanvas.width = bizImg.width;
      bizCanvas.height = bizImg.height;
      const bizCtx = bizCanvas.getContext("2d");
      bizCtx.drawImage(bizImg, 0, 0);
      const bizLogoDataUrl = bizCanvas.toDataURL("image/png");
      console.log("✅ Business logo converted to data URL, length:", bizLogoDataUrl.length);

      // White background behind the logo
      pdf.setFillColor(255, 255, 255);
      pdf.rect(dotX - dotAreaSize / 2, dotY - dotAreaSize / 2, dotAreaSize, dotAreaSize, "F");

      // Draw business logo centered on top of white background
      // Add small padding so logo doesn't touch edges
      const logoPad = 0.1;
      pdf.addImage(
        bizLogoDataUrl,
        "PNG",
        dotX - dotAreaSize / 2 + logoPad,
        dotY - dotAreaSize / 2 + logoPad,
        dotAreaSize - logoPad * 2,
        dotAreaSize - logoPad * 2
      );
      console.log("✅ Business logo added to PDF successfully");
    } catch (logoErr) {
      // Logo URL exists but failed to load (CORS or network issue)
      console.error("❌ Business logo catch block - URL:", logoUrl);
      console.error("❌ Error details:", logoErr);
      console.error("❌ Error type:", typeof logoErr, "Message:", logoErr?.message || logoErr?.type || "unknown");
      // Show white box with business name instead
      pdf.setFillColor(255, 255, 255);
      pdf.rect(dotX - dotAreaSize / 2, dotY - dotAreaSize / 2, dotAreaSize, dotAreaSize, "F");
      if (entityName) {
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        const nameW = pdf.getTextWidth(entityName);
        pdf.text(entityName, dotX - nameW / 2, dotY + 0.05);
      }
    }
  } else {
    console.log("⚠️ No logoUrl provided for business, using black box fallback");
    // No logo provided — draw a filled black box centered on the blue dot
    // with business name text on top
    pdf.setFillColor(0, 0, 0);
    pdf.rect(dotX - dotAreaSize / 2, dotY - dotAreaSize / 2, dotAreaSize, dotAreaSize, "F");
    if (entityName) {
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);
      const nameW = pdf.getTextWidth(entityName);
      pdf.text(entityName, dotX - nameW / 2, dotY + 0.05);
    }
  }

  // --- QR Code (centered in the white block) ---
  // The white block in the background image is centered horizontally and vertically
  // It spans roughly 48% of the width and is vertically centered in the image
  const blockSize = contentW * 0.48;
  const qrPadding = 0.15;
  const qrSize = blockSize - qrPadding * 2;
  const qrX = centerX - qrSize / 2;
  // Center the QR vertically in the page (the white block is in the middle of the image)
  const qrY = contentY + (contentH - qrSize) / 2;

  const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
    width: 1024,
    errorCorrectionLevel: "H",
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  pdf.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // --- Tabs Pin Logo overlay in center of QR code (matching MyBusiness page style) ---
  // Always uses the Tabs pin logo, never the business logo
  const qrCenterX = qrX + qrSize / 2;
  const qrCenterY = qrY + qrSize / 2;
  await drawTabsLogoOverlay(pdf, qrCenterX, qrCenterY, qrSize, WHITE);

  // --- Entity name at the very bottom ---
  if (entityName) {
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(255, 255, 255);
    const nameWidth = pdf.getTextWidth(entityName);
    pdf.text(entityName, centerX - nameWidth / 2, contentY + contentH - 0.25);
  }
}

/**
 * Draws the Tabs pin logo overlay in the center of a QR code.
 * Uses /tabs-logo.svg (same as MyBusiness page) rendered via SVG-to-canvas.
 */
async function drawTabsLogoOverlay(pdf, centerX, centerY, qrSize, WHITE) {
  const overlayRadius = qrSize * 0.13;

  // White circle background
  pdf.setFillColor(...WHITE);
  pdf.circle(centerX, centerY, overlayRadius + 0.05, "F");

  try {
    // Load the tabs-logo.svg from the public folder (same as MyBusiness page uses)
    const response = await fetch("/tabs-logo.svg");
    const svgText = await response.text();

    // Render SVG to canvas for PDF embedding
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    const logoImg = new Image();
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
      logoImg.src = svgUrl;
    });

    const logoCanvas = document.createElement("canvas");
    logoCanvas.width = 200;
    logoCanvas.height = 200;
    const logoCtx = logoCanvas.getContext("2d");
    logoCtx.drawImage(logoImg, 0, 0, 200, 200);
    const logoDataUrl = logoCanvas.toDataURL("image/png");

    URL.revokeObjectURL(svgUrl);

    // Draw the pin logo centered in the white circle
    const overlaySize = overlayRadius * 1.8;
    pdf.addImage(
      logoDataUrl,
      "PNG",
      centerX - overlaySize / 2,
      centerY - overlaySize / 2,
      overlaySize,
      overlaySize
    );
  } catch (err) {
    // Fallback: try using the imported logo.png
    try {
      const logoImg = new Image();
      logoImg.crossOrigin = "anonymous";
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
        logoImg.src = tabsLogo;
      });

      const logoCanvas = document.createElement("canvas");
      logoCanvas.width = logoImg.width;
      logoCanvas.height = logoImg.height;
      const logoCtx = logoCanvas.getContext("2d");
      logoCtx.drawImage(logoImg, 0, 0);
      const logoDataUrl = logoCanvas.toDataURL("image/png");

      const overlaySize = overlayRadius * 1.8;
      pdf.addImage(
        logoDataUrl,
        "PNG",
        centerX - overlaySize / 2,
        centerY - overlaySize / 2,
        overlaySize,
        overlaySize
      );
    } catch (err2) {
      // Final fallback: draw "TABS" text in orange (matching MyBusiness PDF style)
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 93, 0);
      const tw = pdf.getTextWidth("TABS");
      pdf.text("TABS", centerX - tw / 2, centerY + 0.03);
    }
  }
}

export function PrintAssetGenerator({
  qrUrl,
  publicCode,
  entityName,
  logoUrl,
  onGenerate,
}) {
  const [selectedTemplate, setSelectedTemplate] = useState("table-tent");
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const template = TEMPLATES.find((t) => t.id === selectedTemplate);
  const isDark = theme === "dark";
  const bgColor = isDark ? "#1a1a1a" : "#ffffff";
  const fgColor = isDark ? "#ffffff" : "#000000";

  const drawCropMarks = (pdf, pageWidth, pageHeight) => {
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.005);

    // Top-left
    pdf.line(0, BLEED, CROP_MARK_LENGTH, BLEED);
    pdf.line(BLEED, 0, BLEED, CROP_MARK_LENGTH);

    // Top-right
    pdf.line(pageWidth - CROP_MARK_LENGTH, BLEED, pageWidth, BLEED);
    pdf.line(pageWidth - BLEED, 0, pageWidth - BLEED, CROP_MARK_LENGTH);

    // Bottom-left
    pdf.line(0, pageHeight - BLEED, CROP_MARK_LENGTH, pageHeight - BLEED);
    pdf.line(BLEED, pageHeight - CROP_MARK_LENGTH, BLEED, pageHeight);

    // Bottom-right
    pdf.line(
      pageWidth - CROP_MARK_LENGTH,
      pageHeight - BLEED,
      pageWidth,
      pageHeight - BLEED
    );
    pdf.line(
      pageWidth - BLEED,
      pageHeight - CROP_MARK_LENGTH,
      pageWidth - BLEED,
      pageHeight
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const { width, height } = template;

      // Total page size includes bleed on all sides
      const pageWidth = width + BLEED * 2;
      const pageHeight = height + BLEED * 2;

      const pdf = new jsPDF({
        orientation: width > height ? "landscape" : "portrait",
        unit: "in",
        format: [pageWidth, pageHeight],
      });

      // Fill background (including bleed area)
      pdf.setFillColor(bgColor);
      pdf.rect(0, 0, pageWidth, pageHeight, "F");

      // Draw crop marks
      drawCropMarks(pdf, pageWidth, pageHeight);

      // Content area starts after bleed
      const contentX = BLEED;
      const contentY = BLEED;
      const contentW = width;
      const contentH = height;

      // Use branded flyer layout if that template is selected
      if (selectedTemplate === "branded-flyer") {
        await generateBrandedFlyer(pdf, contentX, contentY, contentW, contentH, qrUrl, logoUrl, entityName);
      } else {
        // Standard template layout
        const centerX = contentX + contentW / 2;
        let currentY = contentY + 0.4;

        // Add entity name
        pdf.setTextColor(fgColor);
        pdf.setFontSize(Math.min(20, contentW * 3));
        pdf.setFont("helvetica", "bold");
        const nameText = entityName || "Business";
        const nameWidth = pdf.getTextWidth(nameText);
        pdf.text(nameText, centerX - nameWidth / 2, currentY + 0.2);
        currentY += 0.5;

        // Add logo if available (max 1x1 inch, maintain aspect ratio)
        if (logoUrl) {
          try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = logoUrl;
            });

            const maxLogoSize = 1; // 1x1 inch max
            const aspectRatio = img.width / img.height;
            let logoW, logoH;

            if (aspectRatio >= 1) {
              logoW = maxLogoSize;
              logoH = maxLogoSize / aspectRatio;
            } else {
              logoH = maxLogoSize;
              logoW = maxLogoSize * aspectRatio;
            }

            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const logoDataUrl = canvas.toDataURL("image/png");

            pdf.addImage(
              logoDataUrl,
              "PNG",
              centerX - logoW / 2,
              currentY,
              logoW,
              logoH
            );
            currentY += logoH + 0.3;
          } catch (logoErr) {
            // Logo failed to load, continue without it (Requirement 10.6)
            console.warn("Logo could not be loaded, generating without it.");
          }
        }

        // Generate QR code image
        const qrDataUrl = await QRCodeLib.toDataURL(qrUrl, {
          width: 1024,
          errorCorrectionLevel: "H",
          margin: 2,
          color: {
            dark: fgColor,
            light: bgColor,
          },
        });

        // QR code size: at least 2x2 inches, scale to fit template
        const maxQrSize = Math.min(contentW - 0.5, contentH - currentY - 1.5);
        const qrSize = Math.max(2, Math.min(maxQrSize, contentW * 0.6));
        pdf.addImage(
          qrDataUrl,
          "PNG",
          centerX - qrSize / 2,
          currentY,
          qrSize,
          qrSize
        );
        currentY += qrSize + 0.3;

        // Add Public_Code text
        pdf.setFontSize(Math.min(14, contentW * 2));
        pdf.setFont("helvetica", "normal");
        const codeText = publicCode || "";
        const codeWidth = pdf.getTextWidth(codeText);
        pdf.text(codeText, centerX - codeWidth / 2, currentY);
      }

      const filename = `${entityName || "print-asset"}-${selectedTemplate}.pdf`.replace(
        /[^a-zA-Z0-9\-_.]/g,
        "_"
      );
      pdf.save(filename);

      if (onGenerate) {
        onGenerate({ template: selectedTemplate, theme, filename });
      }
    } catch (err) {
      console.error("Failed to generate print asset:", err);
      setError("Failed to generate print asset. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!qrUrl) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No QR URL available. Generate a QR code first.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Print Assets
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Template Selection */}
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Template
      </Typography>
      <ToggleButtonGroup
        value={selectedTemplate}
        exclusive
        onChange={(_, val) => val && setSelectedTemplate(val)}
        size="small"
        sx={{ mb: 2 }}
      >
        {TEMPLATES.map((t) => (
          <ToggleButton key={t.id} value={t.id} sx={{ textTransform: "none" }}>
            {t.label} ({t.width}×{t.height} in)
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Theme Selection */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Theme
        </Typography>
        <ToggleButtonGroup
          value={theme}
          exclusive
          onChange={(_, val) => val && setTheme(val)}
          size="small"
        >
          <ToggleButton value="light" sx={{ textTransform: "none" }}>
            <LightModeIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Light
          </ToggleButton>
          <ToggleButton value="dark" sx={{ textTransform: "none" }}>
            <DarkModeIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Dark
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Preview */}
      <Card
        variant="outlined"
        sx={{
          mb: 2,
          backgroundColor: bgColor,
          maxWidth: 300,
        }}
      >
        <CardContent
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
            p: 2,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ color: fgColor, fontWeight: 600 }}
          >
            {entityName || "Business Name"}
          </Typography>

          {logoUrl && (
            <Box
              component="img"
              src={logoUrl}
              alt="Logo"
              sx={{
                maxWidth: 60,
                maxHeight: 60,
                objectFit: "contain",
              }}
            />
          )}

          <QRCode
            value={qrUrl}
            size={120}
            level="H"
            bgColor={bgColor}
            fgColor={fgColor}
          />

          <Typography
            variant="caption"
            sx={{ color: fgColor, fontFamily: "monospace" }}
          >
            {publicCode}
          </Typography>
        </CardContent>
      </Card>

      {/* Generate Button */}
      <Button
        variant="contained"
        startIcon={
          loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <PrintIcon />
          )
        }
        onClick={handleGenerate}
        disabled={loading}
        sx={{ textTransform: "none" }}
      >
        {loading ? "Generating..." : "Generate Print Asset"}
      </Button>
    </Box>
  );
}

export default PrintAssetGenerator;
