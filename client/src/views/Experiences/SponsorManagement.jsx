import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import { getInstance, updateInstance } from "../../services/experienceService";

const ACCENT = "#F09925";

const PLACEMENT_OPTIONS = [
  { value: "header_banner", label: "Header Banner" },
  { value: "footer_badge", label: "Footer Badge" },
  { value: "background_watermark", label: "Background Watermark" },
  { value: "prize_sponsor_label", label: "Prize Sponsor Label" },
];

const MONETIZATION_OPTIONS = [
  { value: "sponsor-funded", label: "Sponsor Funded" },
  { value: "premium-placement", label: "Premium Placement" },
  { value: "branded", label: "Branded Experience" },
  { value: "platform-commission", label: "Platform Commission" },
];

const PAYMENT_STATUS_COLORS = {
  captured: { color: "#2e7d32", bg: "#e8f5e9", label: "Captured" },
  pending: { color: "#ed6c02", bg: "#fff3e0", label: "Pending" },
  requires_action: { color: "#9c27b0", bg: "#f3e5f5", label: "Requires Action" },
  failed: { color: "#d32f2f", bg: "#fbe9e7", label: "Failed" },
};

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_LOGO_TYPES = ["image/png", "image/svg+xml"];
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * SponsorManagement — Admin dashboard view for sponsor association and branding.
 * Handles branding assets upload, placement position, monetization model selection,
 * payment status display, and sponsor disassociation.
 *
 * Requirements: 9.1, 9.6
 */
const SponsorManagement = () => {
  const { eventId, experienceId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [confirmDisassociate, setConfirmDisassociate] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [brandColors, setBrandColors] = useState(["#F09925"]);
  const [placement, setPlacement] = useState("header_banner");
  const [monetizationModel, setMonetizationModel] = useState("sponsor-funded");
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [existingSponsor, setExistingSponsor] = useState(null);

  // Validation
  const [errors, setErrors] = useState({});

  const fetchInstance = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getInstance(eventId, experienceId);
      const instance = res.data?.data || res.data || {};
      const sponsor = instance.sponsor || {};

      if (sponsor.displayName) {
        setDisplayName(sponsor.displayName);
        setBrandColors(sponsor.brandColors || ["#F09925"]);
        setPlacement(sponsor.placement || "header_banner");
        setMonetizationModel(sponsor.monetizationModel || "sponsor-funded");
        setPaymentStatus(sponsor.paymentStatus || null);
        setLogoPreview(sponsor.logoUrl || null);
        setExistingSponsor(sponsor);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load experience data.");
    } finally {
      setLoading(false);
    }
  }, [eventId, experienceId]);

  useEffect(() => {
    fetchInstance();
  }, [fetchInstance]);

  const validate = () => {
    const newErrors = {};
    if (!displayName.trim()) {
      newErrors.displayName = "Display name is required.";
    } else if (displayName.length > 100) {
      newErrors.displayName = "Display name must be 100 characters or fewer.";
    }
    if (logoFile) {
      if (!ALLOWED_LOGO_TYPES.includes(logoFile.type)) {
        newErrors.logo = "Logo must be PNG or SVG format.";
      }
      if (logoFile.size > MAX_LOGO_SIZE) {
        newErrors.logo = "Logo must be 2MB or smaller.";
      }
    }
    for (let i = 0; i < brandColors.length; i++) {
      if (!HEX_REGEX.test(brandColors[i])) {
        newErrors.brandColors = `Color #${i + 1} is not a valid hex value.`;
        break;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, logo: "Logo must be PNG or SVG format." }));
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setErrors((prev) => ({ ...prev, logo: "Logo must be 2MB or smaller." }));
      return;
    }

    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
  };

  const handleAddColor = () => {
    if (brandColors.length < 3) {
      setBrandColors([...brandColors, "#000000"]);
    }
  };

  const handleRemoveColor = (index) => {
    setBrandColors(brandColors.filter((_, i) => i !== index));
  };

  const handleColorChange = (index, value) => {
    const updated = [...brandColors];
    updated[index] = value;
    setBrandColors(updated);
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const sponsorData = {
        sponsor: {
          displayName: displayName.trim(),
          brandColors,
          placement,
          monetizationModel,
        },
      };

      // If there's a logo file, encode as base64 for upload
      if (logoFile) {
        const reader = new FileReader();
        const logoBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
        sponsorData.sponsor.logo = logoBase64;
        sponsorData.sponsor.logoFilename = logoFile.name;
      }

      await updateInstance(eventId, experienceId, sponsorData);
      setSuccess("Sponsor association saved successfully.");
      setExistingSponsor(sponsorData.sponsor);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save sponsor association.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisassociate = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      setConfirmDisassociate(false);

      await updateInstance(eventId, experienceId, { sponsor: null });

      setDisplayName("");
      setLogoFile(null);
      setLogoPreview(null);
      setBrandColors(["#F09925"]);
      setPlacement("header_banner");
      setMonetizationModel("sponsor-funded");
      setPaymentStatus(null);
      setExistingSponsor(null);
      setSuccess("Sponsor disassociated successfully.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to disassociate sponsor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  const statusInfo = paymentStatus ? PAYMENT_STATUS_COLORS[paymentStatus] || null : null;

  return (
    <Box sx={{ p: 3, fontFamily: "'Outfit', sans-serif", maxWidth: 800 }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#0d1b35" }}>
          Sponsor <span style={{ color: ACCENT }}>Management</span>
        </Typography>
        {existingSponsor && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<LinkOffIcon />}
            onClick={() => setConfirmDisassociate(true)}
            disabled={saving}
            sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
          >
            Disassociate
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Payment Status */}
      {statusInfo && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#6a7f9a", mb: 1 }}>
            Payment Status
          </Typography>
          <Chip
            label={statusInfo.label}
            sx={{
              bgcolor: statusInfo.bg,
              color: statusInfo.color,
              fontWeight: 800,
              fontSize: 13,
            }}
          />
        </Paper>
      )}

      {/* Sponsor Form */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid rgba(0,0,0,0.08)" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 3, color: "#0d1b35" }}>
          Sponsor Branding
        </Typography>

        {/* Display Name */}
        <TextField
          label="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          fullWidth
          error={!!errors.displayName}
          helperText={errors.displayName || `${displayName.length}/100 characters`}
          inputProps={{ maxLength: 100 }}
          sx={{ mb: 3 }}
        />

        {/* Logo Upload */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: "#0d1b35" }}>
            Logo (PNG or SVG, max 2MB)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Button
              variant="outlined"
              component="label"
              startIcon={<CloudUploadOutlinedIcon />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                borderColor: errors.logo ? "#d32f2f" : undefined,
              }}
            >
              {logoFile ? logoFile.name : "Choose File"}
              <input
                type="file"
                hidden
                accept=".png,.svg,image/png,image/svg+xml"
                onChange={handleLogoChange}
              />
            </Button>
            {logoPreview && (
              <Box
                component="img"
                src={logoPreview}
                alt="Logo preview"
                sx={{ height: 40, maxWidth: 120, objectFit: "contain", borderRadius: 1 }}
              />
            )}
          </Box>
          {errors.logo && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {errors.logo}
            </Typography>
          )}
        </Box>

        {/* Brand Colors */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: "#0d1b35" }}>
            Brand Colors (up to 3)
          </Typography>
          {brandColors.map((color, index) => (
            <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <TextField
                size="small"
                value={color}
                onChange={(e) => handleColorChange(index, e.target.value)}
                placeholder="#000000"
                sx={{ width: 160 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Box
                        sx={{
                          width: 20,
                          height: 20,
                          borderRadius: 1,
                          bgcolor: HEX_REGEX.test(color) ? color : "#ccc",
                          border: "1px solid rgba(0,0,0,0.15)",
                        }}
                      />
                    </InputAdornment>
                  ),
                }}
              />
              {brandColors.length > 1 && (
                <IconButton size="small" onClick={() => handleRemoveColor(index)} aria-label="Remove color">
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {brandColors.length < 3 && (
            <Button
              size="small"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddColor}
              sx={{ textTransform: "none", color: ACCENT, fontWeight: 700 }}
            >
              Add Color
            </Button>
          )}
          {errors.brandColors && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {errors.brandColors}
            </Typography>
          )}
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Placement Position */}
        <TextField
          select
          label="Placement Position"
          value={placement}
          onChange={(e) => setPlacement(e.target.value)}
          fullWidth
          sx={{ mb: 3 }}
        >
          {PLACEMENT_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Monetization Model */}
        <TextField
          select
          label="Monetization Model"
          value={monetizationModel}
          onChange={(e) => setMonetizationModel(e.target.value)}
          fullWidth
          sx={{ mb: 3 }}
        >
          {MONETIZATION_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>

        {/* Save Button */}
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{
            bgcolor: ACCENT,
            "&:hover": { bgcolor: "#d9841f" },
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            px: 4,
          }}
        >
          {saving ? "Saving..." : "Save Sponsor"}
        </Button>
      </Paper>

      {/* Disassociate Confirmation Dialog */}
      <Dialog open={confirmDisassociate} onClose={() => setConfirmDisassociate(false)}>
        <DialogTitle sx={{ fontWeight: 800 }}>Disassociate Sponsor?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove the sponsor's branding from the attendee-facing UI. Already captured payments will not be reversed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDisassociate(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            onClick={handleDisassociate}
            color="error"
            variant="contained"
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Disassociate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SponsorManagement;
