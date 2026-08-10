import React from "react";
import { Box, Typography, Paper, Button, Divider } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";
import VisibilityIcon from "@mui/icons-material/Visibility";

const ACCENT = "#F09925";

/**
 * ConsentPreview — Preview of the terms/consent screen attendees will see.
 *
 * This is a non-functional preview showing the title, body text, disclosures,
 * and an "I Agree" button (disabled — preview only).
 *
 * Props:
 * - title: string — The title text for the consent screen (default: "Terms & Conditions")
 * - body: string — The main consent/terms body text
 * - disclosures: string[] — Optional array of required legal disclosures
 * - experienceName: string — Name of the experience for context
 *
 * Requirements: 16.4 (attendee-facing disclosures preview)
 */
const ConsentPreview = ({
  title = "Terms & Conditions",
  body = "",
  disclosures = [],
  experienceName = "Experience",
}) => {
  return (
    <Box sx={{ maxWidth: 480, mx: "auto" }}>
      {/* Preview Label */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          mb: 2,
        }}
      >
        <VisibilityIcon sx={{ color: "#71727A", fontSize: 18 }} />
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Preview — Attendee View
        </Typography>
      </Box>

      {/* Simulated Mobile Screen */}
      <Paper
        elevation={3}
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          border: "2px solid #E0E0E0",
        }}
      >
        {/* Header Bar */}
        <Box
          sx={{
            background: ACCENT,
            px: 2.5,
            py: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          <GavelIcon sx={{ color: "#fff", fontSize: 20 }} />
          <Typography
            sx={{ color: "#fff", fontWeight: 700, fontSize: 14 }}
          >
            {experienceName}
          </Typography>
        </Box>

        {/* Content Body */}
        <Box sx={{ p: 3 }}>
          {/* Title */}
          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: 18,
              color: "#1D1B20",
              mb: 2,
              textAlign: "center",
            }}
          >
            {title}
          </Typography>

          {/* Body Text */}
          {body && (
            <Typography
              sx={{
                fontSize: 13,
                color: "#424242",
                lineHeight: 1.7,
                mb: 2,
                whiteSpace: "pre-wrap",
              }}
            >
              {body}
            </Typography>
          )}

          {!body && (
            <Box
              sx={{
                p: 2,
                background: "#FAFAFA",
                borderRadius: 2,
                border: "1px dashed #E0E0E0",
                mb: 2,
                textAlign: "center",
              }}
            >
              <Typography sx={{ fontSize: 13, color: "#9E9E9E", fontStyle: "italic" }}>
                No terms body text configured yet.
              </Typography>
            </Box>
          )}

          {/* Disclosures Section */}
          {disclosures.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#71727A",
                  mb: 1,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Legal Disclosures
              </Typography>
              {disclosures.map((disclosure, idx) => (
                <Typography
                  key={idx}
                  sx={{
                    fontSize: 12,
                    color: "#616161",
                    lineHeight: 1.6,
                    mb: 0.75,
                    pl: 1.5,
                    borderLeft: `2px solid ${ACCENT}40`,
                  }}
                >
                  {disclosure}
                </Typography>
              ))}
            </>
          )}

          {/* I Agree Button (non-functional preview) */}
          <Box sx={{ mt: 3, textAlign: "center" }}>
            <Button
              variant="contained"
              disabled
              fullWidth
              sx={{
                background: ACCENT,
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                py: 1.25,
                fontSize: 15,
                "&.Mui-disabled": {
                  background: ACCENT,
                  color: "#fff",
                  opacity: 0.85,
                },
              }}
            >
              I Agree
            </Button>
            <Typography
              sx={{
                fontSize: 11,
                color: "#9E9E9E",
                mt: 1,
                fontStyle: "italic",
              }}
            >
              (Preview only — button is non-functional)
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ConsentPreview;
