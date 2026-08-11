import React, { useState, useEffect, memo } from "react";
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
import PieChartOutlinedIcon from "@mui/icons-material/PieChartOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
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
  eligibilityRules: [],
  maxEntries: 10,
  accessCodes: "",
  allowedTicketTypes: "",
  // Entry info collection
  infoCollection: "minimum", // "minimum" (name, email, phone) | "full" (+ address)
  // Step 5: Ticket pricing
  entryModel: "free",
  ticketBundles: [{ quantity: 1, price: 5 }],
  // Step 6: Sponsor association
  hasSponsor: false,
  sponsorName: "",
  sponsorLogoUrl: "",
  sponsorColors: "",
  sponsorPlacement: "header_banner",
  sponsorAmount: "",
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
  // Step 9: Review (no extra fields)
};

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
        else if (prize.name.length > 100)
          errors[`prizes[${idx}].name`] = "Prize name must be ≤ 100 characters.";
        if (prize.description && prize.description.length > 500)
          errors[`prizes[${idx}].description`] = "Description must be ≤ 500 characters.";
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
          value={prize.name}
          onChange={(e) => onUpdate({ ...prize, name: e.target.value })}
          onBlur={(e) => {
            if (!prize.description) generateDescription(e.target.value);
          }}
          error={!!errors[`prizes[${idx}].name`]}
          helperText={errors[`prizes[${idx}].name`] || `${prize.name.length}/100`}
          inputProps={{ maxLength: 101 }}
        />
        <TextField
          fullWidth
          size="small"
          label="Prize Value ($)"
          type="number"
          value={prize.value || ""}
          onChange={(e) => onUpdate({ ...prize, value: e.target.value })}
          placeholder="e.g. 500"
          inputProps={{ min: 0, step: "0.01" }}
        />
        <Box sx={{ position: "relative" }}>
          <TextField
            fullWidth
            size="small"
            label="Prize Description"
            multiline
            rows={2}
            value={prize.description}
            onChange={(e) => onUpdate({ ...prize, description: e.target.value })}
            error={!!errors[`prizes[${idx}].description`]}
            helperText={
              generatingDesc
                ? "✨ AI is writing a description..."
                : (errors[`prizes[${idx}].description`] || `${prize.description.length}/500`)
            }
          />
          {/* Regenerate AI description button */}
          {prize.name.length >= 3 && !generatingDesc && (
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

const RaffleConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showDemoPreview, setShowDemoPreview] = useState(false);
  const [demoPreviewUrl, setDemoPreviewUrl] = useState("");
  const [eventData, setEventData] = useState(null);

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
        if (instance?.config && Object.keys(instance.config).length > 0) {
          const cfg = instance.config;
          setForm(f => ({
            ...f,
            raffleType: cfg.raffleType || f.raffleType,
            bannerStyle: cfg.bannerStyle || f.bannerStyle,
            accentColor: cfg.accentColor || f.accentColor,
            prizes: cfg.prizes?.length ? cfg.prizes.map((p, i) => ({ ...p, id: p.id || `prize-${i + 1}`, imagePreview: p.imageUrl || null })) : f.prizes,
            entryWindowStart: cfg.entryWindowStart ? dayjs(cfg.entryWindowStart) : f.entryWindowStart,
            entryWindowEnd: cfg.entryWindowEnd ? dayjs(cfg.entryWindowEnd) : f.entryWindowEnd,
            drawingSchedules: cfg.drawingSchedules?.length ? cfg.drawingSchedules.map(s => ({ time: s.time ? dayjs(s.time) : null, winners: s.winners || 1 })) : f.drawingSchedules,
            eligibilityRules: cfg.eligibilityRules || f.eligibilityRules,
            maxEntries: cfg.maxEntries || f.maxEntries,
            accessCodes: Array.isArray(cfg.accessCodes) ? cfg.accessCodes.join(', ') : (cfg.accessCodes || f.accessCodes),
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
            jurisdictions: Array.isArray(cfg.compliance?.jurisdictions) ? cfg.compliance.jurisdictions.join(', ') : (cfg.jurisdictions || f.jurisdictions),
            complianceAcknowledged: cfg.compliance?.acknowledged || f.complianceAcknowledged,
            requireTermsConsent: cfg.compliance?.requireTerms !== undefined ? cfg.compliance.requireTerms : true,
            rulesPreviewedByAdmin: cfg.compliance?.acknowledged || false,
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
  const INNER_TAB_COUNT = { 1: 3, 2: 3, 3: 3 }; // step 1: Appearance/Prizes/Schedule, step 2: Eligibility/Info/Pricing, step 3: Sponsor/Notifications/Compliance

  const handleNext = () => {
    const tabCount = INNER_TAB_COUNT[activeStep] || 0;
    // If this step has inner tabs and we're not on the last one, advance inner tab
    if (tabCount > 0 && innerTab < tabCount - 1) {
      setInnerTab(innerTab + 1);
      return;
    }
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
          ? {
              name: form.sponsorName,
              logoUrl: form.sponsorLogoUrl,
              colors: form.sponsorColors.split(",").map((c) => c.trim()).filter(Boolean),
              placement: form.sponsorPlacement,
              amount: parseFloat(form.sponsorAmount) || 0,
            }
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
        },
      };

      // Save config to instance
      await updateInstance(eventId, experienceId, { config });
      // Transition from Draft → Scheduled
      await transitionState(eventId, experienceId, { action: "submit" });
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

  const renderAppearance = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>Appearance</Typography>

      {/* Banner Style Selector */}
      <Box sx={{ mb: 3, p: 2, border: "1px solid #E5E7EB", borderRadius: 3, background: "#fff" }}>
        <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1.5, color: "#111827" }}>Banner Style</Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mb: 1.5 }}>Choose how the prize appears in the attendee view</Typography>
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {[
            { id: "gift", label: "🎁 Gift Box", desc: "Animated gift with ribbon" },
            { id: "card", label: "💳 Gift Card", desc: "Dark gradient card" },
            { id: "image", label: "📷 Photo Only", desc: "Upload a prize image" },
          ].map(opt => (
            <Box
              key={opt.id}
              onClick={() => updateField("bannerStyle", opt.id)}
              sx={{
                flex: 1, p: 1.5, borderRadius: 2, cursor: "pointer", textAlign: "center",
                border: form.bannerStyle === opt.id ? "2px solid #00AAD6" : "1px solid #E5E7EB",
                background: form.bannerStyle === opt.id ? "#F0FDFF" : "#FAFBFC",
                transition: "all 0.2s",
              }}
            >
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{opt.label}</Typography>
              <Typography sx={{ fontSize: 10.5, color: "#6B7280", mt: 0.5 }}>{opt.desc}</Typography>
            </Box>
          ))}
        </Box>

        {form.bannerStyle === "image" && (
          <Typography sx={{ fontSize: 11.5, color: "#00A9D6", mt: 1, fontWeight: 600 }}>
            📷 Upload a photo for your first prize on the Prizes tab — it will be used as the banner.
          </Typography>
        )}

        {/* Accent Color */}
        <Box sx={{ mt: 2 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 1, color: "#111827" }}>Accent Color</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {[
              { name: "Tabs Cyan", value: "#00A9D6" },
              { name: "Ember", value: "#F47A20" },
              { name: "Grape", value: "#8B5CF6" },
              { name: "Lime", value: "#22C55E" },
              { name: "Rose", value: "#E8467A" },
              { name: "Gold", value: "#F09925" },
            ].map(c => (
              <Box
                key={c.value}
                onClick={() => updateField("accentColor", c.value)}
                title={c.name}
                sx={{
                  width: 28, height: 28, borderRadius: "50%", cursor: "pointer",
                  background: c.value,
                  border: form.accentColor === c.value ? "3px solid #0D1B2A" : "2px solid #fff",
                  boxShadow: form.accentColor === c.value ? "0 0 0 1px #0D1B2A" : "0 0 0 1px #d9dee2",
                  transition: "all 0.2s",
                }}
              />
            ))}
            <input
              type="color"
              value={form.accentColor}
              onChange={(e) => updateField("accentColor", e.target.value)}
              style={{ width: 30, height: 30, border: "none", borderRadius: "50%", padding: 0, cursor: "pointer", background: "none" }}
              title="Custom color"
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );

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
          <Box key={idx} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
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
                  sx: { flex: 2 },
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
              sx={{ flex: 1 }}
            />
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
                    rules = isSelected
                      ? form.eligibilityRules.filter((r) => r !== opt.value)
                      : [...form.eligibilityRules, opt.value];
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

  const renderTicketPricing = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>How do attendees enter?</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#71727A", fontSize: 13 }}>
        Choose whether entry is free or requires purchasing tickets.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, mb: 3 }}>
        <Box
          onClick={() => updateField("entryModel", "free")}
          sx={{
            flex: 1, p: 2.5, borderRadius: 2, cursor: "pointer", textAlign: "center",
            border: form.entryModel === "free" ? "2px solid #00AAD6" : "1px solid #E5E7EB",
            background: form.entryModel === "free" ? "#F0FDFF" : "#fff",
            transition: "all 0.15s",
            "&:hover": { borderColor: form.entryModel === "free" ? "#00AAD6" : "#D1D5DB" },
          }}
        >
          <VolunteerActivismOutlinedIcon sx={{ fontSize: 32, mb: 1, color: form.entryModel === "free" ? "#00AAD6" : "#9CA3AF" }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Free Entry</Typography>
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>Anyone eligible can enter at no cost</Typography>
        </Box>
        <Box
          onClick={() => updateField("entryModel", "paid")}
          sx={{
            flex: 1, p: 2.5, borderRadius: 2, cursor: "pointer", textAlign: "center",
            border: form.entryModel === "paid" ? "2px solid #00AAD6" : "1px solid #E5E7EB",
            background: form.entryModel === "paid" ? "#F0FDFF" : "#fff",
            transition: "all 0.15s",
            "&:hover": { borderColor: form.entryModel === "paid" ? "#00AAD6" : "#D1D5DB" },
          }}
        >
          <ConfirmationNumberOutlinedIcon sx={{ fontSize: 32, mb: 1, color: form.entryModel === "paid" ? "#00AAD6" : "#9CA3AF" }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Paid Tickets</Typography>
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>Attendees purchase raffle tickets to enter</Typography>
        </Box>
      </Box>

      {form.entryModel === "paid" && (
        <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, p: 2, background: "#FAFBFC" }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#111827", mb: 1.5 }}>
            Ticket Bundles ({form.ticketBundles.length}/10)
          </Typography>
          {errors.ticketBundles && (
            <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
              {errors.ticketBundles}
            </Typography>
          )}
          {form.ticketBundles.map((bundle, idx) => (
            <Box key={idx} sx={{ display: "flex", gap: 2, mb: 2, alignItems: "flex-start" }}>
              <TextField
                label="Tickets"
                type="number"
                value={bundle.quantity || ""}
                onChange={(e) => {
                  const updated = [...form.ticketBundles];
                  const val = e.target.value === "" ? "" : Math.max(1, parseInt(e.target.value) || 1);
                  updated[idx] = { ...updated[idx], quantity: val };
                  updateField("ticketBundles", updated);
                }}
                error={!!errors[`ticketBundles[${idx}].quantity`]}
                helperText={errors[`ticketBundles[${idx}].quantity`]}
                inputProps={{ min: 1 }}
                size="small"
                sx={{ flex: 1 }}
              />
              <TextField
                label="Price ($)"
                value={bundle.price || ""}
                onChange={(e) => {
                  const updated = [...form.ticketBundles];
                  const raw = e.target.value.replace(/[^0-9.]/g, '');
                  updated[idx] = { ...updated[idx], price: raw };
                  updateField("ticketBundles", updated);
                }}
                error={!!errors[`ticketBundles[${idx}].price`]}
                helperText={errors[`ticketBundles[${idx}].price`]}
                inputProps={{ inputMode: "decimal" }}
                size="small"
                sx={{ flex: 1 }}
              />
              {form.ticketBundles.length > 1 && (
                <IconButton size="small" onClick={() => {
                  const updated = form.ticketBundles.filter((_, i) => i !== idx);
                  updateField("ticketBundles", updated);
                }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
          ))}
          {form.ticketBundles.length < 10 && (
            <Button
              startIcon={<AddIcon />}
              size="small"
              onClick={() => updateField("ticketBundles", [...form.ticketBundles, { quantity: 1, price: 5 }])}
              sx={{ textTransform: "none", fontWeight: 600, color: "#00AAD6" }}
            >
              Add Bundle
            </Button>
          )}
        </Box>
      )}
    </Box>
  );

  const renderSponsor = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>Is this raffle sponsored?</Typography>
      <Typography variant="body2" sx={{ mb: 3, color: "#71727A", fontSize: 13 }}>
        If a brand is funding the prizes, add their details here. Their logo will appear on the raffle page.
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
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>A brand is sponsoring this raffle</Typography>
        </Box>
      </Box>

      {form.hasSponsor && (
        <Box sx={{ border: "1px solid #E5E7EB", borderRadius: 2, p: 2, background: "#FAFBFC" }}>
          <TextField
            fullWidth
            label="Sponsor Name"
            value={form.sponsorName}
            onChange={(e) => updateField("sponsorName", e.target.value)}
            error={!!errors.sponsorName}
            helperText={errors.sponsorName || "The brand name shown on the raffle page"}
            sx={{ mb: 2 }}
            inputProps={{ maxLength: 100 }}
          />
          <TextField
            fullWidth
            label="Sponsor Logo URL"
            value={form.sponsorLogoUrl}
            onChange={(e) => updateField("sponsorLogoUrl", e.target.value)}
            helperText="PNG or SVG, max 2MB"
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Where to show sponsor branding</InputLabel>
            <Select
              value={form.sponsorPlacement}
              label="Where to show sponsor branding"
              onChange={(e) => updateField("sponsorPlacement", e.target.value)}
            >
              <MenuItem value="header_banner">Header Banner</MenuItem>
              <MenuItem value="footer_badge">Footer Badge</MenuItem>
              <MenuItem value="background_watermark">Background Watermark</MenuItem>
              <MenuItem value="prize_sponsor_label">Prize Sponsor Label</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Sponsor Contribution ($)"
            value={form.sponsorAmount}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9.]/g, '');
              updateField("sponsorAmount", raw);
            }}
            helperText="How much the sponsor is contributing to fund prizes"
            inputProps={{ inputMode: "decimal" }}
          />
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
    // Auto-fill jurisdiction from event location if not already set
    const eventState = eventData?.state || eventData?.location?.state || eventData?.venue?.state || '';
    const autoJurisdiction = eventState ? `US-${eventState.toUpperCase().replace(/^US-/, '')}` : '';
    if (autoJurisdiction && !form.jurisdictions) {
      setTimeout(() => updateField("jurisdictions", autoJurisdiction), 0);
    }

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

    const selectedStates = form.jurisdictions.split(',').map(j => j.trim()).filter(Boolean);
    const matchedRules = selectedStates.map(s => RULES_BY_STATE[s]).filter(Boolean);

    return (
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>Compliance</Typography>
        <TextField
          fullWidth
          size="small"
          label="Jurisdictions (country-state codes, comma-separated)"
          value={form.jurisdictions}
          onChange={(e) => updateField("jurisdictions", e.target.value)}
          error={!!errors.jurisdictions}
          helperText={errors.jurisdictions || "e.g. US-TX, US-CA, US-NY"}
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
          <Alert severity="warning" sx={{ mb: 2, fontSize: 12 }}>
            No specific rules preview available for the selected jurisdiction(s). Please review local regulations independently.
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2, fontSize: 12 }}>
          Raffle legality varies by jurisdiction. By acknowledging below, you confirm you have reviewed
          applicable local regulations for the selected jurisdictions.
        </Alert>

        {/* Require Terms Consent Toggle */}
        <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#FAFBFC" }}>
          <FormControlLabel
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

        {/* Preview Rules Button — admin must preview before acknowledging */}
        <Box sx={{ mb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              updateField("rulesPreviewedByAdmin", true);
              const previewUrl = `https://experience.keeptabs.app/e/${experienceId}/rules?test=true&eventId=${eventId}`;
              window.open(previewUrl, '_blank', 'width=420,height=750,menubar=no,toolbar=no,location=no,status=no');
            }}
            sx={{
              textTransform: "none",
              fontWeight: 700,
              fontSize: 13,
              borderColor: form.rulesPreviewedByAdmin ? "#34c471" : "#00AAD6",
              color: form.rulesPreviewedByAdmin ? "#34c471" : "#00AAD6",
              "&:hover": { borderColor: form.rulesPreviewedByAdmin ? "#1f9d55" : "#0088b0", background: form.rulesPreviewedByAdmin ? "#f0fdf4" : "#f0fdff" },
            }}
          >
            {form.rulesPreviewedByAdmin ? "✓ Rules Previewed" : "👁 Preview Rules (Required)"}
          </Button>
          {errors.rulesPreviewedByAdmin && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              {errors.rulesPreviewedByAdmin}
            </Typography>
          )}
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={form.complianceAcknowledged}
              onChange={(e) => updateField("complianceAcknowledged", e.target.checked)}
              disabled={!form.rulesPreviewedByAdmin}
            />
          }
          label="I acknowledge and accept compliance requirements for the selected jurisdictions"
        />
        {errors.complianceAcknowledged && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
            {errors.complianceAcknowledged}
          </Typography>
        )}
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
    const tabs = ['Appearance', 'Prizes', 'Schedule'];
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
        {innerTab === 0 && renderAppearance()}
        {innerTab === 1 && renderPrizeConfig()}
        {innerTab === 2 && renderSchedule()}
      </Box>
    );
  };

  const renderEntryRulesContent = () => {
    const tabs = ['Eligibility', 'Info Collection', 'Ticket Pricing'];
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
        {innerTab === 2 && renderTicketPricing()}
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
          <p className="ecn-pg-s">Complete all steps to schedule your raffle. Submitting transitions this raffle from Draft to Scheduled.</p>

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
            <div className="ecn-fee"><span>Entry:</span><span>{form.entryModel === "paid" ? `$${form.ticketBundles[0]?.price || 0}` : "Free"}</span></div>
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
                    },
                  };
                  await updateInstance(eventId, experienceId, { config });
                } catch (e) {
                  console.warn("Preview: draft save failed, opening with last saved config", e.message);
                }
                const previewUrl = `https://experience.keeptabs.app/e/${experienceId}/enter?test=true&eventId=${eventId}&accentColor=${encodeURIComponent(form.accentColor)}&bannerStyle=${encodeURIComponent(form.bannerStyle)}&prizeName=${encodeURIComponent(form.prizes[0]?.name || '')}&infoCollection=${encodeURIComponent(form.infoCollection)}`;
                setDemoPreviewUrl(previewUrl);
                setShowDemoPreview(true);
              }}
            >
              🎯 Open Demo Preview
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
              {submitting ? "Submitting..." : "Submit & Schedule →"}
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
        onClose={() => setShowDemoPreview(false)}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
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
          }}
        >
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
    </div>
  );
};

export default RaffleConfig;
