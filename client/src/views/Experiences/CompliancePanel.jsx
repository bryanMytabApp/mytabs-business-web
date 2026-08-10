import React, { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
  Chip,
  Divider,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import GavelIcon from "@mui/icons-material/Gavel";
import VerifiedIcon from "@mui/icons-material/Verified";
import {
  validateJurisdiction,
  acknowledgeCompliance,
} from "../../services/experienceService";

const ACCENT = "#F09925";

const KNOWN_JURISDICTIONS = [
  { value: "US-TX", label: "United States — Texas" },
  { value: "US-CA", label: "United States — California" },
  { value: "US-NY", label: "United States — New York" },
  { value: "US-FL", label: "United States — Florida" },
  { value: "US-IL", label: "United States — Illinois" },
  { value: "US-PA", label: "United States — Pennsylvania" },
  { value: "US-OH", label: "United States — Ohio" },
  { value: "US-GA", label: "United States — Georgia" },
  { value: "CA-ON", label: "Canada — Ontario" },
  { value: "CA-BC", label: "Canada — British Columbia" },
  { value: "GB", label: "United Kingdom" },
  { value: "AU-NSW", label: "Australia — New South Wales" },
];

/**
 * CompliancePanel — Jurisdictional compliance management for raffle experiences.
 *
 * Features:
 * - Jurisdiction selection (dropdown of known jurisdictions or custom text input)
 * - Compliance status indicator (green check for compliant, orange warning for restricted)
 * - Acknowledgment flow with checkbox + confirm button for restricted types
 * - Display of required disclosures for the selected jurisdiction
 *
 * Requirements: 16.1, 16.3, 16.5
 */
const CompliancePanel = () => {
  const { eventId, experienceId } = useParams();

  // Jurisdiction state
  const [jurisdiction, setJurisdiction] = useState("");
  const [customJurisdiction, setCustomJurisdiction] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Validation result
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Acknowledgment state
  const [acknowledged, setAcknowledged] = useState(false);
  const [acknowledging, setAcknowledging] = useState(false);

  const getSelectedJurisdiction = useCallback(() => {
    if (useCustom) return customJurisdiction.trim();
    return jurisdiction;
  }, [useCustom, customJurisdiction, jurisdiction]);

  const handleValidate = useCallback(async () => {
    const selected = getSelectedJurisdiction();
    if (!selected) {
      setError("Please select or enter a jurisdiction.");
      return;
    }

    setValidating(true);
    setError(null);
    setSuccess(null);
    setValidationResult(null);
    setAcknowledged(false);

    try {
      const res = await validateJurisdiction(eventId, experienceId, {
        jurisdiction: selected,
      });
      const data = res.data?.data || res.data || {};
      setValidationResult(data);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to validate jurisdiction";
      setError(msg);
    } finally {
      setValidating(false);
    }
  }, [eventId, experienceId, getSelectedJurisdiction]);

  const handleAcknowledge = async () => {
    if (!acknowledged) return;

    setAcknowledging(true);
    setError(null);

    try {
      await acknowledgeCompliance(eventId, experienceId, {
        jurisdiction: getSelectedJurisdiction(),
        warnings: validationResult?.warnings || [],
      });
      setSuccess("Compliance acknowledgment recorded successfully.");
      setValidationResult((prev) => ({
        ...prev,
        acknowledged: true,
      }));
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        "Failed to record acknowledgment";
      setError(msg);
    } finally {
      setAcknowledging(false);
    }
  };

  const isCompliant = validationResult?.status === "compliant";
  const isRestricted = validationResult?.status === "restricted";
  const hasWarnings =
    validationResult?.warnings && validationResult.warnings.length > 0;
  const disclosures = validationResult?.disclosures || [];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h5"
          sx={{
            fontWeight: 800,
            color: "#1D1B20",
            fontSize: { xs: "1.25rem", md: "1.5rem" },
          }}
        >
          <GavelIcon
            sx={{ verticalAlign: "middle", mr: 1, color: ACCENT, fontSize: 28 }}
          />
          Compliance
        </Typography>
        <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
          Verify jurisdictional compliance for this raffle and acknowledge any
          restrictions before proceeding.
        </Typography>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 2, borderRadius: 2 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}

      {/* Jurisdiction Selection */}
      <Paper
        elevation={0}
        sx={{ p: 3, borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}
      >
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, mb: 2, color: "#1D1B20" }}
        >
          Jurisdiction Selection
        </Typography>

        <Box
          sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}
        >
          <Chip
            label="Known Jurisdiction"
            variant={!useCustom ? "filled" : "outlined"}
            onClick={() => setUseCustom(false)}
            sx={{
              fontWeight: 600,
              fontSize: 12,
              ...((!useCustom) && {
                background: `${ACCENT}18`,
                color: ACCENT,
                borderColor: ACCENT,
              }),
            }}
          />
          <Chip
            label="Custom"
            variant={useCustom ? "filled" : "outlined"}
            onClick={() => setUseCustom(true)}
            sx={{
              fontWeight: 600,
              fontSize: 12,
              ...(useCustom && {
                background: `${ACCENT}18`,
                color: ACCENT,
                borderColor: ACCENT,
              }),
            }}
          />
        </Box>

        {useCustom ? (
          <TextField
            label="Jurisdiction Code"
            placeholder="e.g., US-TX, CA-ON, GB"
            value={customJurisdiction}
            onChange={(e) => setCustomJurisdiction(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          />
        ) : (
          <TextField
            select
            label="Select Jurisdiction"
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          >
            {KNOWN_JURISDICTIONS.map((j) => (
              <MenuItem key={j.value} value={j.value} sx={{ fontSize: 13 }}>
                {j.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <Button
          variant="contained"
          onClick={handleValidate}
          disabled={validating || !getSelectedJurisdiction()}
          sx={{
            background: ACCENT,
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            "&:hover": { background: "#D4820F" },
          }}
        >
          {validating ? (
            <CircularProgress size={20} sx={{ color: "#fff" }} />
          ) : (
            "Check Compliance"
          )}
        </Button>
      </Paper>

      {/* Compliance Status */}
      {validationResult && (
        <Paper
          elevation={0}
          sx={{ p: 3, borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 700, mb: 2, color: "#1D1B20" }}
          >
            Compliance Status
          </Typography>

          {/* Status Indicator */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            {isCompliant && (
              <>
                <CheckCircleIcon sx={{ color: "#4CAF50", fontSize: 28 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#2E7D32" }}>
                  Compliant
                </Typography>
              </>
            )}
            {isRestricted && (
              <>
                <WarningAmberIcon sx={{ color: "#F57C00", fontSize: 28 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#E65100" }}>
                  Restricted — Acknowledgment Required
                </Typography>
              </>
            )}
            {!isCompliant && !isRestricted && validationResult.status && (
              <>
                <WarningAmberIcon sx={{ color: "#9E9E9E", fontSize: 28 }} />
                <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#616161" }}>
                  {validationResult.status}
                </Typography>
              </>
            )}
          </Box>

          {/* Compliance Indicator Chip */}
          {validationResult.acknowledged && (
            <Chip
              icon={<VerifiedIcon sx={{ fontSize: 16 }} />}
              label="Acknowledged"
              size="small"
              sx={{
                mb: 2,
                fontWeight: 600,
                fontSize: 12,
                background: "#E8F5E9",
                color: "#2E7D32",
              }}
            />
          )}

          {/* Warnings */}
          {hasWarnings && (
            <Box sx={{ mb: 2 }}>
              <Typography
                sx={{ fontWeight: 600, fontSize: 13, color: "#71727A", mb: 1 }}
              >
                Compliance Warnings:
              </Typography>
              {validationResult.warnings.map((warning, idx) => (
                <Alert
                  key={idx}
                  severity="warning"
                  sx={{ mb: 1, borderRadius: 2, fontSize: 13 }}
                >
                  {warning}
                </Alert>
              ))}
            </Box>
          )}

          {/* Required Disclosures */}
          {disclosures.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <Divider sx={{ my: 2 }} />
              <Typography
                sx={{ fontWeight: 600, fontSize: 13, color: "#71727A", mb: 1 }}
              >
                Required Disclosures for Attendees:
              </Typography>
              {disclosures.map((disclosure, idx) => (
                <Box
                  key={idx}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    background: "#F5F5F5",
                    borderRadius: 2,
                    border: "1px solid #E0E0E0",
                  }}
                >
                  <Typography sx={{ fontSize: 13, color: "#424242" }}>
                    {disclosure}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {/* Acknowledgment Flow */}
          {isRestricted && !validationResult.acknowledged && (
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Typography
                sx={{ fontWeight: 600, fontSize: 14, color: "#1D1B20", mb: 1.5 }}
              >
                Acknowledgment Required
              </Typography>
              <Typography sx={{ fontSize: 13, color: "#71727A", mb: 2 }}>
                You must acknowledge the compliance warnings above before this
                raffle can proceed. Your acknowledgment will be recorded with your
                identity and timestamp for audit purposes.
              </Typography>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                    sx={{
                      color: ACCENT,
                      "&.Mui-checked": { color: ACCENT },
                    }}
                  />
                }
                label={
                  <Typography sx={{ fontSize: 13, fontWeight: 500 }}>
                    I have reviewed and acknowledge the compliance warnings and
                    restrictions listed above.
                  </Typography>
                }
                sx={{ mb: 2, alignItems: "flex-start" }}
              />

              <Button
                variant="contained"
                onClick={handleAcknowledge}
                disabled={!acknowledged || acknowledging}
                sx={{
                  background: ACCENT,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  "&:hover": { background: "#D4820F" },
                  "&.Mui-disabled": {
                    background: "#E0E0E0",
                    color: "#9E9E9E",
                  },
                }}
              >
                {acknowledging ? (
                  <CircularProgress size={20} sx={{ color: "#fff" }} />
                ) : (
                  "Confirm Acknowledgment"
                )}
              </Button>
            </Box>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default CompliancePanel;
