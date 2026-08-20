import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  Chip,
  Modal,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CardGiftcardOutlinedIcon from "@mui/icons-material/CardGiftcardOutlined";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import PieChartOutlinedIcon from "@mui/icons-material/PieChartOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import { updateInstance, transitionState, getInstance } from "../../services/experienceService";
import { getEvent } from "../../services/eventService";
import { parseJwt } from "../../utils/common";

const STEPS = [
  "Raffle Type",
  "Prize & Schedule",
  "Entry Rules",
  "Sponsor & Notifications",
  "Review & Submit",
];

const RAFFLE_TYPES = [
  { value: "prize", label: "Prize Raffle", description: "Fixed prizes configured by organizer" },
  { value: "5050", label: "50/50 Raffle", description: "Split-pot: 50% to winner, 50% to organizer" },
  { value: "progressive", label: "Progressive Raffle", description: "Rolling jackpot that grows with each ticket sold" },
];

const ELIGIBILITY_OPTIONS = [
  { value: "open", label: "Open to All" },
  { value: "access_code", label: "Access Code Required" },
  { value: "ticket_type", label: "Ticket Type Restriction" },
  { value: "single_entry", label: "Single Entry Per Attendee" },
  { value: "max_entries", label: "Max Entries Per Attendee" },
];

const DEFAULT_FORM = {
  // Step 1: Raffle type
  raffleType: "prize",
  // Step 2: Prize configuration
  bannerStyle: "gift", // "gift" | "card" | "image"
  accentColor: "#00A9D6", // Tabs Cyan default
  prizes: [{ id: "prize-1", name: "", description: "", quantity: 1, winnersPerDrawing: 1 }],
  // Step 3: Schedule
  entryWindowStart: null,
  entryWindowEnd: null,
  drawingSchedules: [{ time: null, winners: 1 }],
  // Step 4: Eligibility rules
  eligibilityRules: ["single_entry"],
  maxEntries: 10,
  accessCodes: "",
  allowedTicketTypes: "",
  // Entry info collection
  infoCollection: "minimum", // "minimum" (name, email, phone) | "full" (+ address)
  // Step 5: Ticket pricing
  entryModel: "free",
  expectedParticipants: "",
  ticketBundles: [{ quantity: 1, price: 0, capacity: 10 }],
  // Step 6: Sponsor association
  hasSponsor: false,
  sponsors: [{ id: "sponsor-1", name: "", logoUrl: "", logoFile: null, logoPreview: null, colors: "", placement: "header_banner", amount: "", prizeId: "", prizePurpose: "", prizeTerms: "", prizeFulfillment: "", description: "", website: "" }],
  // Step 7: Notification templates
  entryConfirmationTemplate: "",
  drawingReminderTemplate: "",
  winnerAnnouncementTemplate: "",
  claimExpirationTemplate: "",
  // Step 8: Compliance
  jurisdictions: "",
  complianceAcknowledged: false,
  requireTermsConsent: true,
  rulesPreviewedByAdmin: false,
  rulesStrictness: "standard",
  sponsorLegalName: "",
  privacyPolicyUrl: "",
  supportContact: "",
  // Step 9: Review (no extra fields)
};

/**
 * Validates a specific inner tab within a step.
 * Returns field-level errors for only that inner tab's fields.
 */
function validateInnerTab(step, innerTab, form) {
  const errors = {};

  if (step === 1) {
    // Step 1 inner tabs: 0=Prizes, 1=Appearance, 2=Schedule
    if (innerTab === 0) {
      // Prizes tab validation
      form.prizes.forEach((prize, idx) => {
        if (!prize.name) errors[`prizes[${idx}].name`] = "Prize name is required.";
        else if (prize.name.length > 50)
          errors[`prizes[${idx}].name`] = "Prize name must be ≤ 50 characters.";
        if (prize.description && prize.description.length > 150)
          errors[`prizes[${idx}].description`] = "Description must be ≤ 150 characters.";
        if (parseFloat(prize.value) > 75000)
          errors[`prizes[${idx}].value`] = "Prize value exceeds $75,000 statutory limit (Texas Charitable Raffle Enabling Act).";
        if (!prize.quantity || prize.quantity < 1 || prize.quantity > 1000)
          errors[`prizes[${idx}].quantity`] = "Quantity must be between 1 and 1000.";
        if (!prize.winnersPerDrawing || prize.winnersPerDrawing < 1 || prize.winnersPerDrawing > prize.quantity)
          errors[`prizes[${idx}].winnersPerDrawing`] = `Winners per drawing must be between 1 and ${prize.quantity || 1}.`;
      });
    } else if (innerTab === 2) {
      // Schedule tab validation
      if (!form.entryWindowStart) errors.entryWindowStart = "Entry window start is required.";
      if (!form.entryWindowEnd) errors.entryWindowEnd = "Entry window end is required.";
      if (form.entryWindowStart && form.entryWindowEnd) {
        if (form.entryWindowEnd <= form.entryWindowStart)
          errors.entryWindowEnd = "Entry window end must be after start.";
      }
      if (!form.drawingSchedules || form.drawingSchedules.length === 0)
        errors.drawingSchedules = "At least one drawing schedule is required.";
      else if (form.drawingSchedules.length > 20)
        errors.drawingSchedules = "Maximum 20 drawing schedules allowed.";
      else {
        const times = [];
        form.drawingSchedules.forEach((sched, idx) => {
          if (!sched.time)
            errors[`drawingSchedules[${idx}].time`] = "Drawing time is required.";
          else {
            if (times.includes(sched.time?.valueOf()))
              errors[`drawingSchedules[${idx}].time`] = "Drawing times must be unique.";
            times.push(sched.time?.valueOf());
          }
          if (!sched.winners || sched.winners < 1)
            errors[`drawingSchedules[${idx}].winners`] = "Winners must be at least 1.";
        });
        for (let i = 1; i < form.drawingSchedules.length; i++) {
          if (form.drawingSchedules[i].time && form.drawingSchedules[i - 1].time) {
            if (form.drawingSchedules[i].time <= form.drawingSchedules[i - 1].time)
              errors[`drawingSchedules[${i}].time`] = "Drawing schedules must be in chronological order.";
          }
        }
        if (form.entryWindowEnd && form.drawingSchedules[0]?.time) {
          if (form.entryWindowEnd >= form.drawingSchedules[0].time)
            errors.entryWindowEnd = "Entry window must close before the first drawing time.";
        }
        const totalWinners = form.drawingSchedules.reduce((sum, s) => sum + (s.winners || 0), 0);
        const totalQuantity = form.prizes.reduce((sum, p) => sum + (p.quantity || 0), 0);
        if (totalWinners > totalQuantity)
          errors.drawingSchedules = `Total winners (${totalWinners}) exceeds prize quantity (${totalQuantity}).`;
      }
    }
  } else if (step === 2) {
    // Step 2 inner tabs: 0=Eligibility, 1=Info Collection (pricing removed - all free)
    if (innerTab === 0) {
      if (form.eligibilityRules.includes("max_entries")) {
        if (!form.maxEntries || form.maxEntries < 1 || form.maxEntries > 100)
          errors.maxEntries = "Max entries must be between 1 and 100.";
      }
    }
  } else if (step === 3) {
    // Step 3 inner tabs: 0=Sponsor, 1=Notifications, 2=Compliance
    if (innerTab === 0) {
      if (form.hasSponsor) {
        form.sponsors.forEach((s, idx) => {
          if (!s.name) errors[`sponsors[${idx}].name`] = "Sponsor display name is required.";
          else if (s.name.length > 100)
            errors[`sponsors[${idx}].name`] = "Sponsor name must be ≤ 100 characters.";
        });
      }
    } else if (innerTab === 1) {
      if (form.entryConfirmationTemplate && form.entryConfirmationTemplate.length > 300)
        errors.entryConfirmationTemplate = "Template must be ≤ 300 characters.";
      if (form.drawingReminderTemplate && form.drawingReminderTemplate.length > 300)
        errors.drawingReminderTemplate = "Template must be ≤ 300 characters.";
      if (form.winnerAnnouncementTemplate && form.winnerAnnouncementTemplate.length > 300)
        errors.winnerAnnouncementTemplate = "Template must be ≤ 300 characters.";
      if (form.claimExpirationTemplate && form.claimExpirationTemplate.length > 300)
        errors.claimExpirationTemplate = "Template must be ≤ 300 characters.";
    } else if (innerTab === 2) {
      if (!form.jurisdictions) errors.jurisdictions = "At least one jurisdiction is required.";
      if (!form.sponsorLegalName) errors.sponsorLegalName = "Sponsor legal name is required for rules generation.";
      if (!form.privacyPolicyUrl) errors.privacyPolicyUrl = "Privacy policy URL is required.";
      if (!form.supportContact) errors.supportContact = "Support contact is required.";
      if (!form.rulesPreviewedByAdmin)
        errors.rulesPreviewedByAdmin = "You must preview the rules before acknowledging compliance.";
      if (!form.complianceAcknowledged)
        errors.complianceAcknowledged = "You must acknowledge compliance requirements.";
    }
  }

  return errors;
}

/**
 * Validates the raffle config form by step.
 * Returns an object with field-level errors keyed by field name.
 */
function validateStep(step, form) {
  const errors = {};

  switch (step) {
    case 0: // Raffle Type
      if (!form.raffleType) errors.raffleType = "Raffle type is required.";
      break;

    case 1: { // Prize & Schedule
      // Prize validation
      form.prizes.forEach((prize, idx) => {
        if (!prize.name) errors[`prizes[${idx}].name`] = "Prize name is required.";
        else if (prize.name.length > 50)
          errors[`prizes[${idx}].name`] = "Prize name must be ≤ 50 characters.";
        if (prize.description && prize.description.length > 150)
          errors[`prizes[${idx}].description`] = "Description must be ≤ 150 characters.";
        if (parseFloat(prize.value) > 75000)
          errors[`prizes[${idx}].value`] = "Prize value exceeds $75,000 statutory limit (Texas Charitable Raffle Enabling Act).";
        if (!prize.quantity || prize.quantity < 1 || prize.quantity > 1000)
          errors[`prizes[${idx}].quantity`] = "Quantity must be between 1 and 1000.";
        if (!prize.winnersPerDrawing || prize.winnersPerDrawing < 1 || prize.winnersPerDrawing > prize.quantity)
          errors[`prizes[${idx}].winnersPerDrawing`] = `Winners per drawing must be between 1 and ${prize.quantity || 1}.`;
      });
      // Schedule validation
      if (!form.entryWindowStart) errors.entryWindowStart = "Entry window start is required.";
      if (!form.entryWindowEnd) errors.entryWindowEnd = "Entry window end is required.";
      if (form.entryWindowStart && form.entryWindowEnd) {
        if (form.entryWindowEnd <= form.entryWindowStart)
          errors.entryWindowEnd = "Entry window end must be after start.";
      }
      if (!form.drawingSchedules || form.drawingSchedules.length === 0)
        errors.drawingSchedules = "At least one drawing schedule is required.";
      else if (form.drawingSchedules.length > 20)
        errors.drawingSchedules = "Maximum 20 drawing schedules allowed.";
      else {
        const times = [];
        form.drawingSchedules.forEach((sched, idx) => {
          if (!sched.time)
            errors[`drawingSchedules[${idx}].time`] = "Drawing time is required.";
          else {
            if (times.includes(sched.time?.valueOf()))
              errors[`drawingSchedules[${idx}].time`] = "Drawing times must be unique.";
            times.push(sched.time?.valueOf());
          }
          if (!sched.winners || sched.winners < 1)
            errors[`drawingSchedules[${idx}].winners`] = "Winners must be at least 1.";
        });
        // Check chronological order
        for (let i = 1; i < form.drawingSchedules.length; i++) {
          if (form.drawingSchedules[i].time && form.drawingSchedules[i - 1].time) {
            if (form.drawingSchedules[i].time <= form.drawingSchedules[i - 1].time)
              errors[`drawingSchedules[${i}].time`] = "Drawing schedules must be in chronological order.";
          }
        }
        // Entry window must end before first drawing
        if (form.entryWindowEnd && form.drawingSchedules[0]?.time) {
          if (form.entryWindowEnd >= form.drawingSchedules[0].time)
            errors.entryWindowEnd = "Entry window must close before the first drawing time.";
        }
        // Total winners across schedules must not exceed prize quantity
        const totalWinners = form.drawingSchedules.reduce((sum, s) => sum + (s.winners || 0), 0);
        const totalQuantity = form.prizes.reduce((sum, p) => sum + (p.quantity || 0), 0);
        if (totalWinners > totalQuantity)
          errors.drawingSchedules = `Total winners (${totalWinners}) exceeds prize quantity (${totalQuantity}).`;
      }
      break;
    }

    case 2: // Entry Rules (Eligibility + Ticket Pricing)
      if (form.eligibilityRules.includes("max_entries")) {
        if (!form.maxEntries || form.maxEntries < 1 || form.maxEntries > 100)
          errors.maxEntries = "Max entries must be between 1 and 100.";
      }
      if (form.entryModel === "paid") {
        if (!form.ticketBundles || form.ticketBundles.length === 0)
          errors.ticketBundles = "At least one ticket bundle is required.";
        else if (form.ticketBundles.length > 10)
          errors.ticketBundles = "Maximum 10 bundle tiers allowed.";
        else {
          form.ticketBundles.forEach((bundle, idx) => {
            if (!bundle.quantity || bundle.quantity < 1)
              errors[`ticketBundles[${idx}].quantity`] = "Ticket quantity must be at least 1.";
            if (!bundle.price || bundle.price <= 0)
              errors[`ticketBundles[${idx}].price`] = "Price must be greater than $0.";
          });
        }
      }
      break;

    case 3: // Sponsor & Notifications (+ Compliance)
      if (form.hasSponsor) {
        if (!form.sponsorName) errors.sponsorName = "Sponsor display name is required.";
        else if (form.sponsorName.length > 100)
          errors.sponsorName = "Sponsor name must be ≤ 100 characters.";
      }
      if (form.entryConfirmationTemplate && form.entryConfirmationTemplate.length > 300)
        errors.entryConfirmationTemplate = "Template must be ≤ 300 characters.";
      if (form.drawingReminderTemplate && form.drawingReminderTemplate.length > 300)
        errors.drawingReminderTemplate = "Template must be ≤ 300 characters.";
      if (form.winnerAnnouncementTemplate && form.winnerAnnouncementTemplate.length > 300)
        errors.winnerAnnouncementTemplate = "Template must be ≤ 300 characters.";
      if (form.claimExpirationTemplate && form.claimExpirationTemplate.length > 300)
        errors.claimExpirationTemplate = "Template must be ≤ 300 characters.";
      if (!form.jurisdictions) errors.jurisdictions = "At least one jurisdiction is required.";
      if (!form.sponsorLegalName) errors.sponsorLegalName = "Sponsor legal name is required for rules generation.";
      if (!form.privacyPolicyUrl) errors.privacyPolicyUrl = "Privacy policy URL is required.";
      if (!form.supportContact) errors.supportContact = "Support contact is required.";
      if (!form.rulesPreviewedByAdmin)
        errors.rulesPreviewedByAdmin = "You must preview the rules before acknowledging compliance.";
      if (!form.complianceAcknowledged)
        errors.complianceAcknowledged = "You must acknowledge compliance requirements.";
      break;

    default:
      break;
  }

  return errors;
}

/**
 * Validates all steps and returns combined errors.
 */
function validateAll(form) {
  let allErrors = {};
  for (let i = 0; i < STEPS.length - 1; i++) {
    const stepErrors = validateStep(i, form);
    allErrors = { ...allErrors, ...stepErrors };
  }
  return allErrors;
}

/**
 * PrizeItem — Isolated component for a single prize entry.
 * Using React.memo prevents re-renders of sibling prizes when one prize changes.
 * Each text field manages its own value to avoid losing focus.
 */
const PrizeItem = memo(({ prize, idx, errors, onUpdate, onDelete, canDelete, eventId, bannerStyle }) => {
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // A saved prize can come back from the API without `name`/`description` —
  // empty attributes are dropped on the round trip. Reading `.length` off
  // undefined threw during render, which blanked the whole page.
  const nameValue = prize?.name ?? "";
  const descriptionValue = prize?.description ?? "";

  const generateDescription = async (prizeName) => {
    if (!prizeName || prizeName.length < 3) return;
    setGeneratingDesc(true);
    try {
      const token = localStorage.getItem("idToken");
      // eslint-disable-next-line global-require
      const baseUrl = require("../../config.json").backendUrl;
      const response = await fetch(`${baseUrl}v1/events/${eventId}/experiences/generate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: `Generate a short, exciting prize description (1-2 sentences, under 120 characters) for a raffle prize called "${prizeName}". Return JSON: {"description": "your description here"}`,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const result = data.data || data.result || data;
        // Handle various response shapes
        const desc = (
          result.description ||
          result.raw ||
          result.text ||
          (typeof result === 'string' ? result : '')
        ).replace(/^["']|["']$/g, '').trim();
        if (desc && desc.length > 3) {
          onUpdate({ ...prize, description: desc });
        }
      }
    } catch {
      // Silent fail — user can write manually
    } finally {
      setGeneratingDesc(false);
    }
  };

  return (
    <Box sx={{ mb: 2, p: 2, pt: 1.5, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>Prize {idx + 1}</Typography>
        {canDelete && (
          <IconButton size="small" onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {/* Two-column layout */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          label="Prize Name"
          value={nameValue}
          onChange={(e) => onUpdate({ ...prize, name: e.target.value })}
          onBlur={(e) => {
            if (!prize.description) generateDescription(e.target.value);
          }}
          error={!!errors[`prizes[${idx}].name`]}
          helperText={errors[`prizes[${idx}].name`] || `${nameValue.length}/50`}
          inputProps={{ maxLength: 51 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Prize Value ($)"
          type="number"
          value={prize.value || ""}
          onChange={(e) => onUpdate({ ...prize, value: e.target.value })}
          placeholder="e.g. 500"
          inputProps={{ min: 0, max: 75000, step: "0.01" }}
          error={parseFloat(prize.value) > 75000}
          helperText={parseFloat(prize.value) > 75000 ? "Texas Charitable Raffle Enabling Act limits purchased prizes to $75,000 each" : ""}
        />
        <Box sx={{ position: "relative" }}>
          <TextField
            fullWidth
            size="small"
            label="Prize Description"
            multiline
            rows={2}
            value={descriptionValue}
            onChange={(e) => onUpdate({ ...prize, description: e.target.value })}
            inputProps={{ maxLength: 150 }}
            error={!!errors[`prizes[${idx}].description`]}
            helperText={
              generatingDesc
                ? "✨ AI is writing a description..."
                : (errors[`prizes[${idx}].description`] || `${descriptionValue.length}/150`)
            }
          />
          {/* Regenerate AI description button */}
          {nameValue.length >= 3 && !generatingDesc && (
            <button
              type="button"
              onClick={() => generateDescription(prize.name)}
              title="Generate description with AI"
              style={{
                position: "absolute", top: 6, right: 6,
                background: "none", border: "none", cursor: "pointer",
                fontSize: 16, padding: 2, borderRadius: 4, lineHeight: 1,
                opacity: 0.7, transition: "opacity 0.2s",
              }}
              onMouseEnter={(e) => { e.target.style.opacity = 1; }}
              onMouseLeave={(e) => { e.target.style.opacity = 0.7; }}
            >
              ✨
            </button>
          )}
          {generatingDesc && (
            <Box sx={{ position: "absolute", top: 8, right: 8 }}>
              <Box sx={{ width: 14, height: 14, border: "2px solid #e0e0e0", borderTopColor: "#00A9D6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            </Box>
          )}
        </Box>
        {/* Prize Image Upload — only shown when banner style is "Photo Only" */}
        {bannerStyle === "image" && (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#111827", mb: 0.5 }}>Prize Image</Typography>
          {prize.imagePreview ? (
            <Box sx={{ position: "relative", display: "inline-block", width: "100%" }}>
              <img
                src={prize.imagePreview}
                alt="Prize"
                style={{ width: "100%", maxHeight: 64, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB" }}
              />
              <button
                onClick={() => onUpdate({ ...prize, imagePreview: null, imageFile: null })}
                style={{
                  position: "absolute", top: 3, right: 3,
                  width: 18, height: 18, borderRadius: "50%",
                  background: "#ef4444", color: "#fff", border: "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, cursor: "pointer",
                }}
              >✕</button>
            </Box>
          ) : (
            <label style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "10px 8px", border: "1.5px dashed #E5E7EB", borderRadius: 8,
              cursor: "pointer", background: "#FAFBFC", textAlign: "center",
            }}>
              <span style={{ fontSize: 16 }}>📷</span>
              <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>Upload photo</span>
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    onUpdate({ ...prize, imagePreview: URL.createObjectURL(file), imageFile: file });
                  }
                }}
              />
            </label>
          )}
        </Box>
        )}
      </Box>
      {/* Quantity row */}
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <TextField
          size="small"
          label="Quantity"
          type="number"
          value={prize.quantity || ""}
          onChange={(e) => {
            const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1);
            onUpdate({ ...prize, quantity: val });
          }}
          error={!!errors[`prizes[${idx}].quantity`]}
          helperText={errors[`prizes[${idx}].quantity`]}
          inputProps={{ min: 1, max: 1000 }}
          sx={{ flex: 1 }}
        />
        <TextField
          size="small"
          label="Winners Per Drawing"
          type="number"
          value={prize.winnersPerDrawing || ""}
          onChange={(e) => {
            const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1);
            onUpdate({ ...prize, winnersPerDrawing: val });
          }}
          error={!!errors[`prizes[${idx}].winnersPerDrawing`]}
          helperText={errors[`prizes[${idx}].winnersPerDrawing`]}
          inputProps={{ min: 1 }}
          sx={{ flex: 1 }}
        />
      </Box>
    </Box>
  );
});

PrizeItem.displayName = 'PrizeItem';

/**
 * SponsorCard — Tabbed card for a single sponsor with sub-tabs:
 * Sponsor Info | Brand / Logo | Prize | Description
 */
const SPONSOR_TABS = ["Sponsor Info", "Brand / Logo", "Prize", "Description"];

const SponsorCard = memo(({ sponsor, idx, form, errors, updateField, canDelete }) => {
  const [activeTab, setActiveTab] = useState(0);

  const updateSponsorField = (field, value) => {
    const updated = [...form.sponsors];
    updated[idx] = { ...updated[idx], [field]: value };
    updateField("sponsors", updated);
  };

  return (
    <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, mb: 2, background: "#FAFBFC", overflow: "hidden" }}>
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", px: 2, pt: 1.5, pb: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Sponsor {idx + 1}{sponsor.name ? `: ${sponsor.name}` : ""}
        </Typography>
        {canDelete && (
          <IconButton
            size="small"
            onClick={() => {
              const updated = form.sponsors.filter((_, i) => i !== idx);
              updateField("sponsors", updated);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>
      {/* Tab bar */}
      <Box sx={{ display: "flex", borderBottom: "1px solid #E5E7EB", px: 1, mt: 1 }}>
        {SPONSOR_TABS.map((label, tabIdx) => (
          <Box
            key={label}
            onClick={() => setActiveTab(tabIdx)}
            sx={{
              px: 2, py: 1, cursor: "pointer", fontSize: 12, fontWeight: 600,
              color: activeTab === tabIdx ? "#00AAD6" : "#6B7280",
              borderBottom: activeTab === tabIdx ? "2px solid #00AAD6" : "2px solid transparent",
              marginBottom: "-1px", transition: "all 0.15s", whiteSpace: "nowrap",
              "&:hover": { color: "#00AAD6" },
            }}
          >
            {label}
          </Box>
        ))}
      </Box>
      {/* Tab content */}
      <Box sx={{ p: 2 }}>
        {/* Tab 0: Sponsor Info */}
        {activeTab === 0 && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Sponsor Name"
              value={sponsor.name}
              onChange={(e) => updateSponsorField("name", e.target.value)}
              error={!!errors[`sponsors[${idx}].name`]}
              helperText={errors[`sponsors[${idx}].name`] || "The brand name shown on the raffle page"}
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Contribution ($)"
              value={sponsor.amount}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                updateSponsorField("amount", raw);
              }}
              helperText="How much the sponsor is contributing"
              inputProps={{ inputMode: "decimal" }}
            />
            <FormControl fullWidth size="small">
              <InputLabel>Branding Placement</InputLabel>
              <Select
                value={sponsor.placement}
                label="Branding Placement"
                onChange={(e) => updateSponsorField("placement", e.target.value)}
              >
                <MenuItem value="header_banner">Header Banner</MenuItem>
                <MenuItem value="footer_badge">Footer Badge</MenuItem>
                <MenuItem value="background_watermark">Background Watermark</MenuItem>
                <MenuItem value="prize_sponsor_label">Prize Sponsor Label</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="Brand Colors"
              value={sponsor.colors}
              onChange={(e) => updateSponsorField("colors", e.target.value)}
              helperText="Comma-separated hex codes (e.g., #FF0000, #0000FF)"
              placeholder="#FF0000, #0000FF"
            />
          </Box>
        )}

        {/* Tab 1: Brand / Logo */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                label="Logo URL"
                value={sponsor.logoUrl}
                onChange={(e) => updateSponsorField("logoUrl", e.target.value)}
                helperText="Direct link to logo (PNG, SVG, or JPEG)"
                placeholder="https://..."
              />
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Or Upload Image</Typography>
                {sponsor.logoPreview || (sponsor.logoUrl && !sponsor.logoFile) ? (
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 1.5, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
                    <img
                      src={sponsor.logoPreview || sponsor.logoUrl}
                      alt={`${sponsor.name || "Sponsor"} logo`}
                      style={{ width: "100%", height: 120, objectFit: "contain", borderRadius: 8, background: "#F9FAFB" }}
                    />
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>Logo uploaded</Typography>
                      <IconButton
                        size="small"
                        onClick={() => {
                          const updated = [...form.sponsors];
                          updated[idx] = { ...updated[idx], logoPreview: null, logoFile: null, logoUrl: "" };
                          updateField("sponsors", updated);
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Box>
                  </Box>
                ) : (
                  <label style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "12px 16px", border: "1.5px dashed #D1D5DB", borderRadius: 8,
                    cursor: "pointer", background: "#fff",
                  }}>
                    <span style={{ fontSize: 20 }}>📷</span>
                    <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>Choose file (PNG, SVG, JPEG, max 2MB)</span>
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const updated = [...form.sponsors];
                          updated[idx] = { ...updated[idx], logoPreview: URL.createObjectURL(file), logoFile: file };
                          updateField("sponsors", updated);
                        }
                      }}
                    />
                  </label>
                )}
              </Box>
            </Box>
          </Box>
        )}

        {/* Tab 2: Prize */}
        {activeTab === 2 && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Prize Being Sponsored</InputLabel>
              <Select
                value={sponsor.prizeId}
                label="Prize Being Sponsored"
                onChange={(e) => updateSponsorField("prizeId", e.target.value)}
              >
                <MenuItem value="">All Prizes</MenuItem>
                {form.prizes.filter((p) => p.name).map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              size="small"
              label="Prize Purpose"
              value={sponsor.prizePurpose}
              onChange={(e) => updateSponsorField("prizePurpose", e.target.value)}
              helperText="e.g., Grand Prize, Door Prize, Runner-Up"
              inputProps={{ maxLength: 100 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Prize Terms & Conditions"
              multiline
              rows={3}
              value={sponsor.prizeTerms}
              onChange={(e) => updateSponsorField("prizeTerms", e.target.value)}
              helperText="Restrictions, expiration dates, or conditions"
              inputProps={{ maxLength: 500 }}
            />
            <TextField
              fullWidth
              size="small"
              label="How Prize Will Be Fulfilled"
              multiline
              rows={3}
              value={sponsor.prizeFulfillment}
              onChange={(e) => updateSponsorField("prizeFulfillment", e.target.value)}
              helperText="e.g., shipped within 30 days, digital code via email"
              inputProps={{ maxLength: 300 }}
            />
          </Box>
        )}

        {/* Tab 3: Description */}
        {activeTab === 3 && (
          <Box>
            <TextField
              fullWidth
              size="small"
              label="Sponsor Description"
              multiline
              rows={4}
              value={sponsor.description || ""}
              onChange={(e) => updateSponsorField("description", e.target.value)}
              helperText="A brief description of the sponsor and their involvement (shown on raffle page)"
              inputProps={{ maxLength: 500 }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Sponsor Website"
              value={sponsor.website || ""}
              onChange={(e) => updateSponsorField("website", e.target.value)}
              helperText="Link to sponsor's website (optional)"
              placeholder="https://..."
            />
          </Box>
        )}
      </Box>
    </Box>
  );
});

SponsorCard.displayName = 'SponsorCard';

/**
 * PrizeAppearanceCard — 3D flippable card preview with style selector.
 * Uses the same drag-to-flip interaction as the attendee experience web app.
 */
const PrizeAppearanceCard = memo(({ prize, idx, style, color, form, updateField, errors }) => {
  const [rotationY, setRotationY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startRotation: 0, lastX: 0, lastT: 0, velocity: 0 });

  const onPointerDown = useCallback((e) => {
    setDragging(true);
    const x = e.clientX;
    dragRef.current = { startX: x, startRotation: rotationY, lastX: x, lastT: performance.now(), velocity: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [rotationY]);

  const onPointerMove = useCallback((e) => {
    if (!dragging) return;
    const x = e.clientX;
    const now = performance.now();
    const dt = now - dragRef.current.lastT;
    if (dt > 0) dragRef.current.velocity = (x - dragRef.current.lastX) / dt;
    dragRef.current.lastX = x;
    dragRef.current.lastT = now;
    const delta = x - dragRef.current.startX;
    setRotationY(dragRef.current.startRotation + delta * 0.6);
  }, [dragging]);

  const settle = useCallback(() => {
    setDragging(false);
    const projected = rotationY + dragRef.current.velocity * 6;
    const nearest180 = Math.round(projected / 180) * 180;
    setRotationY(nearest180);
  }, [rotationY]);

  useEffect(() => {
    if (!dragging) return;
    const up = () => settle();
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [dragging, settle]);

  // Card dimensions: credit card ratio (85.6:53.98 ≈ 1.586:1)
  const CARD_WIDTH = 260;
  const CARD_HEIGHT = 164;

  return (
    <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 3, background: "#fff" }}>
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: "#111827" }}>
        {prize.name || `Prize ${idx + 1}`}
      </Typography>

      <Box sx={{ display: "flex", gap: 3, alignItems: "center" }}>
        {/* Left: 3D Flippable Card — exact same approach as experience web */}
        <Box sx={{ width: CARD_WIDTH, flexShrink: 0 }}>
          <Box sx={{ perspective: "4800px", width: CARD_WIDTH, height: CARD_HEIGHT }}>
            <Box
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              sx={{
                position: "relative", width: "100%", height: "100%",
                transformStyle: "preserve-3d",
                transform: `scale(${dragging ? 1.03 : 1}) rotateY(${rotationY}deg)`,
                transition: dragging ? 'none' : 'transform 0.5s cubic-bezier(.2,.9,.25,1)',
                cursor: dragging ? "grabbing" : "grab",
                touchAction: "none",
              }}
            >
              {/* Front face */}
              <Box sx={{
                position: "absolute", inset: 0, backfaceVisibility: "hidden",
                transform: "translateZ(5px)",
                borderRadius: 0, overflow: "hidden",
                background: style === 'card'
                  ? `linear-gradient(135deg, #0D1B2A 0%, ${color}88 55%, ${color} 100%)`
                  : style === 'image' && (prize.imagePreview || prize.imageUrl) ? '#000'
                  : `radial-gradient(circle at 30% 20%, ${color}99 0%, ${color} 45%, ${color}cc 100%)`,
                boxShadow: "0 24px 44px -18px rgba(13, 27, 42, 0.45)",
              }}>
                {style === 'card' ? (
                  <Box sx={{ position: "absolute", inset: 0, p: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 36, height: 26, borderRadius: "5px", background: "linear-gradient(135deg, #f4d99a, #cf9f4d)", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }} />
                      <Typography sx={{ fontSize: 9, letterSpacing: 1.8, opacity: 0.85, fontWeight: 700, color: "#fff" }}>TABS EXPERIENCE</Typography>
                    </Box>
                    <Typography sx={{ fontSize: 14, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "#fff" }}>
                      {prize.name || 'PRIZE'}
                    </Typography>
                    <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                      <Typography sx={{ fontSize: 9, color: "#fff", opacity: 0.7 }}>{`Prize ${idx + 1}`}</Typography>
                      <Typography sx={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>{prize.value ? `$${prize.value}` : '🎯'}</Typography>
                    </Box>
                  </Box>
                ) : style === 'image' && (prize.imagePreview || prize.imageUrl) ? (
                  <img src={prize.imagePreview || prize.imageUrl} alt={prize.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : style === 'image' ? (
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a2e" }}>
                    <Typography sx={{ fontSize: 28 }}>📷</Typography>
                  </Box>
                ) : (
                  <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Box sx={{ position: "relative", width: 60, height: 48, borderRadius: "5px", background: "linear-gradient(155deg, #fff 0%, #f1f4f6 100%)", boxShadow: "0 8px 16px -6px rgba(13,27,42,0.3)" }}>
                      <Box sx={{ position: "absolute", top: -7, left: -3, right: -3, height: 15, borderRadius: "4px", background: "linear-gradient(155deg, #fff 0%, #e9edf0 100%)" }} />
                      <Box sx={{ position: "absolute", top: -7, bottom: 0, left: "50%", width: 9, ml: "-4.5px", background: `linear-gradient(180deg, ${color}cc, ${color})` }} />
                      <Box sx={{ position: "absolute", left: -3, right: -3, top: 20, height: 9, background: `linear-gradient(90deg, ${color}cc, ${color})` }} />
                    </Box>
                  </Box>
                )}
              </Box>
              {/* Edge thickness — top/bottom */}
              <Box sx={{ position: "absolute", left: 0, right: 0, height: "10px", top: "calc(50% - 5px)", transformStyle: "preserve-3d", transform: `rotateX(90deg) translateZ(${CARD_HEIGHT / 2}px)`, background: `linear-gradient(180deg, rgba(255,255,255,0.28), rgba(0,0,0,0.4)), #1a2942` }} />
              <Box sx={{ position: "absolute", left: 0, right: 0, height: "10px", top: "calc(50% - 5px)", transformStyle: "preserve-3d", transform: `rotateX(-90deg) translateZ(${CARD_HEIGHT / 2}px)`, background: `linear-gradient(180deg, rgba(0,0,0,0.4), rgba(255,255,255,0.28)), #1a2942` }} />
              {/* Edge thickness — left/right */}
              <Box sx={{ position: "absolute", top: 0, bottom: 0, width: "10px", left: "calc(50% - 5px)", transformStyle: "preserve-3d", transform: `rotateY(-90deg) translateZ(${CARD_WIDTH / 2}px)`, background: `linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.3), rgba(0,0,0,0.45)), #1a2942` }} />
              <Box sx={{ position: "absolute", top: 0, bottom: 0, width: "10px", left: "calc(50% - 5px)", transformStyle: "preserve-3d", transform: `rotateY(90deg) translateZ(${CARD_WIDTH / 2}px)`, background: `linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.3), rgba(0,0,0,0.45)), #1a2942` }} />
              {/* Back face */}
              <Box sx={{
                position: "absolute", inset: 0, backfaceVisibility: "hidden",
                transform: "rotateY(180deg) translateZ(5px)",
                borderRadius: 0, overflow: "hidden",
                background: `linear-gradient(150deg, #0D1B2A 0%, ${color}66 60%, ${color} 100%)`,
                boxShadow: "0 24px 44px -18px rgba(13, 27, 42, 0.45)",
                p: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#fff",
              }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography sx={{ fontSize: 9, letterSpacing: 1.5, fontWeight: 800, opacity: 0.7 }}>GIFT CARD</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 900, color: `${color}cc` }}>{prize.value ? `$${prize.value}` : ''}</Typography>
                </Box>
                <Box sx={{ height: 22, background: "rgba(255,255,255,0.15)", borderRadius: 0.5 }} />
                <Box>
                  <Typography sx={{ fontSize: 9, opacity: 0.5, letterSpacing: 1, mb: 0.3 }}>•••• •••• •••• ••••</Typography>
                  <Typography sx={{ fontSize: 11, fontWeight: 700 }}>{prize.name || 'Prize'}</Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Typography sx={{ fontSize: 10, color: "#9CA3AF", textAlign: "center", mt: 0.5 }}>↔ Drag to flip</Typography>
        </Box>

        {/* Right: Radio-style selector + photo upload */}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 1.5 }}>
          <Typography sx={{ fontSize: 11, color: "#6B7280", mb: 0.5, fontWeight: 600 }}>Card Style</Typography>
          {[
            { id: "gift", label: "Gift Box", desc: "Animated gift with ribbon", icon: <CardGiftcardOutlinedIcon sx={{ fontSize: 18, color: "#6B7280" }} /> },
            { id: "card", label: "Gift Card", desc: "Credit card style", icon: <CreditCardOutlinedIcon sx={{ fontSize: 18, color: "#6B7280" }} /> },
            { id: "image", label: "Photo Only", desc: "Upload a prize image", icon: <ImageOutlinedIcon sx={{ fontSize: 18, color: "#6B7280" }} /> },
          ].map(opt => (
            <Box
              key={opt.id}
              onClick={() => {
                const updated = [...form.prizes];
                updated[idx] = { ...updated[idx], bannerStyle: opt.id };
                updateField("prizes", updated);
              }}
              sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                p: 1.2, borderRadius: 1.5, cursor: "pointer",
                border: style === opt.id ? "1.5px solid #E5E7EB" : "1px solid #E5E7EB",
                background: style === opt.id ? "#F0FDFF" : "transparent",
                transition: "all 0.15s",
              }}
            >
              <Box sx={{
                width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                border: style === opt.id ? "5px solid #00AAD6" : "2px solid #D1D5DB",
                background: "#fff", transition: "all 0.15s",
              }} />
              {opt.icon}
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{opt.label}</Typography>
                <Typography sx={{ fontSize: 11, color: "#6B7280" }}>{opt.desc}</Typography>
              </Box>
            </Box>
          ))}
          {style === "image" && (
            <Box sx={{ mt: 1 }}>
              {(prize.imagePreview || prize.imageUrl) ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, p: 1, border: "1px solid #E5E7EB", borderRadius: 1.5, background: "#FAFBFC" }}>
                  <img src={prize.imagePreview || prize.imageUrl} alt="Prize" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />
                  <Typography sx={{ fontSize: 11, color: "#374151", flex: 1 }}>Image uploaded</Typography>
                  <IconButton size="small" onClick={() => { const updated = [...form.prizes]; updated[idx] = { ...updated[idx], imagePreview: null, imageFile: null, imageUrl: "" }; updateField("prizes", updated); }}>
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              ) : (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", border: "1.5px dashed #D1D5DB", borderRadius: 8, cursor: "pointer", background: "#FAFBFC" }}>
                  <span style={{ fontSize: 18 }}>📷</span>
                  <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>Upload prize image</span>
                  <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files[0]; if (file) { const updated = [...form.prizes]; updated[idx] = { ...updated[idx], imagePreview: URL.createObjectURL(file), imageFile: file, bannerStyle: "image" }; updateField("prizes", updated); } }} />
                </label>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
});

PrizeAppearanceCard.displayName = 'PrizeAppearanceCard';

const RaffleConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [instanceState, setInstanceState] = useState("Draft");
  const [showDemoPreview, setShowDemoPreview] = useState(false);
  const [demoPreviewUrl, setDemoPreviewUrl] = useState("");
  const [showRulesPreview, setShowRulesPreview] = useState(false);
  const [eventData, setEventData] = useState(null);

  // Draggable phone frame state
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = React.useRef({ x: 0, y: 0 });

  const handleDragStart = (e) => {
    e.preventDefault();
    setDragging(true);
    dragOffset.current = { x: e.clientX - dragPos.x, y: e.clientY - dragPos.y };
  };

  React.useEffect(() => {
    if (!dragging) return;
    const handleMove = (e) => {
      setDragPos({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging]);

  // Fetch event data to get ticket types
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const token = localStorage.getItem("idToken");
        const userId = parseJwt(token);
        if (!userId) return;
        const res = await getEvent(userId, eventId);
        const event = res.data?.data || res.data || res;
        setEventData(event);

        // Pre-fill schedule from event start/end dates
        if (event.startDate && event.endDate) {
          const start = dayjs(event.startDate);
          const end = dayjs(event.endDate);
          const drawingTime = end.add(1, 'hour');
          setForm(f => ({
            ...f,
            entryWindowStart: f.entryWindowStart || start,
            entryWindowEnd: f.entryWindowEnd || end,
            drawingSchedules: f.drawingSchedules[0]?.time ? f.drawingSchedules : [{ time: drawingTime, winners: 1 }],
          }));
        }
      } catch (err) {
        console.log('RaffleConfig: Failed to fetch event data', err);
      }
    };
    if (eventId) fetchEvent();
  }, [eventId]);

  // Fetch existing instance config if editing
  useEffect(() => {
    if (!eventId || !experienceId) return;
    const fetchInstance = async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        if (instance?.state) setInstanceState(instance.state);
        if (instance?.config && Object.keys(instance.config).length > 0) {
          const cfg = instance.config;
          setForm(f => ({
            ...f,
            raffleType: cfg.raffleType || f.raffleType,
            bannerStyle: cfg.bannerStyle || f.bannerStyle,
            accentColor: cfg.accentColor || f.accentColor,
            // Re-seed the string fields: the API omits empty attributes, and the
            // form renders them as controlled inputs that require a string.
            prizes: cfg.prizes?.length ? cfg.prizes.map((p, i) => ({
              ...p,
              id: p.id || `prize-${i + 1}`,
              name: p.name ?? "",
              description: p.description ?? "",
              imagePreview: p.imageUrl || null,
            })) : f.prizes,
            entryWindowStart: cfg.entryWindowStart ? dayjs(cfg.entryWindowStart) : f.entryWindowStart,
            entryWindowEnd: cfg.entryWindowEnd ? dayjs(cfg.entryWindowEnd) : f.entryWindowEnd,
            drawingSchedules: cfg.drawingSchedules?.length ? cfg.drawingSchedules.map(s => ({ time: s.time ? dayjs(s.time) : null, winners: s.winners || 1, prizeIndex: s.prizeIndex })) : f.drawingSchedules,
            eligibilityRules: (() => { const rules = cfg.eligibilityRules?.length ? cfg.eligibilityRules : f.eligibilityRules; if (!rules.includes('single_entry') && !rules.includes('max_entries')) return [...rules, 'single_entry']; return rules; })(),
            maxEntries: cfg.maxEntries || f.maxEntries,
            accessCodes: Array.isArray(cfg.accessCodeDisplay) ? cfg.accessCodeDisplay.join(', ') : (Array.isArray(cfg.accessCodes) ? cfg.accessCodes.filter(c => !/^[a-f0-9]{64}$/i.test(c)).join(', ') : (cfg.accessCodes || f.accessCodes)),
            allowedTicketTypes: Array.isArray(cfg.allowedTicketTypes) ? cfg.allowedTicketTypes.join(', ') : (cfg.allowedTicketTypes || f.allowedTicketTypes),
            entryModel: cfg.entryModel || f.entryModel,
            infoCollection: cfg.infoCollection || f.infoCollection,
            ticketBundles: cfg.ticketBundles?.length ? cfg.ticketBundles : f.ticketBundles,
            hasSponsor: !!cfg.sponsor,
            sponsorName: cfg.sponsor?.name || f.sponsorName,
            sponsorLogoUrl: cfg.sponsor?.logoUrl || f.sponsorLogoUrl,
            sponsorPlacement: cfg.sponsor?.placement || f.sponsorPlacement,
            sponsorAmount: cfg.sponsor?.amount || f.sponsorAmount,
            entryConfirmationTemplate: cfg.notifications?.entryConfirmation || f.entryConfirmationTemplate,
            drawingReminderTemplate: cfg.notifications?.drawingReminder || f.drawingReminderTemplate,
            winnerAnnouncementTemplate: cfg.notifications?.winnerAnnouncement || f.winnerAnnouncementTemplate,
            claimExpirationTemplate: cfg.notifications?.claimExpiration || f.claimExpirationTemplate,
            // Older configs stored `jurisdictions` at the top level, sometimes as
            // an array — the form treats it as a comma-separated string.
            jurisdictions: Array.isArray(cfg.compliance?.jurisdictions)
              ? cfg.compliance.jurisdictions.join(', ')
              : Array.isArray(cfg.jurisdictions)
                ? cfg.jurisdictions.join(', ')
                : (cfg.jurisdictions || f.jurisdictions),
            complianceAcknowledged: cfg.compliance?.acknowledged || f.complianceAcknowledged,
            requireTermsConsent: cfg.compliance?.requireTerms !== undefined ? cfg.compliance.requireTerms : true,
            rulesPreviewedByAdmin: cfg.compliance?.acknowledged || false,
            rulesStrictness: cfg.compliance?.rulesStrictness || f.rulesStrictness,
            sponsorLegalName: cfg.compliance?.sponsorLegalName || f.sponsorLegalName,
            privacyPolicyUrl: cfg.compliance?.privacyPolicyUrl || f.privacyPolicyUrl,
            supportContact: cfg.compliance?.supportContact || f.supportContact,
          }));
        }
      } catch (err) {
        console.log('RaffleConfig: Failed to fetch instance config', err);
      }
    };
    fetchInstance();
  }, [eventId, experienceId]);

  // Derived: does this event use Tabs Ticketing?
  const hasTabsTicketing = eventData?.ticketType === 'tabs' 
    || eventData?.tickType === 'tabs'
    || eventData?.hasTickets === true
    || (eventData?.tickets || []).some(t => t.option === 'Tabs Tickets');
  const eventTicketTypes = (eventData?.tickets || [])
    .filter(t => t.option === "Tabs Tickets" || t.option === "Tickets with Tabs")
    .map(t => t.type)
    .filter(Boolean);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when it changes
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Inner tab state for steps with sub-tabs
  const [innerTab, setInnerTab] = useState(0);

  // Define how many inner tabs each step has (0 = no inner tabs)
  const INNER_TAB_COUNT = { 1: 3, 2: 2, 3: 3 }; // step 1: Prizes/Appearance/Schedule, step 2: Eligibility/Info Collection, step 3: Sponsor/Notifications/Compliance

  // Hash tag mapping for each step + inner tab
  const HASH_MAP = {
    '0-0': 'raffle-type',
    '1-0': 'appearance',
    '1-1': 'prizes',
    '1-2': 'schedule',
    '2-0': 'ticket-pricing',
    '2-1': 'eligibility',
    '2-2': 'info-collection',
    '3-0': 'sponsor',
    '3-1': 'notifications',
    '3-2': 'compliance',
    '4-0': 'review',
  };

  // Reverse lookup: hash → { step, innerTab }
  const HASH_TO_POSITION = Object.entries(HASH_MAP).reduce((acc, [key, hash]) => {
    const [step, tab] = key.split('-').map(Number);
    acc[hash] = { step, tab };
    return acc;
  }, {});

  // Update URL hash when step/innerTab changes
  useEffect(() => {
    const hash = HASH_MAP[`${activeStep}-${innerTab}`];
    if (hash) {
      window.history.replaceState(null, '', `#${hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, innerTab]);

  // Restore position from URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && HASH_TO_POSITION[hash]) {
      const { step, tab } = HASH_TO_POSITION[hash];
      setActiveStep(step);
      setInnerTab(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNext = () => {
    const tabCount = INNER_TAB_COUNT[activeStep] || 0;
    // If this step has inner tabs and we're not on the last one, validate current tab then advance
    if (tabCount > 0 && innerTab < tabCount - 1) {
      const tabErrors = validateInnerTab(activeStep, innerTab, form);
      if (Object.keys(tabErrors).length > 0) {
        setErrors((prev) => ({ ...prev, ...tabErrors }));
        return;
      }
      setInnerTab(innerTab + 1);
      return;
    }
    // On the last inner tab (or no inner tabs), validate the full step
    const stepErrors = validateStep(activeStep, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...stepErrors }));
      return;
    }
    setInnerTab(0); // Reset inner tab for next step
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    const tabCount = INNER_TAB_COUNT[activeStep] || 0;
    // If this step has inner tabs and we're not on the first one, go back in inner tabs
    if (tabCount > 0 && innerTab > 0) {
      setInnerTab(innerTab - 1);
      return;
    }
    // Go to previous main step, set inner tab to last tab of that step
    const prevStep = activeStep - 1;
    const prevTabCount = INNER_TAB_COUNT[prevStep] || 0;
    setInnerTab(prevTabCount > 0 ? prevTabCount - 1 : 0);
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    const allErrors = validateAll(form);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setSubmitError("Please fix all validation errors before submitting.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      // Upload prize images to S3 if any
      const updatedPrizes = await Promise.all(
        form.prizes.map(async (prize, idx) => {
          if (prize.imageFile) {
            try {
              const { default: http } = await import("../../utils/axios/http");
              const res = await http.post(
                `v1/events/${eventId}/experiences/${experienceId}/presigned-url`,
                { prizeIndex: idx, contentType: prize.imageFile.type || "image/jpeg" }
              );
              const result = res.data;
              console.log('📸 Presigned URL response:', result);
              if (result.status === "success" && result.data?.presignedUrl) {
                // Upload image to S3
                console.log('📸 Uploading to S3...', { size: prize.imageFile.size, type: prize.imageFile.type });
                const uploadRes = await fetch(result.data.presignedUrl, {
                  method: "PUT",
                  body: prize.imageFile,
                  headers: { "Content-Type": prize.imageFile.type || "image/jpeg" },
                });
                console.log('📸 S3 upload response:', uploadRes.status, uploadRes.statusText);
                if (uploadRes.ok) {
                  return { ...prize, imageUrl: result.data.publicUrl, imageFile: undefined, imagePreview: undefined };
                } else {
                  console.error('📸 S3 upload failed:', uploadRes.status);
                }
              }
            } catch (err) {
              console.warn("Prize image upload failed:", err);
            }
          }
          // Keep existing imageUrl if no new file, remove local-only fields
          const { imageFile, imagePreview, ...cleanPrize } = prize;
          // Only keep imageUrl if it's a real URL (not a blob: URL)
          const existingUrl = prize.imageUrl && !prize.imageUrl.startsWith('blob:') ? prize.imageUrl : undefined;
          return { ...cleanPrize, imageUrl: existingUrl };
        })
      );

      // Upload sponsor images to S3 if any
      const updatedSponsors = await Promise.all(
        form.sponsors.map(async (sponsor, idx) => {
          if (sponsor.logoFile) {
            try {
              const { default: http } = await import("../../utils/axios/http");
              const res = await http.post(
                `v1/events/${eventId}/experiences/${experienceId}/presigned-url`,
                { sponsorIndex: idx, contentType: sponsor.logoFile.type || "image/png" }
              );
              const result = res.data;
              if (result.status === "success" && result.data?.presignedUrl) {
                const uploadRes = await fetch(result.data.presignedUrl, {
                  method: "PUT",
                  body: sponsor.logoFile,
                  headers: { "Content-Type": sponsor.logoFile.type || "image/png" },
                });
                if (uploadRes.ok) {
                  return { ...sponsor, logoUrl: result.data.publicUrl, logoFile: null, logoPreview: null };
                }
              }
            } catch (err) {
              console.warn("Sponsor image upload failed:", err);
            }
          }
          const { logoFile, logoPreview, ...cleanSponsor } = sponsor;
          return cleanSponsor;
        })
      );

      // Build config payload
      const config = {
        raffleType: form.raffleType,
        bannerStyle: form.bannerStyle,
        accentColor: form.accentColor,
        prizes: updatedPrizes,
        entryWindowStart: form.entryWindowStart?.toISOString(),
        entryWindowEnd: form.entryWindowEnd?.toISOString(),
        drawingSchedules: form.drawingSchedules.map((s) => ({
          time: s.time?.toISOString(),
          winners: s.winners,
          prizeIndex: s.prizeIndex,
        })),
        eligibilityRules: form.eligibilityRules,
        maxEntries: form.eligibilityRules.includes("max_entries") ? form.maxEntries : undefined,
        accessCodes: form.eligibilityRules.includes("access_code")
          ? form.accessCodes.split(",").map((c) => c.trim()).filter(Boolean)
          : undefined,
        allowedTicketTypes: form.eligibilityRules.includes("ticket_type")
          ? form.allowedTicketTypes.split(",").map((t) => t.trim()).filter(Boolean)
          : undefined,
        entryModel: form.entryModel,
        infoCollection: form.infoCollection,
        ticketBundles: form.entryModel === "paid" ? form.ticketBundles : undefined,
        sponsor: form.hasSponsor
          ? updatedSponsors.map((s) => ({
              name: s.name,
              logoUrl: s.logoUrl,
              colors: s.colors ? (typeof s.colors === 'string' ? s.colors.split(",").map((c) => c.trim()).filter(Boolean) : s.colors) : [],
              placement: s.placement,
              amount: parseFloat(s.amount) || 0,
              prizeId: s.prizeId || undefined,
              prizePurpose: s.prizePurpose || undefined,
              prizeTerms: s.prizeTerms || undefined,
              prizeFulfillment: s.prizeFulfillment || undefined,
              description: s.description || undefined,
              website: s.website || undefined,
            }))
          : undefined,
        sponsors: form.hasSponsor
          ? updatedSponsors.map((s) => ({
              name: s.name,
              logoUrl: s.logoUrl,
              colors: s.colors ? (typeof s.colors === 'string' ? s.colors.split(",").map((c) => c.trim()).filter(Boolean) : s.colors) : [],
              placement: s.placement,
              amount: parseFloat(s.amount) || 0,
              prizeId: s.prizeId || undefined,
              prizePurpose: s.prizePurpose || undefined,
              prizeTerms: s.prizeTerms || undefined,
              prizeFulfillment: s.prizeFulfillment || undefined,
              description: s.description || undefined,
              website: s.website || undefined,
            }))
          : undefined,
        notifications: {
          entryConfirmation: form.entryConfirmationTemplate,
          drawingReminder: form.drawingReminderTemplate,
          winnerAnnouncement: form.winnerAnnouncementTemplate,
          claimExpiration: form.claimExpirationTemplate,
        },
        compliance: {
          jurisdictions: form.jurisdictions.split(",").map((j) => j.trim()).filter(Boolean),
          acknowledged: form.complianceAcknowledged,
          requireTerms: form.requireTermsConsent,
          rulesStrictness: form.rulesStrictness,
          sponsorLegalName: form.sponsorLegalName,
          privacyPolicyUrl: form.privacyPolicyUrl,
          supportContact: form.supportContact,
        },
      };

      // Save config to instance
      await updateInstance(eventId, experienceId, { config });
      // Only transition from Draft → Scheduled; if already Scheduled, just save
      if (instanceState === "Draft") {
        await transitionState(eventId, experienceId, { action: "submit" });
      }
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to submit raffle configuration. Please try again.";
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Step Renderers ─────────────────────────────────────────────────────────

  const renderRaffleType = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>What type of raffle?</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#71727A", fontSize: 13 }}>
        Choose how prizes and winnings are distributed.
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        {RAFFLE_TYPES.map((type) => {
          const isSelected = form.raffleType === type.value;
          const icons = { prize: CardGiftcardOutlinedIcon, "5050": PieChartOutlinedIcon, progressive: TrendingUpOutlinedIcon };
          const Icon = icons[type.value];
          return (
            <Box
              key={type.value}
              onClick={() => updateField("raffleType", type.value)}
              sx={{
                flex: 1, p: 2.5, borderRadius: 2, cursor: "pointer", textAlign: "center",
                border: isSelected ? "2px solid #00AAD6" : "1px solid #E5E7EB",
                background: isSelected ? "#F0FDFF" : "#fff",
                transition: "all 0.15s",
                "&:hover": { borderColor: isSelected ? "#00AAD6" : "#D1D5DB", background: isSelected ? "#E6F9FC" : "#FAFBFC" },
              }}
            >
              <Icon sx={{ fontSize: 32, mb: 1, color: isSelected ? "#00AAD6" : "#9CA3AF" }} />
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{type.label}</Typography>
              <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>{type.description}</Typography>
            </Box>
          );
        })}
      </Box>
      {errors.raffleType && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>{errors.raffleType}</Typography>
      )}
    </Box>
  );

  const renderAppearance = () => {
    const color = form.accentColor || '#00A9D6';
    return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Appearance</Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>Choose how each prize appears to attendees</Typography>

      {/* Global Accent Color */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 3, background: "#fff" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: "#111827" }}>Theme Color</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mb: 1 }}>Accent color used across all prize displays</Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          {[
            { name: "Tabs Cyan", value: "#00A9D6" },
            { name: "Ember", value: "#F47A20" },
            { name: "Grape", value: "#8B5CF6" },
            { name: "Lime", value: "#22C55E" },
            { name: "Rose", value: "#E8467A" },
            { name: "Gold", value: "#F09925" },
            { name: "Navy", value: "#1E3A5F" },
          ].map(c => (
            <Box
              key={c.value}
              onClick={() => updateField("accentColor", c.value)}
              title={c.name}
              sx={{
                width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                background: c.value,
                border: color === c.value ? "3px solid #0D1B2A" : "2px solid #fff",
                boxShadow: color === c.value ? "0 0 0 1px #0D1B2A" : "0 0 0 1px #d9dee2",
                transition: "all 0.2s",
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => updateField("accentColor", e.target.value)}
            style={{ width: 30, height: 30, border: "none", borderRadius: "50%", padding: 0, cursor: "pointer", background: "none" }}
            title="Custom color"
          />
        </Box>
      </Box>

      {/* Per-prize style selector with preview */}
      {form.prizes.map((prize, idx) => {
        const style = prize.bannerStyle || form.bannerStyle || 'gift';
        return (
        <PrizeAppearanceCard
          key={prize.id || `prize-appearance-${idx}`}
          prize={prize}
          idx={idx}
          style={style}
          color={color}
          form={form}
          updateField={updateField}
          errors={errors}
        />
        );
      })}
    </Box>
    );
  };

  const renderPrizeConfig = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Prizes</Typography>

      {form.prizes.map((prize, idx) => (
        <PrizeItem
          key={prize.id || `prize-${idx}`}
          prize={prize}
          idx={idx}
          errors={errors}
          canDelete={form.prizes.length > 1}
          eventId={eventId}
          bannerStyle={form.bannerStyle}
          onUpdate={(updatedPrize) => {
            const updated = [...form.prizes];
            updated[idx] = updatedPrize;
            updateField("prizes", updated);
          }}
          onDelete={() => {
            const updated = form.prizes.filter((_, i) => i !== idx);
            updateField("prizes", updated);
          }}
        />
      ))}
      <Button
        startIcon={<AddIcon />}
        onClick={() => updateField("prizes", [...form.prizes, { id: `prize-${Date.now()}`, name: "", description: "", quantity: 1, winnersPerDrawing: 1 }])}
        sx={{ textTransform: "none" }}
      >
        Add Prize Tier
      </Button>
    </Box>
  );

  const renderSchedule = () => (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Schedule</Typography>
        <Box sx={{ display: "flex", gap: 2, mb: 3 }}>
          <DateTimePicker
            label="Entry Window Start"
            value={form.entryWindowStart}
            onChange={(val) => updateField("entryWindowStart", val)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!errors.entryWindowStart,
                helperText: errors.entryWindowStart,
              },
            }}
          />
          <DateTimePicker
            label="Entry Window End"
            value={form.entryWindowEnd}
            onChange={(val) => updateField("entryWindowEnd", val)}
            slotProps={{
              textField: {
                fullWidth: true,
                error: !!errors.entryWindowEnd,
                helperText: errors.entryWindowEnd,
              },
            }}
          />
        </Box>

        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          Drawing Schedules ({form.drawingSchedules.length}/20)
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: "#71727A", fontSize: 12 }}>
          A drawing randomly selects winners from entries. Schedule when each drawing occurs — entries must close before the first one.
        </Typography>
        {errors.drawingSchedules && (
          <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
            {errors.drawingSchedules}
          </Typography>
        )}
        {form.drawingSchedules.map((sched, idx) => (
          <Box key={idx} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
            <DateTimePicker
              label={`Drawing ${idx + 1} Time`}
              value={sched.time}
              onChange={(val) => {
                const updated = [...form.drawingSchedules];
                updated[idx] = { ...updated[idx], time: val };
                updateField("drawingSchedules", updated);
              }}
              slotProps={{
                textField: {
                  error: !!errors[`drawingSchedules[${idx}].time`],
                  helperText: errors[`drawingSchedules[${idx}].time`],
                  sx: { flex: 2, minWidth: 200 },
                },
              }}
            />
            <TextField
              label="Winners"
              type="number"
              value={sched.winners || ""}
              onChange={(e) => {
                const updated = [...form.drawingSchedules];
                const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1);
                updated[idx] = { ...updated[idx], winners: val };
                updateField("drawingSchedules", updated);
              }}
              error={!!errors[`drawingSchedules[${idx}].winners`]}
              helperText={errors[`drawingSchedules[${idx}].winners`]}
              inputProps={{ min: 1 }}
              sx={{ flex: 1, minWidth: 80 }}
            />
            {form.prizes.length > 1 && (
              <TextField
                select
                label="Prize"
                value={sched.prizeIndex ?? ""}
                onChange={(e) => {
                  const updated = [...form.drawingSchedules];
                  updated[idx] = { ...updated[idx], prizeIndex: e.target.value === "" ? undefined : parseInt(e.target.value) };
                  updateField("drawingSchedules", updated);
                }}
                SelectProps={{ native: true }}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1.5, minWidth: 150 }}
              >
                <option value="">All Prizes</option>
                {form.prizes.map((prize, pIdx) => (
                  <option key={pIdx} value={pIdx}>{prize.name || `Prize ${pIdx + 1}`}</option>
                ))}
              </TextField>
            )}
            {form.drawingSchedules.length > 1 && (
              <IconButton onClick={() => {
                const updated = form.drawingSchedules.filter((_, i) => i !== idx);
                updateField("drawingSchedules", updated);
              }}>
                <DeleteIcon />
              </IconButton>
            )}
          </Box>
        ))}
        {form.drawingSchedules.length < 20 && (
          <Button
            startIcon={<AddIcon />}
            onClick={() => updateField("drawingSchedules", [...form.drawingSchedules, { time: null, winners: 1 }])}
            sx={{ textTransform: "none" }}
          >
            Add Drawing Schedule
          </Button>
        )}
      </Box>
    </LocalizationProvider>
  );

  const ELIGIBILITY_DESCRIPTIONS = {
    open: "Anyone at the event can enter — no restrictions.",
    ticket_type: "Only attendees with specific ticket types can enter.",
    single_entry: "Each person can only enter once — prevents duplicate entries.",
    max_entries: "Limit how many times each person can enter.",
    access_code: "Attendees need a special code to enter. You control who gets the code.",
  };

  // Show all eligibility options, but grey out ticket_type if no Tabs Ticketing
  const availableEligibilityOptions = ELIGIBILITY_OPTIONS;

  const renderEligibility = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Who Can Enter?</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#71727A", fontSize: 13 }}>
        Choose who's eligible to enter this raffle. You can combine multiple rules.
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
        {availableEligibilityOptions.map((opt) => {
          const isSelected = opt.value === "open"
            ? !form.eligibilityRules.includes("ticket_type") && !form.eligibilityRules.includes("access_code")
            : form.eligibilityRules.includes(opt.value);
          const isDisabled = opt.value === "ticket_type" && !hasTabsTicketing;
          const hasConfig = isSelected && (opt.value === "max_entries" || opt.value === "access_code" || opt.value === "ticket_type");
          return (
            <Box key={opt.value}>
              <Box
                onClick={() => {
                  if (isDisabled) return;
                  if (opt.value === "open") {
                    // Selecting "Open to All" clears WHO restrictions (ticket_type, access_code) but keeps HOW restrictions (single_entry, max_entries)
                    const howRules = form.eligibilityRules.filter(r => r === "single_entry" || r === "max_entries");
                    updateField("eligibilityRules", howRules);
                    return;
                  }
                  // Single Entry and Max Entries are mutually exclusive
                  let rules;
                  if (opt.value === "single_entry" && !isSelected) {
                    rules = [...form.eligibilityRules.filter(r => r !== "max_entries"), "single_entry"];
                  } else if (opt.value === "max_entries" && !isSelected) {
                    rules = [...form.eligibilityRules.filter(r => r !== "single_entry"), "max_entries"];
                  } else {
                    if (isSelected) {
                      // Prevent deselecting single_entry/max_entries if the other isn't selected
                      if ((opt.value === 'single_entry' || opt.value === 'max_entries') && 
                          !form.eligibilityRules.includes(opt.value === 'single_entry' ? 'max_entries' : 'single_entry')) {
                        return; // Must have one of single_entry or max_entries
                      }
                      rules = form.eligibilityRules.filter((r) => r !== opt.value);
                    } else {
                      rules = [...form.eligibilityRules, opt.value];
                    }
                  }
                  updateField("eligibilityRules", rules);
                  // Auto-generate access code when selecting Access Code Required
                  if (!isSelected && opt.value === "access_code" && !form.accessCodes) {
                    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                    updateField("accessCodes", code);
                  }
                }}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  p: 1.5, borderRadius: hasConfig ? "8px 8px 0 0" : 2,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                  opacity: isDisabled ? 0.5 : 1,
                  border: isSelected ? "2px solid #00AAD6" : "1px solid #E5E7EB",
                  borderBottom: hasConfig ? "none" : undefined,
                  background: isDisabled ? "#F3F4F6" : isSelected ? "#F0FDFF" : "#fff",
                  transition: "all 0.15s",
                  "&:hover": isDisabled ? {} : { borderColor: isSelected ? "#00AAD6" : "#D1D5DB", background: isSelected ? "#E6F9FC" : "#FAFBFC" },
                  position: "relative",
                }}
              >
                {isDisabled && (
                  <Typography sx={{ position: "absolute", top: -8, left: 10, fontSize: 9, fontWeight: 600, color: "#9CA3AF", background: "#F3F4F6", px: 0.5 }}>
                    Only with Tabs Tickets
                  </Typography>
                )}
                <Box sx={{ width: 20, height: 20, borderRadius: "4px", border: isSelected ? "2px solid #00AAD6" : "2px solid #D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {isSelected && <Box sx={{ width: 10, height: 10, borderRadius: "2px", background: "#00AAD6" }} />}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: isDisabled ? "#9CA3AF" : "#111827" }}>{opt.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: "#71727A", mt: 0.3 }}>{ELIGIBILITY_DESCRIPTIONS[opt.value]}</Typography>
                </Box>
              </Box>

              {/* Inline config for Max Entries */}
              {isSelected && opt.value === "max_entries" && (
                <Box sx={{ border: "2px solid #00AAD6", borderTop: "none", borderRadius: "0 0 8px 8px", p: 1.5, background: "#F0FDFF" }}>
                  <TextField
                    fullWidth
                    label="Max Entries Per Attendee"
                    value={form.maxEntries || ""}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9]/g, '');
                      if (raw === "") { updateField("maxEntries", ""); return; }
                      const num = Math.min(100, Math.max(1, parseInt(raw) || 1));
                      updateField("maxEntries", num);
                    }}
                    error={!!errors.maxEntries}
                    helperText={errors.maxEntries || "Between 1 and 100"}
                    inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
                    size="small"
                  />
                </Box>
              )}

              {/* Inline config for Access Code */}
              {isSelected && opt.value === "access_code" && (
                <Box sx={{ border: "2px solid #00AAD6", borderTop: "none", borderRadius: "0 0 8px 8px", p: 1.5, background: "#F0FDFF" }}>
                  <Typography sx={{ fontSize: 11, color: "#71727A", mb: 0.5 }}>Share this code with eligible attendees:</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography sx={{ fontFamily: "monospace", fontSize: 18, fontWeight: 800, color: "#111827", letterSpacing: 2 }}>
                      {form.accessCodes || "------"}
                    </Typography>
                    <Button
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                        const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
                        updateField("accessCodes", code);
                      }}
                      sx={{ textTransform: "none", fontWeight: 600, fontSize: 11, minWidth: 0, color: "#00AAD6" }}
                    >
                      ↻ New Code
                    </Button>
                  </Box>
                </Box>
              )}

              {/* Inline config for Ticket Type */}
              {isSelected && opt.value === "ticket_type" && hasTabsTicketing && (
                <Box sx={{ border: "2px solid #00AAD6", borderTop: "none", borderRadius: "0 0 8px 8px", p: 1.5, background: "#F0FDFF" }}>
                  <Typography sx={{ fontSize: 11, color: "#71727A", mb: 0.5 }}>Select which ticket holders can enter:</Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {eventTicketTypes.map((ticketType) => {
                      const selectedTypes = form.allowedTicketTypes ? form.allowedTicketTypes.split(',').map(t => t.trim()).filter(Boolean) : [];
                      const isTicketSelected = selectedTypes.includes(ticketType);
                      return (
                        <Chip key={ticketType} label={ticketType} size="small" color={isTicketSelected ? "info" : "default"} variant={isTicketSelected ? "filled" : "outlined"} onClick={() => { const updated = isTicketSelected ? selectedTypes.filter(t => t !== ticketType).join(', ') : [...selectedTypes, ticketType].join(', '); updateField("allowedTicketTypes", updated); }} sx={{ fontWeight: 600, cursor: "pointer" }} />
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

    </Box>
  );

  const renderInfoCollection = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>What info do you collect?</Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "#71727A", fontSize: 13 }}>
        Choose what information to collect from entrants before they enter the raffle.
      </Typography>
      <Box sx={{ display: "flex", gap: 1.5 }}>
        <Box
          onClick={() => updateField("infoCollection", "minimum")}
          sx={{
            flex: 1, p: 2, borderRadius: 2, cursor: "pointer", textAlign: "center",
            border: form.infoCollection === "minimum" ? "2px solid #00AAD6" : "1.5px solid #E5E7EB",
            background: form.infoCollection === "minimum" ? "rgba(0,170,214,0.06)" : "#fff",
            transition: "all 0.2s",
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Minimum</Typography>
          <Typography sx={{ fontSize: 12, color: "#71727A" }}>Name, Email, Phone</Typography>
        </Box>
        <Box
          onClick={() => updateField("infoCollection", "full")}
          sx={{
            flex: 1, p: 2, borderRadius: 2, cursor: "pointer", textAlign: "center",
            border: form.infoCollection === "full" ? "2px solid #00AAD6" : "1.5px solid #E5E7EB",
            background: form.infoCollection === "full" ? "rgba(0,170,214,0.06)" : "#fff",
            transition: "all 0.2s",
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>Full</Typography>
          <Typography sx={{ fontSize: 12, color: "#71727A" }}>Name, Email, Phone, Address</Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderSponsor = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Is this raffle sponsored?</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#71727A", fontSize: 13 }}>
        If brands are funding the prizes, add their details here. Their logos will appear on the raffle page.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
        <Box
          onClick={() => updateField("hasSponsor", false)}
          sx={{
            flex: 1, p: 2, borderRadius: 2, cursor: "pointer",
            border: !form.hasSponsor ? "2px solid #00AAD6" : "1px solid #E5E7EB",
            background: !form.hasSponsor ? "#F0FDFF" : "#fff",
            textAlign: "center", transition: "all 0.15s",
            "&:hover": { borderColor: !form.hasSponsor ? "#00AAD6" : "#D1D5DB" },
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No Sponsor</Typography>
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>I'm funding the prizes myself</Typography>
        </Box>
        <Box
          onClick={() => updateField("hasSponsor", true)}
          sx={{
            flex: 1, p: 2, borderRadius: 2, cursor: "pointer",
            border: form.hasSponsor ? "2px solid #00AAD6" : "1px solid #E5E7EB",
            background: form.hasSponsor ? "#F0FDFF" : "#fff",
            textAlign: "center", transition: "all 0.15s",
            "&:hover": { borderColor: form.hasSponsor ? "#00AAD6" : "#D1D5DB" },
          }}
        >
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Add a Sponsor</Typography>
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>One or more brands are sponsoring this raffle</Typography>
        </Box>
      </Box>

      {form.hasSponsor && (
        <Box>
          {form.sponsors.map((sponsor, idx) => (
            <SponsorCard
              key={sponsor.id}
              sponsor={sponsor}
              idx={idx}
              form={form}
              errors={errors}
              updateField={updateField}
              canDelete={form.sponsors.length > 1}
            />
          ))}
          {/* Add another sponsor button */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<span style={{ fontSize: 16 }}>+</span>}
            onClick={() => {
              const newSponsor = {
                id: `sponsor-${Date.now()}`,
                name: "", logoUrl: "", logoFile: null, logoPreview: null,
                colors: "", placement: "header_banner", amount: "",
                prizeId: "", prizePurpose: "", prizeTerms: "", prizeFulfillment: "",
                description: "", website: "",
              };
              updateField("sponsors", [...form.sponsors, newSponsor]);
            }}
            sx={{
              borderColor: "#E5E7EB", color: "#6B7280", textTransform: "none",
              "&:hover": { borderColor: "#00AAD6", color: "#00AAD6" },
            }}
          >
            Add Another Sponsor
          </Button>
        </Box>
      )}
    </Box>
  );

  const [generatingAI, setGeneratingAI] = useState(false);

  const generateAITemplates = async () => {
    setGeneratingAI(true);
    try {
      const token = localStorage.getItem("idToken");
      const baseUrl = require("../../config.json").backendUrl;
      const response = await fetch(`${baseUrl}v1/events/${eventId}/experiences/generate-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          prompt: `Generate 4 short notification messages (under 280 chars each) for a raffle experience at an event. The raffle type is "${form.raffleType || 'prize'}". The first prize is "${form.prizes[0]?.name || 'a prize'}". The event name will be inserted as {{eventName}}, attendee name as {{attendeeName}}, experience name as {{experienceName}}.

Return JSON with keys: entryConfirmation, drawingReminder, winnerAnnouncement, claimExpiration. Each value is the message text. Be friendly, concise, use 1-2 emojis per message.`,
          format: "json"
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const result = data.data || data.result || data;
        if (result.entryConfirmation) updateField("entryConfirmationTemplate", result.entryConfirmation);
        if (result.drawingReminder) updateField("drawingReminderTemplate", result.drawingReminder);
        if (result.winnerAnnouncement) updateField("winnerAnnouncementTemplate", result.winnerAnnouncement);
        if (result.claimExpiration) updateField("claimExpirationTemplate", result.claimExpiration);
      } else {
        // Fallback to local templates if API fails
        generateLocalTemplates();
      }
    } catch {
      generateLocalTemplates();
    } finally {
      setGeneratingAI(false);
    }
  };

  const generateLocalTemplates = () => {
    const prizeName = form.prizes[0]?.name || "a prize";
    const raffleLabel = RAFFLE_TYPES.find(t => t.value === form.raffleType)?.label || "raffle";
    updateField("entryConfirmationTemplate", `You're in, {{attendeeName}}! Your entry for {{experienceName}} at {{eventName}} is confirmed. Good luck! 🎉`);
    updateField("drawingReminderTemplate", `Heads up, {{attendeeName}}! The ${raffleLabel} drawing for {{experienceName}} is happening soon. Stay tuned! 🎯`);
    updateField("winnerAnnouncementTemplate", `🎊 Congratulations {{attendeeName}}! You've won ${prizeName} in {{experienceName}} at {{eventName}}! Check your app to claim.`);
    updateField("claimExpirationTemplate", `⏰ {{attendeeName}}, your prize from {{experienceName}} is about to expire! Claim it now before it's too late.`);
  };

  const renderNotifications = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Notifications</Typography>
      <Typography variant="body2" sx={{ mb: 2, color: "#71727A", fontSize: 13 }}>
        Messages sent to attendees at key moments. You can write your own or let AI generate them.
      </Typography>

      {!form.entryConfirmationTemplate && !form.drawingReminderTemplate && !form.winnerAnnouncementTemplate && !form.claimExpirationTemplate ? (
        <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
          <Box
            onClick={() => !generatingAI && generateAITemplates()}
            sx={{
              flex: 1, p: 2.5, borderRadius: 2, cursor: generatingAI ? "wait" : "pointer", textAlign: "center",
              border: "1px solid #E5E7EB", background: "#fff", transition: "all 0.15s",
              "&:hover": { borderColor: "#00AAD6", background: "#F0FDFF" },
              opacity: generatingAI ? 0.7 : 1,
            }}
          >
            <Typography sx={{ fontSize: 24, mb: 0.5 }}>{generatingAI ? "⏳" : "✨"}</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{generatingAI ? "Generating..." : "Generate with AI"}</Typography>
            <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>Auto-write all 4 templates using OpenAI</Typography>
          </Box>
          <Box
            onClick={() => updateField("entryConfirmationTemplate", " ")}
            sx={{
              flex: 1, p: 2.5, borderRadius: 2, cursor: "pointer", textAlign: "center",
              border: "1px solid #E5E7EB", background: "#fff", transition: "all 0.15s",
              "&:hover": { borderColor: "#D1D5DB", background: "#FAFBFC" },
            }}
          >
            <Typography sx={{ fontSize: 24, mb: 0.5 }}>✏️</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Write My Own</Typography>
            <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>Manually customize each notification</Typography>
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
            <Button size="small" onClick={generateAITemplates} sx={{ textTransform: "none", fontWeight: 600, color: "#00AAD6", fontSize: 12 }}>
              ✨ Regenerate All
            </Button>
          </Box>
          <TextField
            fullWidth
            label="Entry Confirmation"
            multiline
            rows={2}
            value={form.entryConfirmationTemplate?.trim() || ""}
            onChange={(e) => updateField("entryConfirmationTemplate", e.target.value)}
            error={!!errors.entryConfirmationTemplate}
            helperText={errors.entryConfirmationTemplate || `${(form.entryConfirmationTemplate || "").length}/300`}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Drawing Reminder"
            multiline
            rows={2}
            value={form.drawingReminderTemplate}
            onChange={(e) => updateField("drawingReminderTemplate", e.target.value)}
            error={!!errors.drawingReminderTemplate}
            helperText={errors.drawingReminderTemplate || `${(form.drawingReminderTemplate || "").length}/300`}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Winner Announcement"
            multiline
            rows={2}
            value={form.winnerAnnouncementTemplate}
            onChange={(e) => updateField("winnerAnnouncementTemplate", e.target.value)}
            error={!!errors.winnerAnnouncementTemplate}
            helperText={errors.winnerAnnouncementTemplate || `${(form.winnerAnnouncementTemplate || "").length}/300`}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Claim Expiration Warning"
            multiline
            rows={2}
            value={form.claimExpirationTemplate}
            onChange={(e) => updateField("claimExpirationTemplate", e.target.value)}
            error={!!errors.claimExpirationTemplate}
            helperText={errors.claimExpirationTemplate || `${(form.claimExpirationTemplate || "").length}/300`}
          />
        </>
      )}
    </Box>
  );

  const renderCompliance = () => {
    // State name → abbreviation mapping for normalization
    const STATE_ABBREVS = {
      'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
      'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
      'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
      'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
      'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
      'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
      'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
      'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
      'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
      'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY',
    };

    // Auto-fill jurisdiction from event location if not already set
    const eventState = eventData?.state || eventData?.location?.state || eventData?.venue?.state || '';
    if (eventState && !form.jurisdictions) {
      const stateUpper = eventState.toUpperCase().replace(/^US-/, '');
      const abbrev = STATE_ABBREVS[stateUpper] || (stateUpper.length === 2 ? stateUpper : '');
      if (abbrev) {
        setTimeout(() => updateField("jurisdictions", `US-${abbrev}`), 0);
      }
    }

    // Normalize jurisdiction input (e.g. "US-TEXAS" → "US-TX")
    const normalizeJurisdiction = (val) => {
      return val.split(',').map(j => {
        const trimmed = j.trim().toUpperCase();
        const match = trimmed.match(/^US-(.+)$/);
        if (match) {
          const stateInput = match[1];
          // If it's already a 2-letter code, keep it
          if (stateInput.length === 2) return `US-${stateInput}`;
          // Otherwise try to resolve the full name
          const abbrev = STATE_ABBREVS[stateInput];
          if (abbrev) return `US-${abbrev}`;
        }
        return trimmed;
      }).join(', ');
    };

    // State-specific rules summaries
    const RULES_BY_STATE = {
      'US-TX': {
        title: 'Texas Raffle Rules',
        rules: [
          'Raffles are legal when conducted by qualified nonprofit organizations',
          'Prize value and ticket price must be clearly disclosed',
          'Winners must be selected by random drawing',
          'No purchase necessary alternative must be provided for sweepstakes',
          'All prizes must be awarded as advertised',
        ],
      },
      'US-CA': {
        title: 'California Raffle Rules',
        rules: [
          'Only registered nonprofit organizations may conduct raffles',
          '90% of gross receipts must go to beneficial/charitable purposes',
          'No one may be compensated for selling raffle tickets',
          'Winners must be drawn at an event open to all ticket holders',
          'Annual report must be filed with the Attorney General',
        ],
      },
      'US-NY': {
        title: 'New York Raffle Rules',
        rules: [
          'Games of chance licenses required from local municipality',
          'Must be conducted by authorized organizations only',
          'Single prize may not exceed set statutory limits',
          'Net proceeds must be used exclusively for lawful purposes',
          'Records must be maintained for 3 years',
        ],
      },
      'US-FL': {
        title: 'Florida Raffle Rules',
        rules: [
          'Only qualified nonprofit organizations may conduct raffles',
          'Drawing must be held in Florida',
          'No person may receive compensation for ticket sales',
          'Must maintain records and comply with disclosure requirements',
        ],
      },
    };

    const selectedStates = String(form.jurisdictions || "").split(',').map(j => j.trim()).filter(Boolean);
    const matchedRules = selectedStates.map(s => RULES_BY_STATE[s]).filter(Boolean);

    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Compliance</Typography>

        {/* Legal Details — required for Official Rules generation */}
        <Box sx={{ mb: 2.5, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#FAFBFC" }}>
          <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827", mb: 1.5 }}>
            📋 Sponsor Legal Details
          </Typography>
          <Typography sx={{ fontSize: 11.5, color: "#6B7280", mb: 2 }}>
            These details will appear in the Official Rules shown to attendees.
          </Typography>
          <TextField
            fullWidth
            size="small"
            label="Sponsor Legal Name *"
            placeholder="e.g. UrbanHTX LLC"
            value={form.sponsorLegalName}
            onChange={(e) => updateField("sponsorLegalName", e.target.value)}
            error={!!errors.sponsorLegalName}
            helperText={errors.sponsorLegalName}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Privacy Policy URL *"
            placeholder="https://yoursite.com/privacy"
            value={form.privacyPolicyUrl}
            onChange={(e) => updateField("privacyPolicyUrl", e.target.value)}
            error={!!errors.privacyPolicyUrl}
            helperText={errors.privacyPolicyUrl}
            sx={{ mb: 1.5 }}
          />
          <TextField
            fullWidth
            size="small"
            label="Support Contact (email or phone) *"
            placeholder="support@yourbusiness.com"
            value={form.supportContact}
            onChange={(e) => updateField("supportContact", e.target.value)}
            error={!!errors.supportContact}
            helperText={errors.supportContact}
          />
        </Box>

        <TextField
          fullWidth
          size="small"
          label="Jurisdictions (country-state codes, comma-separated)"
          value={form.jurisdictions}
          onChange={(e) => updateField("jurisdictions", e.target.value)}
          onBlur={(e) => {
            const normalized = normalizeJurisdiction(e.target.value);
            if (normalized !== form.jurisdictions) {
              updateField("jurisdictions", normalized);
            }
          }}
          error={!!errors.jurisdictions}
          helperText={errors.jurisdictions || "e.g. US-TX, US-CA, US-NY (full state names like US-TEXAS also work)"}
          sx={{ mb: 2 }}
        />

        {/* Rules Preview */}
        {matchedRules.length > 0 && (
          <Box sx={{ mb: 2 }}>
            {matchedRules.map((ruleSet, idx) => (
              <Box key={idx} sx={{ p: 2, border: "1px solid #E5E7EB", borderRadius: 2, mb: 1.5, background: "#FAFBFC" }}>
                <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827", mb: 1 }}>
                  📋 {ruleSet.title}
                </Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  {ruleSet.rules.map((rule, rIdx) => (
                    <Box component="li" key={rIdx} sx={{ fontSize: 12, color: "#4B5563", mb: 0.5, lineHeight: 1.5 }}>
                      {rule}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}

        {selectedStates.length > 0 && matchedRules.length === 0 && (
          <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#FAFBFC" }}>
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827", mb: 1 }}>
              📋 Rules Template
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: "#6B7280", mb: 1.5 }}>
              No state-specific rules template found for your jurisdiction. Choose a rules level below — this determines how strict the Official Rules shown to attendees will be.
            </Typography>
            <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
              {[
                { value: "standard", label: "Standard", desc: "Basic compliance — no purchase necessary, random selection, prize disclosure" },
                { value: "restrictive", label: "Restrictive", desc: "Stricter rules — age verification, residency requirements, detailed eligibility" },
                { value: "permissive", label: "Permissive", desc: "Minimal rules — open entry, fewer restrictions, broad eligibility" },
              ].map((option) => (
                <Box
                  key={option.value}
                  onClick={() => updateField("rulesStrictness", option.value)}
                  sx={{
                    flex: 1, minWidth: 150, p: 1.5, cursor: "pointer", borderRadius: 2,
                    border: form.rulesStrictness === option.value ? "2px solid #00AAD6" : "1px solid #E5E7EB",
                    background: form.rulesStrictness === option.value ? "#f0fdff" : "#fff",
                    transition: "all 0.15s",
                    "&:hover": { borderColor: "#00AAD6" },
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: 12, color: form.rulesStrictness === option.value ? "#00AAD6" : "#111827" }}>
                    {option.label}
                  </Typography>
                  <Typography sx={{ fontSize: 10.5, color: "#6B7280", mt: 0.5, lineHeight: 1.4 }}>
                    {option.desc}
                  </Typography>
                </Box>
              ))}
            </Box>
            {form.rulesStrictness && (
              <Box sx={{ mt: 1.5, p: 1.5, background: form.rulesStrictness === 'restrictive' ? '#FEF3C7' : form.rulesStrictness === 'permissive' ? '#D1FAE5' : '#EFF6FF', borderRadius: 1.5 }}>
                <Typography sx={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>
                  {form.rulesStrictness === 'standard' && '📋 Standard: Includes no-purchase-necessary clause, random selection disclosure, prize details, and basic eligibility (18+).'}
                  {form.rulesStrictness === 'restrictive' && '⚠️ Restrictive: Adds residency requirements, government ID verification, void-where-prohibited clause, and federal/state/local law compliance.'}
                  {form.rulesStrictness === 'permissive' && '✅ Permissive: Minimal restrictions — open to all attendees, no residency or ID requirements, simplified conditions.'}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Alert severity="info" sx={{ mb: 3, fontSize: 12 }}>
          Raffle legality varies by jurisdiction. Complete the steps below before submitting.
        </Alert>

        {/* Step 1: Require attendees to agree */}
        <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#FAFBFC" }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: "#00AAD6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, mt: 0.25 }}>1</Box>
            <Box sx={{ flex: 1 }}>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    checked={form.requireTermsConsent}
                    onChange={(e) => updateField("requireTermsConsent", e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                      Require attendees to agree to rules before entering
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 0.25 }}>
                      When enabled, attendees must review and accept the Official Rules before they can submit an entry.
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
        </Box>

        {/* Step 2: Preview the rules */}
        <Box sx={{ mb: 2, p: 2, border: `1px solid ${form.rulesPreviewedByAdmin ? "#34c471" : "#E5E7EB"}`, borderRadius: 2, background: form.rulesPreviewedByAdmin ? "#f0fdf4" : "#FAFBFC" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: form.rulesPreviewedByAdmin ? "#34c471" : "#00AAD6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
              {form.rulesPreviewedByAdmin ? "✓" : "2"}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                Preview Official Rules
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 0.25 }}>
                You must review the generated rules before you can submit.
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                updateField("rulesPreviewedByAdmin", true);
                setShowRulesPreview(true);
              }}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                fontSize: 12,
                borderColor: form.rulesPreviewedByAdmin ? "#34c471" : "#00AAD6",
                color: form.rulesPreviewedByAdmin ? "#34c471" : "#00AAD6",
                "&:hover": { borderColor: form.rulesPreviewedByAdmin ? "#1f9d55" : "#0088b0", background: form.rulesPreviewedByAdmin ? "#f0fdf4" : "#f0fdff" },
              }}
            >
              {form.rulesPreviewedByAdmin ? "✓ Done" : "Preview"}
            </Button>
          </Box>
          {errors.rulesPreviewedByAdmin && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5, ml: 5 }}>
              {errors.rulesPreviewedByAdmin}
            </Typography>
          )}
        </Box>

        {/* Step 3: Acknowledge compliance */}
        <Box sx={{ mb: 2, p: 2, border: `1px solid ${form.complianceAcknowledged ? "#34c471" : "#E5E7EB"}`, borderRadius: 2, background: form.complianceAcknowledged ? "#f0fdf4" : "#FAFBFC", opacity: form.rulesPreviewedByAdmin ? 1 : 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ width: 24, height: 24, borderRadius: "50%", background: form.complianceAcknowledged ? "#34c471" : (form.rulesPreviewedByAdmin ? "#00AAD6" : "#9E9E9E"), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0, mt: 0.25 }}>
              {form.complianceAcknowledged ? "✓" : "3"}
            </Box>
            <Box sx={{ flex: 1 }}>
              <FormControlLabel
                sx={{ m: 0 }}
                control={
                  <Switch
                    checked={form.complianceAcknowledged}
                    onChange={(e) => updateField("complianceAcknowledged", e.target.checked)}
                    disabled={!form.rulesPreviewedByAdmin}
                  />
                }
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                      Acknowledge compliance
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: "#6B7280", mt: 0.25 }}>
                      I confirm I have reviewed applicable local regulations for the selected jurisdictions.
                    </Typography>
                  </Box>
                }
              />
            </Box>
          </Box>
          {errors.complianceAcknowledged && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5, ml: 5 }}>
              {errors.complianceAcknowledged}
            </Typography>
          )}
        </Box>
      </Box>
    );
  };

  const renderReview = () => {
    const raffleLabel = RAFFLE_TYPES.find((t) => t.value === form.raffleType)?.label || form.raffleType;
    const goToStep = (step, tab = 0) => { setActiveStep(step); setInnerTab(tab); };
    return (
      <div className="ecn-page">
        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t">🎯 Raffle Type</div><button className="ecn-rv-e" onClick={() => goToStep(0)}>Edit</button></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Type</span><span className="ecn-rv-v">{raffleLabel}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Banner</span><span className="ecn-rv-v">{form.bannerStyle === 'gift' ? '🎁 Gift Box' : form.bannerStyle === 'card' ? '💳 Gift Card' : '📷 Photo'}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Color</span><span className="ecn-rv-v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: '50%', background: form.accentColor, display: 'inline-block', border: '1px solid #ddd' }} />{form.accentColor}</span></div>
        </div>

        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t">🏆 Prizes ({form.prizes.length})</div><button className="ecn-rv-e" onClick={() => goToStep(1, 1)}>Edit</button></div>
          {form.prizes.map((p, idx) => (
            <div key={idx} className="ecn-rv-r"><span className="ecn-rv-l">{p.name || `Prize ${idx + 1}`}</span><span className="ecn-rv-v">{p.value ? `$${p.value}` : ''} · Qty: {p.quantity} · {p.winnersPerDrawing}/draw</span></div>
          ))}
        </div>

        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t">📅 Schedule</div><button className="ecn-rv-e" onClick={() => goToStep(1, 2)}>Edit</button></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Entries Open</span><span className="ecn-rv-v">{form.entryWindowStart?.format?.("MMM D, YYYY h:mm A") || "—"}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Entries Close</span><span className="ecn-rv-v">{form.entryWindowEnd?.format?.("MMM D, YYYY h:mm A") || "—"}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Drawings</span><span className="ecn-rv-v">{form.drawingSchedules.length} scheduled</span></div>
          {form.drawingSchedules.map((s, idx) => (
            <div key={idx} className="ecn-rv-r"><span className="ecn-rv-l">Drawing {idx + 1}</span><span className="ecn-rv-v">{s.time?.format?.("MMM D h:mm A") || "—"} · {s.winners} winner{s.winners > 1 ? 's' : ''}</span></div>
          ))}
        </div>

        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t">🎟️ Entry Rules</div><button className="ecn-rv-e" onClick={() => goToStep(2)}>Edit</button></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Eligibility</span><span className="ecn-rv-v">{form.eligibilityRules.length === 0 ? "Open to All" : form.eligibilityRules.map((r) => ELIGIBILITY_OPTIONS.find((o) => o.value === r)?.label || r).join(", ")}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Info Collection</span><span className="ecn-rv-v">{form.infoCollection === 'full' ? 'Full (Name, Email, Phone, Address)' : 'Minimum (Name, Email, Phone)'}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Entry Model</span><span className="ecn-rv-v">{form.entryModel === "free" ? "Free Entry" : `Paid — ${form.ticketBundles.length} tier${form.ticketBundles.length > 1 ? 's' : ''}`}</span></div>
          {form.entryModel === "paid" && form.ticketBundles.map((b, idx) => (
            <div key={idx} className="ecn-rv-r"><span className="ecn-rv-l">Bundle {idx + 1}</span><span className="ecn-rv-v">{b.quantity} ticket{b.quantity > 1 ? 's' : ''} · ${b.price}</span></div>
          ))}
        </div>

        <div className="ecn-rv-s">
          <div className="ecn-rv-h"><div className="ecn-rv-t">🤝 Sponsor & Compliance</div><button className="ecn-rv-e" onClick={() => goToStep(3)}>Edit</button></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Sponsor</span><span className="ecn-rv-v">{form.hasSponsor ? form.sponsorName : "None"}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Jurisdictions</span><span className="ecn-rv-v">{form.jurisdictions || "—"}</span></div>
          <div className="ecn-rv-r"><span className="ecn-rv-l">Acknowledged</span><span className="ecn-rv-v" style={{ color: form.complianceAcknowledged ? '#22c55e' : '#ef4444' }}>{form.complianceAcknowledged ? "✓ Yes" : "✕ No"}</span></div>
        </div>
      </div>
    );
  };

  const renderPrizeScheduleContent = () => {
    const tabs = ['Prizes', 'Appearance', 'Schedule'];
    return (
      <Box>
        <Box sx={{ display: "flex", gap: 0, mb: 3, borderBottom: "2px solid #E5E7EB" }}>
          {tabs.map((label, idx) => (
            <Box
              key={label}
              onClick={() => setInnerTab(idx)}
              sx={{
                px: 2.5, py: 1.2, cursor: "pointer", fontWeight: 700, fontSize: 13,
                color: innerTab === idx ? "#00AAD6" : "#6B7280",
                borderBottom: innerTab === idx ? "2px solid #00AAD6" : "2px solid transparent",
                marginBottom: "-2px", transition: "all 0.2s",
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
        {innerTab === 0 && renderPrizeConfig()}
        {innerTab === 1 && renderAppearance()}
        {innerTab === 2 && renderSchedule()}
      </Box>
    );
  };

  const renderEntryRulesContent = () => {
    const tabs = ['Eligibility', 'Info Collection'];
    return (
      <Box>
        <Box sx={{ display: "flex", gap: 0, mb: 3, borderBottom: "2px solid #E5E7EB" }}>
          {tabs.map((label, idx) => (
            <Box
              key={label}
              onClick={() => setInnerTab(idx)}
              sx={{
                px: 2.5, py: 1.2, cursor: "pointer", fontWeight: 700, fontSize: 13,
                color: innerTab === idx ? "#00AAD6" : "#6B7280",
                borderBottom: innerTab === idx ? "2px solid #00AAD6" : "2px solid transparent",
                marginBottom: "-2px", transition: "all 0.2s",
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
        {innerTab === 0 && renderEligibility()}
        {innerTab === 1 && renderInfoCollection()}
      </Box>
    );
  };

  const renderSponsorNotificationsContent = () => {
    const tabs = ['Sponsor', 'Notifications', 'Compliance'];
    return (
      <Box>
        <Box sx={{ display: "flex", gap: 0, mb: 3, borderBottom: "2px solid #E5E7EB" }}>
          {tabs.map((label, idx) => (
            <Box
              key={label}
              onClick={() => setInnerTab(idx)}
              sx={{
                px: 2.5, py: 1.2, cursor: "pointer", fontWeight: 700, fontSize: 13,
                color: innerTab === idx ? "#00AAD6" : "#6B7280",
                borderBottom: innerTab === idx ? "2px solid #00AAD6" : "2px solid transparent",
                marginBottom: "-2px", transition: "all 0.2s",
              }}
            >
              {label}
            </Box>
          ))}
        </Box>
        {innerTab === 0 && renderSponsor()}
        {innerTab === 1 && renderNotifications()}
        {innerTab === 2 && renderCompliance()}
      </Box>
    );
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0: return renderRaffleType();
      case 1: return renderPrizeScheduleContent();
      case 2: return renderEntryRulesContent();
      case 3: return renderSponsorNotificationsContent();
      case 4: return renderReview();
      default: return null;
    }
  };

  const ECN_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
:root{--or:#F5A623;--ord:#E09415;--te:#5BB8C1;--ted:#3D9DA6;--tx:#2d3748;--mu:#8a9ab0;--li:#c4cdd6;--ca:rgba(255,255,255,.90);--ib:rgba(255,255,255,.95);--ibr:#dde4ed;--sh:0 4px 28px rgba(0,0,0,.08);--ss:0 2px 12px rgba(0,0,0,.05);--tr:.2s cubic-bezier(.4,0,.2,1)}
.ecn-wrap{min-height:100vh;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:24px;font-family:'Nunito',sans-serif;color:var(--tx);overflow-x:hidden}
.ecn-wrap .MuiOutlinedInput-root{background:#fff}
.ecn-wrap .MuiInputLabel-shrink{background:#fff;padding:0 6px}
.ecn-pg-h{font-size:22px;font-weight:700;color:#F09925;margin-bottom:5px;font-family:'Outfit','Nunito',sans-serif}
.ecn-pg-s{font-size:13px;color:#6B7280;margin-bottom:24px;line-height:1.5}
.ecn-steps{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:14px 18px;width:100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.ecn-steps::-webkit-scrollbar{display:none}
.ecn-step-btn{padding:8px 14px;border:none;border-radius:9px;font-size:12px;font-weight:500;color:#5a738a;cursor:default;transition:all 0.22s;font-family:'Nunito',sans-serif;background:none;white-space:nowrap}
.ecn-step-btn.cur{background:#0077cc;color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,119,204,0.25)}
.ecn-step-btn.done{color:#1ab76b;font-weight:600}
.ecn-card{background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:16px}
.ecn-foot{position:sticky;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-top:1px solid #E5E7EB;padding:13px 24px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 -2px 12px rgba(0,0,0,.04);border-radius:0 0 16px 16px;margin-top:20px}
.ecn-bn{background:var(--or);color:#fff;border:none;border-radius:12px;padding:12px 34px;font-size:14.5px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(245,166,35,.33);transition:all var(--tr)}
.ecn-bn:hover{background:var(--ord);transform:translateY(-1px);box-shadow:0 6px 20px rgba(245,166,35,.40)}
.ecn-bn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.ecn-bb{background:rgba(255,255,255,.80);color:var(--tx);border:1.5px solid rgba(0,0,0,.09);border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all var(--tr)}
.ecn-bb:hover{background:#fff}
.ecn-err-banner{background:rgba(239,68,68,.06);border:1.5px solid rgba(239,68,68,.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#ef4444;font-weight:600}
.ecn-rv-s{background:rgba(255,255,255,.65);border-radius:13px;padding:17px 19px;margin-bottom:11px;border:1.5px solid rgba(0,0,0,.055)}
.ecn-rv-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:11px}
.ecn-rv-t{font-size:13px;font-weight:800;color:var(--tx);display:flex;align-items:center;gap:7px}
.ecn-rv-e{font-size:12px;color:var(--ted);font-weight:700;cursor:pointer;border:none;background:none;font-family:'Nunito',sans-serif}
.ecn-rv-e:hover{text-decoration:underline}
.ecn-rv-r{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid rgba(0,0,0,.04);font-size:13px}
.ecn-rv-r:last-child{border-bottom:none}
.ecn-rv-l{color:var(--mu);font-weight:600}
.ecn-rv-v{color:var(--tx);font-weight:700;text-align:right;max-width:64%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ecn-pc{background:#fff;border-radius:13px;padding:17px 19px;border:1.5px solid rgba(0,0,0,.06);box-shadow:0 2px 12px rgba(0,0,0,.05)}
.ecn-pl{font-size:10px;font-weight:800;color:var(--mu);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.ecn-pv{font-size:13px;font-weight:700;color:var(--tx);margin-bottom:8px}
.ecn-fdv{height:1px;background:var(--ibr);margin:8px 0}
.ecn-fee{display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:4px}
.ecn-fee span:first-child{color:var(--mu);font-weight:600}
.ecn-fee span:last-child{color:var(--tx);font-weight:700}
.ecn-tbtn{width:100%;padding:9px 16px;border-radius:9px;background:rgba(0,170,214,.06);border:1.5px solid rgba(0,170,214,.2);color:#00AAD6;font-size:12px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;transition:all var(--tr);text-align:center}
.ecn-tbtn:hover{background:rgba(0,170,214,.12);border-color:rgba(0,170,214,.4)}
.ecn-pc-img{width:100%;height:120px;border-radius:9px;object-fit:cover;margin-bottom:10px}
`;

  return (
    <div className="ecn-wrap">
      <style>{ECN_STYLES}</style>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div className="ecn-header">
          <h1 className="ecn-pg-h">Configure Raffle</h1>
          <p className="ecn-pg-s">{instanceState === "Draft" ? "Complete all steps to schedule your raffle. Submitting transitions this raffle from Draft to Scheduled." : "Edit your raffle configuration. Changes are saved immediately."}</p>

          <div className="ecn-steps" style={{ marginBottom: 24 }}>
            <button className="ecn-bb" onClick={() => navigate(`/admin/my-events/${eventId}/experiences`)} style={{ margin: 0 }}>
              ‹ Back
            </button>
            {STEPS.map((label, idx) => (
              <button
                key={label}
                className={`ecn-step-btn${activeStep === idx ? " cur" : activeStep > idx ? " done" : ""}`}
                onClick={() => { if (idx < activeStep) { setActiveStep(idx); setInnerTab(0); } }}
                style={{ cursor: idx <= activeStep ? 'pointer' : 'default' }}
              >
                {activeStep > idx ? "✓ " : ""}{label}
              </button>
            ))}
          </div>
        </div>

        {submitError && (
          <div className="ecn-err-banner">⚠ {submitError}</div>
        )}

        <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
          <div className="ecn-card" style={{ minHeight: 300, flex: 1 }}>
            {renderStepContent(activeStep)}
          </div>

          {/* Live Preview Panel */}
          <div className="ecn-pc" style={{ width: 240, flexShrink: 0, position: "sticky", top: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <span style={{ fontSize: 14 }}>🎯</span>
              <span style={{ fontSize: 11, fontWeight: 900, color: "var(--ted)", letterSpacing: .5 }}>RAFFLE PREVIEW</span>
            </div>
            {eventData?.name && (
              <>
                <div className="ecn-pl">EVENT</div>
                <div className="ecn-pv">{eventData.name}</div>
              </>
            )}
            {form.prizes[0]?.imagePreview && (
              <img src={form.prizes[0].imagePreview} alt="Prize" className="ecn-pc-img" />
            )}
            <div className="ecn-pl">EXPERIENCE</div>
            <div className="ecn-pv">{RAFFLE_TYPES.find(t => t.value === form.raffleType)?.label || "Prize Raffle"}</div>
            {form.prizes[0]?.name && (
              <>
                <div className="ecn-pl">PRIZE</div>
                <div className="ecn-pv" style={{ fontSize: 12.5 }}>{form.prizes[0].name}{form.prizes.length > 1 ? ` +${form.prizes.length - 1} more` : ''}</div>
              </>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="ecn-pl">ENTRIES OPEN</div>
                <div className="ecn-pv" style={{ fontSize: 11 }}>{form.entryWindowStart ? form.entryWindowStart.format?.("MMM D, h:mm A") : "—"}</div>
              </div>
              <div>
                <div className="ecn-pl">ENTRIES CLOSE</div>
                <div className="ecn-pv" style={{ fontSize: 11 }}>{form.entryWindowEnd ? form.entryWindowEnd.format?.("MMM D, h:mm A") : "—"}</div>
              </div>
            </div>
            <div className="ecn-pl">DRAWING</div>
            <div className="ecn-pv" style={{ fontSize: 11 }}>
              {form.drawingSchedules[0]?.time ? form.drawingSchedules[0].time.format?.("MMM D, h:mm A") : "—"}
              {form.drawingSchedules.length > 1 ? ` (+${form.drawingSchedules.length - 1} more)` : ''}
            </div>
            <div className="ecn-fdv" />
            <div className="ecn-fee"><span>Software Fee:</span><span>{form.entryModel === "paid" ? `$${form.ticketBundles[0]?.price || 0}` : "Free"}</span></div>
            <div className="ecn-fee"><span>Eligibility:</span><span>{form.eligibilityRules.length === 0 ? "Open" : form.eligibilityRules.length + " rules"}</span></div>
            {form.hasSponsor && form.sponsorName && (
              <div className="ecn-fee"><span>Sponsor:</span><span>{form.sponsorName}</span></div>
            )}
            <div className="ecn-fdv" />
            <button
              className="ecn-tbtn"
              onClick={async () => {
                // Save current config to backend before opening preview so it reflects latest changes
                try {
                  const config = {
                    raffleType: form.raffleType,
                    bannerStyle: form.bannerStyle,
                    accentColor: form.accentColor,
                    prizes: form.prizes.map(({ imageFile, imagePreview, ...p }) => ({
                      ...p,
                      imageUrl: p.imageUrl && !p.imageUrl.startsWith('blob:') ? p.imageUrl : undefined,
                    })),
                    entryWindowStart: form.entryWindowStart?.toISOString?.() || form.entryWindowStart,
                    entryWindowEnd: form.entryWindowEnd?.toISOString?.() || form.entryWindowEnd,
                    drawingSchedules: form.drawingSchedules.map((s) => ({
                      time: s.time?.toISOString?.() || s.time,
                      winners: s.winners,
                    })),
                    eligibilityRules: form.eligibilityRules,
                    maxEntries: form.eligibilityRules.includes("max_entries") ? form.maxEntries : undefined,
                    accessCodes: form.eligibilityRules.includes("access_code")
                      ? (form.accessCodes || "").split(",").map((c) => c.trim()).filter(Boolean)
                      : undefined,
                    allowedTicketTypes: form.eligibilityRules.includes("ticket_type")
                      ? (form.allowedTicketTypes || "").split(",").map((t) => t.trim()).filter(Boolean)
                      : undefined,
                    entryModel: form.entryModel,
                    infoCollection: form.infoCollection,
                    ticketBundles: form.entryModel === "paid" ? form.ticketBundles : undefined,
                    notifications: {
                      entryConfirmation: form.entryConfirmationTemplate,
                      drawingReminder: form.drawingReminderTemplate,
                      winnerAnnouncement: form.winnerAnnouncementTemplate,
                      claimExpiration: form.claimExpirationTemplate,
                    },
                    compliance: {
                      jurisdictions: (form.jurisdictions || "").split(",").map((j) => j.trim()).filter(Boolean),
                      acknowledged: form.complianceAcknowledged,
                      rulesStrictness: form.rulesStrictness,
                      requireTerms: form.requireTermsConsent,
                      sponsorLegalName: form.sponsorLegalName,
                      privacyPolicyUrl: form.privacyPolicyUrl,
                      supportContact: form.supportContact,
                    },
                  };
                  await updateInstance(eventId, experienceId, { config });
                } catch (e) {
                  console.warn("Preview: draft save failed, opening with last saved config", e.message);
                }
                const previewUrl = `https://engage.keeptabs.app/e/${experienceId}/enter?test=true&eventId=${eventId}&eventName=${encodeURIComponent(eventData?.name || '')}&accentColor=${encodeURIComponent(form.accentColor)}&bannerStyle=${encodeURIComponent(form.bannerStyle)}&prizeName=${encodeURIComponent(form.prizes[0]?.name || '')}&infoCollection=${encodeURIComponent(form.infoCollection)}&prizes=${encodeURIComponent(JSON.stringify(form.prizes.map(p => ({ name: p.name, description: p.description, value: p.value, imageUrl: p.imageUrl || '', bannerStyle: p.bannerStyle || '' }))))}&eligibilityRules=${encodeURIComponent(JSON.stringify(form.eligibilityRules))}&accessCodes=${encodeURIComponent(form.eligibilityRules.includes('access_code') ? form.accessCodes : '')}`;
                setDemoPreviewUrl(previewUrl);
                setShowDemoPreview(true);
              }}
            >
              Open Demo Preview
            </button>
          </div>
        </div>

        <div className="ecn-foot">
          <button
            className="ecn-bb"
            onClick={handleBack}
            disabled={activeStep === 0}
            style={{ opacity: activeStep === 0 ? 0.4 : 1, cursor: activeStep === 0 ? 'not-allowed' : 'pointer' }}
          >
            Back
          </button>
          {activeStep === STEPS.length - 1 ? (
            <button className="ecn-bn" onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : instanceState === "Draft" ? "Submit & Schedule →" : "Save Changes →"}
            </button>
          ) : (
            <button className="ecn-bn" onClick={handleNext}>
              Next →
            </button>
          )}
        </div>
      </div>

      {/* Phone-frame Preview Modal */}
      <Modal
        open={showDemoPreview}
        onClose={() => { setShowDemoPreview(false); setDragPos({ x: 0, y: 0 }); }}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
        slotProps={{ backdrop: { sx: { pointerEvents: "auto" } } }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          sx={{
            width: 390,
            height: 720,
            borderRadius: "32px",
            background: "#1A1A1A",
            p: "12px",
            position: "relative",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            pointerEvents: "auto",
            transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
            cursor: dragging ? "grabbing" : "default",
          }}
        >
          {/* Drag handle — phone notch area */}
          <Box
            onMouseDown={handleDragStart}
            sx={{
              position: "absolute", top: 0, left: 0, right: 0, height: 40,
              cursor: dragging ? "grabbing" : "grab", zIndex: 11, borderRadius: "32px 32px 0 0",
            }}
          />
          {/* Phone notch */}
          <Box sx={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            width: 80, height: 24, background: "#1A1A1A", borderRadius: 12, zIndex: 10,
          }} />
          {/* Iframe container */}
          <Box sx={{
            width: "100%", height: "100%", borderRadius: "22px", overflow: "hidden",
            background: "#fff",
          }}>
            {demoPreviewUrl && (
              <iframe
                src={demoPreviewUrl}
                title="Raffle Demo Preview"
                style={{ width: "100%", height: "100%", border: "none" }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />
            )}
          </Box>
          {/* Close button */}
          <Box
            component="button"
            onClick={() => setShowDemoPreview(false)}
            sx={{
              position: "absolute", top: -12, right: -12,
              width: 32, height: 32, borderRadius: "50%",
              background: "#fff", border: "2px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#666",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            ✕
          </Box>
        </Box>
      </Modal>
      {/* Phone-frame Rules Preview Modal */}
      {showRulesPreview && (
      <Modal
        open={showRulesPreview}
        onClose={() => { setShowRulesPreview(false); setDragPos({ x: 0, y: 0 }); }}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
        slotProps={{ backdrop: { sx: { pointerEvents: "auto" } } }}
      >
        <Box
          onClick={(e) => e.stopPropagation()}
          data-reader-ignore="true"
          sx={{
            width: 390,
            height: 720,
            borderRadius: "32px",
            background: "#1A1A1A",
            p: "12px",
            position: "relative",
            boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
            pointerEvents: "auto",
            transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
            cursor: dragging ? "grabbing" : "default",
          }}
        >
          {/* Drag handle — phone notch area */}
          <Box
            onMouseDown={handleDragStart}
            sx={{
              position: "absolute", top: 0, left: 0, right: 0, height: 40,
              cursor: dragging ? "grabbing" : "grab", zIndex: 11, borderRadius: "32px 32px 0 0",
            }}
          />
          {/* Phone notch */}
          <Box sx={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
            width: 80, height: 24, background: "#1A1A1A", borderRadius: 12, zIndex: 10,
          }} />
          {/* Content container */}
          <Box sx={{
            width: "100%", height: "100%", borderRadius: "22px", overflow: "auto",
            background: "#fff", p: 2.5, pt: 4,
          }}>
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#111827", mb: 0.5, textAlign: "center" }}>
              OFFICIAL RULES
            </Typography>
            <Typography sx={{ fontSize: 10, color: "#6B7280", mb: 2, textAlign: "center" }}>
              {form.sponsorLegalName || '[Sponsor Name]'} — Promotion Period: {form.entryWindowStart?.format?.('MMM D, YYYY') || '[Start Date]'} through {form.entryWindowEnd?.format?.('MMM D, YYYY') || '[End Date]'}
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>1. NO PURCHASE NECESSARY</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              NO PURCHASE OR PAYMENT OF ANY KIND IS NECESSARY TO ENTER OR WIN. A purchase will not improve your chances of winning. Void where prohibited by law.
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>2. SPONSOR</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              This promotion ("Promotion") is sponsored by {form.sponsorLegalName || '[Sponsor Legal Name]'} ("Sponsor").{form.supportContact ? ` Contact: ${form.supportContact}.` : ''}
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>3. ELIGIBILITY</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              {form.rulesStrictness === 'permissive'
                ? 'This Promotion is open to all attendees of the event. No minimum age, residency, or purchase requirements apply. Employees of the Sponsor and their immediate families are not eligible.'
                : form.rulesStrictness === 'restrictive'
                  ? `This Promotion is open to legal residents of ${form.jurisdictions || 'the applicable jurisdiction(s)'} who are at least eighteen (18) years of age at the time of entry. Proof of eligibility (valid government-issued photo identification) may be required to claim a prize. Employees, officers, and directors of the Sponsor, and their respective parent companies, subsidiaries, affiliates, agents, and members of their immediate families (spouse, parents, children, siblings) and persons living in the same household, whether related or not, are not eligible to participate.`
                  : 'This Promotion is open to all attendees of the event who are at least eighteen (18) years of age at the time of entry. Employees of the Sponsor and their immediate families (spouse, parents, children, siblings) are not eligible to participate.'
              }
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>4. PROMOTION PERIOD</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              The Promotion begins on {form.entryWindowStart?.format?.('MMMM D, YYYY [at] h:mm A') || '[Start Date/Time]'} and ends on {form.entryWindowEnd?.format?.('MMMM D, YYYY [at] h:mm A') || '[End Date/Time]'} ("Promotion Period"). All entries must be received during the Promotion Period. The Sponsor's computer shall be the official timekeeping device.
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>5. HOW TO ENTER</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              To enter, navigate to the Promotion entry page and complete the required entry form. {form.entryModel === 'paid' ? `Entry requires purchase of raffle ticket(s) at $${form.ticketBundles[0]?.price || '0'} per ticket.` : 'Entry is free of charge.'} Limit one (1) entry per person unless otherwise stated. Multiple entries from the same individual beyond the stated limit will be void. All entries become the property of the Sponsor and will not be returned.
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>6. PRIZE(S)</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              {form.prizes.map((p, i) => `(${i + 1}) ${p.name || '[Prize Name]'}${p.value ? ` — Approximate Retail Value ("ARV"): $${p.value}` : ''}${p.quantity > 1 ? ` (Qty: ${p.quantity})` : ''}`).join('; ')}. Total ARV of all prizes: ${form.prizes.reduce((sum, p) => sum + (parseFloat(p.value) || 0) * (p.quantity || 1), 0) || '[TBD]'}. Prizes are non-transferable and no substitution or cash equivalent is permitted, except at Sponsor's sole discretion. Sponsor reserves the right to substitute a prize of equal or greater value. All federal, state, and local taxes on prizes are the sole responsibility of the winner(s).
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>7. WINNER SELECTION & NOTIFICATION</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              Winner(s) will be selected by random drawing from among all eligible entries received during the Promotion Period. Drawing(s) will be conducted on {form.drawingSchedules?.[0]?.time?.format?.('MMMM D, YYYY [at] h:mm A') || '[Drawing Date/Time]'}{form.drawingSchedules?.length > 1 ? ` and ${form.drawingSchedules.length - 1} additional drawing(s)` : ''}. Odds of winning depend on the number of eligible entries received. Winner(s) will be notified via the contact information provided at entry. If a potential winner cannot be contacted within forty-eight (48) hours of the drawing, the prize will be forfeited and an alternate winner may be selected.
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>8. GENERAL CONDITIONS</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              By entering, each entrant agrees to be bound by these Official Rules and the decisions of the Sponsor, which are final and binding in all respects. Sponsor reserves the right, in its sole discretion, to disqualify any entrant who tampers with the entry process or violates these Official Rules. Sponsor further reserves the right to cancel, terminate, or modify this Promotion if it is not capable of completion as planned due to fraud, technical failures, or any other factor beyond Sponsor's reasonable control.
              {form.rulesStrictness === 'restrictive' && ' Void where prohibited or restricted by law. All federal, state, and local laws and regulations apply. Any dispute arising from this Promotion shall be governed by the laws of the applicable jurisdiction without regard to conflict of law principles.'}
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>9. LIMITATION OF LIABILITY</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              By entering, entrants release and hold harmless Sponsor, its parent companies, subsidiaries, affiliates, and their respective officers, directors, employees, and agents from any and all liability for injuries, losses, or damages of any kind arising from participation in this Promotion or acceptance, use, or misuse of any prize.
            </Typography>

            <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>10. PRIVACY</Typography>
            <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
              Information collected from entrants is subject to Sponsor's Privacy Policy{form.privacyPolicyUrl ? ` available at ${form.privacyPolicyUrl}` : ''}. Personal information will be used for the purpose of administering this Promotion and will not be sold to third parties.
            </Typography>

            {form.rulesStrictness === 'restrictive' && (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: 11, color: "#111827", mb: 0.5 }}>11. DISPUTE RESOLUTION</Typography>
                <Typography sx={{ fontSize: 10.5, color: "#4B5563", mb: 1.5, lineHeight: 1.6 }}>
                  Except where prohibited by law, as a condition of participating in this Promotion, each entrant agrees that any and all disputes which cannot be resolved between the parties shall be resolved individually, without resort to any form of class action. Any claim or cause of action arising out of or related to this Promotion must be filed within one (1) year after such claim or cause of action arose.
                </Typography>
              </>
            )}

            <Box sx={{ mt: 2, p: 1.5, background: "#F3F4F6", borderRadius: 1.5 }}>
              <Typography sx={{ fontSize: 9.5, color: "#6B7280", lineHeight: 1.5 }}>
                🔒 PLATFORM DISCLOSURE: Tabs provides technology that enables the Promotion Sponsor to create and operate this experience. Tabs is not the sponsor, administrator, merchant, prize provider, judge, or promoter unless expressly identified otherwise. The Promotion Sponsor is solely responsible for the experience, its Official Rules, legal compliance, participant communications, prizes, winner selection, and fulfillment.
              </Typography>
            </Box>
          </Box>
          {/* Close button */}
          <Box
            component="button"
            onClick={() => setShowRulesPreview(false)}
            sx={{
              position: "absolute", top: -12, right: -12,
              width: 32, height: 32, borderRadius: "50%",
              background: "#fff", border: "2px solid #E5E7EB",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#666",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
          >
            ✕
          </Box>
        </Box>
      </Modal>
      )}
    </div>
  );
};

export default RaffleConfig;
